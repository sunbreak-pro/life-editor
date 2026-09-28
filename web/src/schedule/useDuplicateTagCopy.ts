import { useCallback, useEffect, useRef } from "react";
import {
  useWikiTagsUnifiedContext,
  type ScheduleItem,
} from "@life-editor/shared";
import type { CreateCompanion } from "./useScheduleMutations";

/*
 * #2005 (D-20260923-sched-4 = C): a duplicate can take the source's tags with
 * it, when the user asks for that at the moment of duplicating.
 *
 * The tags ride on the create as its companion (`alongside`, #1642 P6), so
 * the copy and every tag it received come off with ONE Ctrl+Z — the promise
 * the decision record says a plain `assignTagToItem` per tag would break,
 * since each of those pushes a history entry of its own.
 *
 * Only the history-free writes of the tag API are used (`bulkAssign` /
 * `bulkUnassign` with a single item). `useWikiTagsUnifiedAPI` itself is left
 * as it is (#2005 Scope).
 */

export interface DuplicateTagCopy {
  /** How many tags `item` shows — the choice is only offered when > 0. */
  tagCountOf: (item: ScheduleItem) => number;
  /**
   * The companion that puts `source`'s tags on the saved copy. Resolves the
   * pair that reverses them, or null when no tag landed (the create is then
   * recorded on its own).
   */
  copyTagsFrom: (source: ScheduleItem) => CreateCompanion;
}

export function useDuplicateTagCopy(
  /** Some tags could not be put on the copy (the copy itself landed). */
  onCopyFailed: () => void,
): DuplicateTagCopy {
  const { getTagsForItem, bulkAssign, bulkUnassign } =
    useWikiTagsUnifiedContext();

  /*
   * The undo runs long after the press, and `bulkUnassign` finds the row to
   * remove in the assignment cache of the render it came from. The one
   * captured at press time predates the copy's own assignments, so it would
   * find nothing, count that as done, and leave every tag behind. The
   * reversal reads the latest pair instead.
   */
  const writes = useRef({ bulkAssign, bulkUnassign });
  useEffect(() => {
    writes.current = { bulkAssign, bulkUnassign };
  });

  /*
   * The tags the source SHOWS. A repeat's tags hang off the series, not the
   * occurrence (#1632 / #1663 — see eventTagColor), so an occurrence reads
   * both its own and its routine's. The copy is a plain event with no series
   * behind it, so both sets land on the copy itself.
   */
  const tagIdsOf = useCallback(
    (item: ScheduleItem): string[] => {
      const owners = item.routineId ? [item.id, item.routineId] : [item.id];
      const ids = owners.flatMap((owner) =>
        (getTagsForItem(owner) ?? []).map((a) => a.tagId),
      );
      return [...new Set(ids)];
    },
    [getTagsForItem],
  );

  const tagCountOf = useCallback(
    (item: ScheduleItem) => tagIdsOf(item).length,
    [tagIdsOf],
  );

  const copyTagsFrom = useCallback(
    (source: ScheduleItem): CreateCompanion => {
      // Read at press time: the tags the user saw on the source are the ones
      // they asked to carry over.
      const tagIds = tagIdsOf(source);
      return async (saved) => {
        const landed: string[] = [];
        for (const tagId of tagIds) {
          const result = await writes.current.bulkAssign([saved.id], tagId);
          if (result.succeeded > 0) landed.push(tagId);
        }
        if (landed.length < tagIds.length) onCopyFailed();
        if (landed.length === 0) return null;

        /*
         * Both closures throw on a row that did not move (#1767): a closure
         * that resolves tells the history the reversal worked, and the command
         * moves on to redo while the tag is still there. Thrown, it stays on
         * the undo stack and the host's `undoFailed` toast is the one report.
         */
        const each = async (
          write: (
            itemIds: readonly string[],
            tagId: string,
          ) => Promise<{ failed: number }>,
        ) => {
          let failed = 0;
          for (const tagId of landed) {
            failed += (await write([saved.id], tagId)).failed;
          }
          if (failed > 0) {
            throw new Error(`${failed} tag(s) on the duplicate did not move`);
          }
        };
        return {
          undo: () => each(writes.current.bulkUnassign),
          redo: () => each(writes.current.bulkAssign),
        };
      };
    },
    [tagIdsOf, onCopyFailed],
  );

  return { tagCountOf, copyTagsFrom };
}
