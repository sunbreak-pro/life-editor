import { type DataService } from "@life-editor/shared";
import { useItemLinkTargets } from "../notes/useItemLinkTargets";
import { useInlineItemLinks } from "../hooks/useInlineItemLinks";

/*
 * "[[" link plumbing for the todo body (#507) — the todo-side twin of
 * useNoteLinking / DailyView's inline wiring.
 *
 * The todo detail editor shipped without any of it: the pool loader and the
 * navigate callback were simply never passed down, so typing "[[" opened no
 * menu and a link already in the text did nothing on click. That is a different
 * failure from #475 (which was a real bug inside the click path) — here the
 * path was fine and nothing was plugged into it. Putting the wiring in one hook
 * that all three surfaces can reach is what stops the next editor from being
 * added with the same hole.
 *
 * #776 finished that sentence: the graph half (edge write + save-time
 * delete-sync) now IS one implementation, `useInlineItemLinks`, which the three
 * surfaces share. What is left here is the todo-side assembly — the candidate
 * pool plus the host name the shared code puts in its console errors.
 *
 * No create-note row: like the Daily editor, the todo body links to EXISTING
 * items only (there is no "make a note from here" path to hang it on).
 */

export function useTodoLinking({ dataService }: { dataService?: DataService }) {
  // A LOADER, not a list — nothing is fetched until the first "[[" opens the
  // menu (#430: typing prose must not hit the network).
  const loadLinkTargets = useItemLinkTargets(dataService);

  // The Kanban is the only host of the todo body editor (both widths render
  // through its TodoDetailContent), so it is the name a failed write reports.
  // The surface's own name, for console errors. It said "KanbanView" until
  // #1153 retired that board — a tag copied along with the hook and then left
  // pointing at a file that no longer exists, which is precisely the failure
  // useInlineItemLinks takes `hostTag` as an argument to avoid.
  const { mirrorInlineLink, syncSavedBody } =
    useInlineItemLinks("ScheduleTodoDetail");

  return {
    loadLinkTargets,
    handleResolvedLinkInserted: mirrorInlineLink,
    handleBodySaved: syncSavedBody,
  };
}
