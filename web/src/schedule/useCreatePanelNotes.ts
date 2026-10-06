import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  generateId,
  goalPickerLabels,
  goalsForTodoPicker,
  logServiceError,
  todayDateKey,
  useGoalLinkSnapshot,
  useSyncDomains,
  useToastOptional,
  useTranslation,
  useWikiTagsUnifiedContext,
  type DataService,
  type ItemCreatePanelPools,
  type ItemCreateNoteDraft,
  type ItemCreateOption,
  type NoteNode,
  type TodoNode,
  type UndoRedoLike,
} from "@life-editor/shared";

/*
 * useCreatePanelNotes (#376) — the note half of the unified creation panel:
 * the pool its "existing note" picker offers, and the write that attaches the
 * staged note to whatever the panel just created.
 *
 * Why the host fetches instead of mounting NotesUnifiedProvider on the Schedule
 * branch: that Provider loads the whole note tree AND the note trash AND
 * hydrates bodies on selection, all of it re-run on every Realtime bump — a
 * heavy standing cost for a picker that shows titles and is open for seconds at
 * a time. This reads the list only while the panel is open. The DataService is
 * still injected (§3.1) — the hook never reaches for a module singleton.
 *
 * The link itself goes through the WikiTags Unified context (item↔item links —
 * `wiki_tag_connections`), which the Schedule branch already mounts. Direction
 * is item → note, matching DailyView: the thing with the date owns the link,
 * and the note sees it as a backlink.
 *
 * NOTE: `ScheduleItem.noteId` exists on the type but is DROPPED by the writer
 * (SupabaseDataService voids it — events↔notes are a link, not a column), so
 * the item-link model is the only way this attachment can persist.
 *
 * ORDERING (the trap #371 documented in `pendingItemLinks`):
 * `wiki_tag_connections.from_item_id` is an FK to `items_meta`, and the RLS
 * insert policy re-checks that row exists. The panel's create paths hand back
 * an OPTIMISTIC id and persist in the background, so "the item is in local
 * state" is not proof the row exists — issuing the link right after the create
 * call sends it BEFORE the item's own insert (both writers start with an
 * `auth.getUser()` round trip, and the link has no such prelude to lose to).
 * Hence `attachNote` is documented as save-confirmed-only and the callers wire
 * it to the create's `onSaved`.
 */

export interface UseCreatePanelNotesOptions {
  dataService: DataService;
  /** Load only while the creation panel is open. */
  active: boolean;
  /**
   * Told when a staged note did not make it onto the item. The write happens
   * after the panel has closed, so without this the user is left with an event
   * that quietly has no note attached.
   */
  onAttachError: () => void;
  /**
   * The global undo stack's push (#1638), optional as everywhere else. Used
   * by `attachNote` only: the note and its link get a command of their own
   * when the write they ride on cannot take them into its own (A-08 / B-04 —
   * the create's undo used to leave the note behind as an orphan). An event
   * create folds them into its command instead (`attachNoteAlongside`).
   */
  push?: UndoRedoLike["push"];
  /**
   * The host's live todo tree (#2109), for the goal field's progress numbers.
   * Also the opt-in for the goal field: omitted = no goals are read and
   * `goalPool` stays undefined, so a host that does not draw the field does
   * not pay for the goal and todo reads on every opening.
   */
  todos?: readonly TodoNode[];
}

/*
 * #2109 — the goal half. The panel's goal field (`pools.goals`) only
 * STAGES goals for the new todo; the links are written here, by `attachNote`,
 * because that is the call the todo create already makes once the todo's row
 * exists (the ORDERING note above applies to `goal_todo_links.todo_id` just
 * as it does to the note link). The staged ids sit in a ref, not state: they
 * are read once, at that call, and nothing on screen depends on the host's
 * copy — the panel draws its own.
 *
 * Known gap: a create whose save lands AFTER the panel was opened again loses
 * its staged goals (the reopen resets the ref). The failure is "not linked",
 * never "linked to the wrong goal".
 */

/** Notes offered by the picker: live notes, newest-touched first. */
function toOptions(notes: NoteNode[]): ItemCreateOption[] {
  return notes
    .filter((n) => !n.isDeleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((n) => ({ id: n.id, title: n.title }));
}

export function useCreatePanelNotes({
  dataService,
  active,
  onAttachError,
  push,
  todos,
}: UseCreatePanelNotesOptions) {
  const { t } = useTranslation();
  // Optional: reporting a failure must not itself throw without a Provider.
  const toast = useToastOptional();
  const syncVersion = useSyncDomains("notes");
  const { state: goalState, writeLinks } = useGoalLinkSnapshot(dataService, {
    active: active && todos !== undefined,
    todos,
  });
  const stagedGoalIdsRef = useRef<string[]>([]);
  // A new opening starts with nothing staged (the panel re-reports anyway).
  useEffect(() => {
    if (active) stagedGoalIdsRef.current = [];
  }, [active]);
  const onStagedChange = useCallback((ids: string[]) => {
    stagedGoalIdsRef.current = ids;
  }, []);
  const goalPool = useMemo<ItemCreatePanelPools["goals"]>(() => {
    if (!goalState) return undefined;
    // "This week" as the Briefing counts it: the day-start hour decides (§7).
    const goals = goalsForTodoPicker(goalState.goals, todayDateKey(), []);
    if (goals.length === 0) return undefined;
    return {
      goals,
      state: goalState,
      onStagedChange,
      labels: {
        ...goalPickerLabels((k) => t(k)),
        attach: t("goalLink.attach"),
        attached: t("goalLink.attached"),
      },
    };
  }, [goalState, onStagedChange, t]);
  const { createItemLink, deleteItemLink } = useWikiTagsUnifiedContext();
  // Kept across closes so re-opening the panel shows the last list at once;
  // the effect below refreshes it behind that.
  const [notes, setNotes] = useState<ItemCreateOption[]>([]);
  // Separate from `notes.length === 0`: "you have no notes" and "we could not
  // read your notes" look identical in an empty picker, and the first one is a
  // lie that sends the user off to create a duplicate.
  const [notesError, setNotesError] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void dataService
      .listNotesUnified()
      .then((rows) => {
        if (cancelled) return;
        setNotes(toOptions(rows));
        setNotesError(false);
      })
      // A failed fetch leaves the previous list. Creation of the event / todo
      // must not be blocked by the picker being unavailable.
      .catch((e) => {
        console.error("[Schedule] note list fetch failed", e);
        if (!cancelled) setNotesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dataService, active, syncVersion]);

  /**
   * Create the staged note if it is new, then link it to `itemId`, and hand
   * back the pair that reverses both — or null when nothing is left to
   * reverse (no draft, or the write failed and has been reported).
   *
   * CALL ONLY ONCE `itemId`'s ROW EXISTS (the create's `onSaved` / its
   * `alongside`, not its return value) — see the ORDERING note at the top of
   * this file. A failed attachment must not roll the item back, so it reports
   * through `onAttachError` instead of throwing.
   */
  const linkNote = useCallback(
    async (
      itemId: string,
      draft: ItemCreateNoteDraft | null,
    ): Promise<{
      undo: () => Promise<void>;
      redo: () => Promise<void>;
    } | null> => {
      if (!draft) return null;
      let createdNoteId: string | null = null;
      try {
        let noteId = draft.kind === "existing" ? draft.id : null;
        if (draft.kind === "new") {
          const now = new Date().toISOString();
          const id = generateId("note");
          await dataService.createNoteUnified({
            id,
            type: "note",
            title: draft.title,
            content: "",
            parentId: null,
            order: 0,
            isPinned: false,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          });
          noteId = id;
          createdNoteId = id;
        }
        if (!noteId) return null;
        const linkedNoteId = noteId;
        const link = await createItemLink(itemId, linkedNoteId);
        /*
         * #1638 (A-08): built once BOTH writes landed, so a failed attach
         * leaves nothing to undo. The undo drops the link and, for a note this
         * panel created, trashes the note as well — a note the user picked
         * from the list existed before and stays.
         *
         * The redo re-links rather than re-creating: the note row is restored,
         * so a second create would leave a duplicate behind.
         *
         * #1767: both closures re-throw. Swallowing the error left the closure
         * resolving, and `UndoRedoManager.apply` reads that as success: the
         * host stacked "Undid: ..." over the failure and sent a command that
         * never ran to the redo stack. A throwing undo stays put (#1668), so
         * re-throwing is also what keeps a second Ctrl+Z able to retry.
         *
         * #1642 P4 (N-06): and they say nothing themselves. The host's
         * `undoFailed` toast is the one report; `onAttachError` here made it
         * two danger toasts for one press, and its copy ("could not attach the
         * note") describes the forward press, not a reversal.
         */
        const trashOnUndo = createdNoteId;
        let liveLinkId = link.id;
        return {
          undo: async () => {
            try {
              await deleteItemLink(liveLinkId);
              if (trashOnUndo)
                await dataService.softDeleteNoteUnified(trashOnUndo);
            } catch (e) {
              console.error("[Schedule] undoing the note attach failed", e);
              throw e;
            }
          },
          redo: async () => {
            try {
              if (trashOnUndo)
                await dataService.restoreNoteUnified(trashOnUndo);
              liveLinkId = (await createItemLink(itemId, linkedNoteId)).id;
            } catch (e) {
              console.error("[Schedule] redoing the note attach failed", e);
              throw e;
            }
          },
        };
      } catch (e) {
        console.error("[Schedule] attaching the note failed", e);
        /*
         * #1642 P6 (N-09): a note this panel created a moment ago and could
         * not link is trashed again. It used to stay behind — a note nobody
         * asked for on its own, linked to nothing, with the toast as the only
         * trace of where it came from. Best-effort: the toast is owed either
         * way, and Trash still holds it if the soft-delete lands.
         */
        if (createdNoteId) {
          await dataService
            .softDeleteNoteUnified(createdNoteId)
            .catch((cleanupErr: unknown) =>
              console.error(
                "[Schedule] trashing the unlinked note failed",
                cleanupErr,
              ),
            );
        }
        onAttachError();
        return null;
      }
    },
    [dataService, createItemLink, deleteItemLink, onAttachError],
  );

  /**
   * Attach the staged note as its OWN history entry. For a write that is not
   * a create — placing an existing todo — or a create whose layer cannot fold
   * a companion in (the todo tree's).
   */
  const attachNote = useCallback(
    (itemId: string, draft: ItemCreateNoteDraft | null) => {
      // #2109: the staged goals ride the same call (todo paths only — the
      // event create goes through `attachNoteAlongside`, which never links
      // goals). No undo entry of their own: undoing the create trashes the
      // todo, and a trashed todo drops out of every goal's count.
      const goalIds = stagedGoalIdsRef.current;
      stagedGoalIdsRef.current = [];
      if (goalIds.length > 0) {
        void writeLinks(
          goalIds.map((goalId) => ({ goalId, todoId: itemId })),
          [],
        ).catch((e: unknown) => {
          logServiceError("Schedule", "link the new todo to its goals", e);
          // The panel has closed by now, so a toast is the only way the user
          // learns the todo is not counted toward the goals they picked.
          toast?.showToast("danger", t("goalLink.createLinkFailed"));
        });
      }
      if (!draft) return;
      void linkNote(itemId, draft).then((reversal) => {
        if (reversal)
          push?.("scheduleItem", { label: "createScheduleItem", ...reversal });
      });
    },
    [linkNote, push, writeLinks, toast, t],
  );

  /**
   * The same attach as the event create's companion (#1642 P6, N-08): the
   * reversal goes back to the create, which records the event and its note as
   * ONE command. As a second command it made the first Ctrl+Z take only the
   * note off while the toast said the event's creation had been undone.
   */
  const attachNoteAlongside = useCallback(
    (itemId: string, draft: ItemCreateNoteDraft | null) =>
      linkNote(itemId, draft),
    [linkNote],
  );

  return { notes, notesError, goalPool, attachNote, attachNoteAlongside };
}
