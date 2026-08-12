import { type DataService } from "@life-editor/shared";
import { useItemLinkTargets } from "../../notes/useItemLinkTargets";
import { useInlineItemLinks } from "../../hooks/useInlineItemLinks";

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
 * #776 finished that sentence: the graph half (edge write + save-time
 * delete-sync) now IS one implementation, `useInlineItemLinks`, which the three
 * surfaces share. What is left here is the task-side assembly — the candidate
 * pool plus the host name the shared code puts in its console errors.
 *
 * No create-note row: like the Daily editor, the task body links to EXISTING
 * items only (there is no "make a note from here" path to hang it on).
 */

export function useTaskLinking({ dataService }: { dataService?: DataService }) {
  // A LOADER, not a list — nothing is fetched until the first "[[" opens the
  // menu (#430: typing prose must not hit the network).
  const loadLinkTargets = useItemLinkTargets(dataService);

  // The Kanban is the only host of the task body editor (both widths render
  // through its renderTaskDetail), so it is the name a failed write reports.
  const { mirrorInlineLink, syncSavedBody } = useInlineItemLinks("KanbanView");

  return {
    loadLinkTargets,
    handleResolvedLinkInserted: mirrorInlineLink,
    handleBodySaved: syncSavedBody,
  };
}
