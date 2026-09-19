import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ScheduleItem } from "../types/schedule";
import type { DataService } from "../services/DataService";
import { logServiceError } from "../utils/logError";
import { isSameDate } from "./scheduleItemsHelpers";
import { isScheduleRestoreConflict } from "../services/scheduleRestoreConflict";

/**
 * What asking to bring one row back out of the trash came to.
 *
 * - `restored` — the row is live again.
 * - `conflict` — refused on purpose: a live row already holds the item's
 *   (routine, date) pair (#932). The row stays in the trash.
 * - `failed` — the write broke for any other reason. The row stays too.
 */
export type TrashRestoreOutcome = "restored" | "conflict" | "failed";

/**
 * Restore one schedule item and judge the result (#1670).
 *
 * The single place the #932 refusal is told apart from a breakage. The Trash
 * screen and the ScheduleItems context both restore through here, so the two
 * cannot drift into different answers for the same server response.
 */
export async function restoreScheduleItemFromTrash(
  ds: DataService,
  id: string,
): Promise<TrashRestoreOutcome> {
  try {
    await ds.restoreScheduleItem(id);
    return "restored";
  } catch (e) {
    logServiceError("ScheduleItems", "restore", e);
    return isScheduleRestoreConflict(e) ? "conflict" : "failed";
  }
}

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

  /*
   * Waits for the server before touching either list (#1670). The optimistic
   * paint this replaces had to be taken back whenever the restore was refused
   * (#932), and it judged the refusal on its own instead of through the one
   * function the Trash screen uses.
   */
  const restoreScheduleItem = useCallback(
    async (id: string): Promise<TrashRestoreOutcome> => {
      const outcome = await restoreScheduleItemFromTrash(ds, id);
      if (outcome !== "restored") {
        // The row is still trashed; re-read so the list matches the server.
        await loadDeletedScheduleItems();
        return outcome;
      }
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
      return outcome;
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
