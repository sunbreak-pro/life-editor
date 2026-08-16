import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { isSameDate } from "./scheduleItemsHelpers";

/**
 * Trash surface of useScheduleItemsAPI (#675 split): load / restore / purge.
 *
 * Deliberately undo-free. The Trash view is itself the undo for a delete, and
 * the delete that put the row here already pushed its own command in
 * useScheduleItemsCRUD — pushing a second one from the restore button would
 * make Ctrl+Z walk a history the user never performed.
 */
export interface UseScheduleItemsTrashParams {
  ds: DataService;
  /** The day the view is anchored on — a restore only lands back on screen for it. */
  date: string;
  setItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  setDeletedItems: Dispatch<SetStateAction<ScheduleItem[]>>;
}

export function useScheduleItemsTrash(params: UseScheduleItemsTrashParams) {
  const { ds, date, setItems, setDeletedItems } = params;

  const loadDeletedScheduleItems = useCallback(async () => {
    try {
      const data = await ds.fetchDeletedScheduleItems();
      setDeletedItems(data);
    } catch (e) {
      logServiceError("ScheduleItems", "fetchDeleted", e);
    }
  }, [ds, setDeletedItems]);

  const restoreScheduleItem = useCallback(
    (id: string) => {
      setDeletedItems((prev) => {
        const target = prev.find((i) => i.id === id);
        if (target) {
          const restored: ScheduleItem = {
            ...target,
            isDeleted: false,
            deletedAt: null,
          };
          if (isSameDate(restored, date)) {
            setItems((i) => [...i, restored]);
          }
        }
        return prev.filter((i) => i.id !== id);
      });
      ds.restoreScheduleItem(id).catch((e) => {
        logServiceError("ScheduleItems", "restore", e);
        // The row is still trashed — a routine occurrence whose (routine,
        // date) pair has been re-taken is refused outright (#932). Without
        // this the optimistic paint stood: the item vanished from the trash
        // and never appeared anywhere else, which is the "silent failure"
        // in the issue title. Undo the paint and re-read the trash so the
        // list matches the server.
        setItems((prev) => prev.filter((i) => i.id !== id));
        void loadDeletedScheduleItems();
      });
    },
    [ds, date, setItems, setDeletedItems, loadDeletedScheduleItems],
  );

  const permanentDeleteScheduleItem = useCallback(
    (id: string) => {
      setDeletedItems((prev) => prev.filter((i) => i.id !== id));
      ds.permanentDeleteScheduleItem(id).catch((e) =>
        logServiceError("ScheduleItems", "permanentDelete", e),
      );
    },
    [ds, setDeletedItems],
  );

  return {
    loadDeletedScheduleItems,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
  };
}
