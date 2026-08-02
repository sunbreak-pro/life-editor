import { useCallback } from "react";
import {
  useWikiTagsUnifiedContext,
  type DataService,
} from "@life-editor/shared";
import { useItemLinkTargets } from "../../notes/useItemLinkTargets";

/*
 * "[[" link plumbing for the task body (#507) — the task-side twin of
 * useNoteLinking / DailyView's inline wiring.
 *
 * The task detail editor shipped without any of it: the pool loader and the
 * navigate callback were simply never passed down, so typing "[[" opened no
 * menu and a link already in the text did nothing on click. That is a different
 * failure from #475 (which was a real bug inside the click path) — here the
 * path was fine and nothing was plugged into it. Putting the wiring in one hook
 * that all three surfaces can reach is what stops the next editor from being
 * added with the same hole.
 *
 * No create-note row: like the Daily editor, the task body links to EXISTING
 * items only (there is no "make a note from here" path to hang it on).
 */

export function useTaskLinking({ dataService }: { dataService?: DataService }) {
  const { createItemLink, getLinksForItem, syncInlineLinks } =
    useWikiTagsUnifiedContext();

  // A LOADER, not a list — nothing is fetched until the first "[[" opens the
  // menu (#430: typing prose must not hit the network).
  const loadLinkTargets = useItemLinkTargets(dataService);

  /*
   * Mirror a resolved "[[" link into the item_links graph as an edge from the
   * current task to the target, so a link written in a task shows up in Connect
   * and in the target's backlinks — same contract Notes and Daily already have.
   *
   * Duplicate-guarded against the cache. Marked origin "inline" so the
   * save-time delete-sync (#372, handleBodySaved below) may remove it when the
   * text link goes away — manual LinkPanel edges stay untouched.
   */
  const handleResolvedLinkInserted = useCallback(
    (fromId: string, targetId: string) => {
      if (!fromId || fromId === targetId) return;
      const already = getLinksForItem(fromId).outgoing.some(
        (l) => !l.isDeleted && l.toItemId === targetId,
      );
      if (already) return;
      void createItemLink(fromId, targetId, "inline").catch((e) =>
        console.error("[KanbanView] item link upsert failed", e),
      );
    },
    [getLinksForItem, createItemLink],
  );

  // #372: after a body save, soft-delete the inline-origin edges whose "[[ ]]"
  // link is no longer in the saved text.
  const handleBodySaved = useCallback(
    (fromId: string, content: string) => {
      void syncInlineLinks(fromId, content).catch((e) =>
        console.error("[KanbanView] inline link delete-sync failed", e),
      );
    },
    [syncInlineLinks],
  );

  return { loadLinkTargets, handleResolvedLinkInserted, handleBodySaved };
}
