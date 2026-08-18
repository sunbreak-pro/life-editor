import { useCallback } from "react";
import {
  minutesToTime,
  type AddNodeOptions,
  type ItemCreateNoteDraft,
  type ItemCreateSlot,
  type ScheduleItem,
  type TodoNode,
  type TodoNodeType,
  type UpdateNodeOptions,
} from "@life-editor/shared";
import { timedPlacement, placeTodoWrite } from "./todoChipUndoWiring";
import type { ScheduleCreatePanel } from "./useScheduleOverlays";

/*
 * The creation panel's flow, lifted out of CalendarTab (#889).
 *
 * Four openers and five committers, and they are one concept rather than nine
 * handlers that happen to sit together: every opener seeds the same panel with
 * a target day + window, and every committer ends by running
 * `finishCreatePanel` — which is where the calendar lens gets cleared, and the
 * reason the whole set has to move together. Splitting "open" from "commit"
 * would leave that pairing implicit across two files.
 *
 * Three of the nine never leave this file: `openCreatePanel`,
 * `finishCreatePanel` and `scheduleTodoAt` had no call site outside the block
 * even while it lived in CalendarTab, so the hook returns the seven the JSX
 * actually asks for and keeps the rest private.
 *
 * None of this was reachable from a test before. CalendarTab needs the whole
 * Provider chain plus real layout to render (rules/frontend.md §テスト環境の制約,
 * D-20260812-refactor-2), so every decision made in here — which day a submit
 * lands on, whether the lens is cleared, whether the note waits for the real
 * id — was invisible to every gate we can afford to run. As a hook with plain
 * function args it renders under `renderHook` with no Provider at all.
 *
 * Deliberately NOT moved: `useCreatePanelNotes` and the toast that reports its
 * failures stay in CalendarTab and arrive here as `attachNote` /
 * `onAttachError`. That keeps the render's hook order unchanged and keeps this
 * file free of `useSyncDomains` / `useWikiTagsUnifiedContext`, which is what
 * makes it context-free and therefore testable.
 */

// Default duration (minutes) prefilled when creating from an empty-slot click.
const CREATE_DURATION_MIN = 60;

export interface UseScheduleCreateFlowArgs {
  /** null = the panel is closed. Gates every committer. */
  createPanel: ScheduleCreatePanel | null;
  setCreatePanel: (panel: ScheduleCreatePanel | null) => void;
  /** Opening the panel dismisses any open action bubble. */
  setPopover: (popover: null) => void;
  /** The day a toolbar / FAB press seeds the panel with. */
  anchorDate: string;
  /** Desktop selects the new row; narrow deliberately selects nothing. */
  isWide: boolean;
  setSelectedId: (id: string | null) => void;
  setOverlayOpen: (open: boolean) => void;
  /** Returns the OPTIMISTIC id, which is why the note waits for `onSaved`. */
  handleCreate: (
    slot: ItemCreateSlot,
    title: string,
    onSaved?: (saved: ScheduleItem | null) => void,
  ) => string;
  addNode: (
    type: TodoNodeType,
    parentId: string | null,
    title: string,
    options?: AddNodeOptions,
  ) => void;
  updateNode: (
    id: string,
    updates: Partial<TodoNode>,
    options?: UpdateNodeOptions,
  ) => void;
  /** From useCreatePanelNotes — the FK-ordering contract lives in its header. */
  attachNote: (itemId: string, draft: ItemCreateNoteDraft | null) => void;
  /** Reports a note that could not be attached because the row never landed. */
  onAttachError: () => void;
  /** Why every committer runs finishCreatePanel — see the #468 comment below. */
  clearCalendarLens: () => void;
}

/** The seven handlers the JSX asks for. The other three stay private. */
export interface ScheduleCreateFlowApi {
  handleToolbarAdd: () => void;
  handleGridCreateAt: (dateISO: string, minutes: number) => void;
  handleMonthCreate: (day: string) => void;
  handleCreateSubmit: (
    title: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
  handleCreateSubmitAndOpen: (
    title: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
  handleCreateTodoSubmit: (
    title: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
  handlePlaceTodoSubmit: (
    todoId: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
}

export function useScheduleCreateFlow({
  createPanel,
  setCreatePanel,
  setPopover,
  anchorDate,
  isWide,
  setSelectedId,
  setOverlayOpen,
  handleCreate,
  addNode,
  updateNode,
  attachNote,
  onAttachError,
  clearCalendarLens,
}: UseScheduleCreateFlowArgs): ScheduleCreateFlowApi {
  // #299 open the creation panel prefilled for a target day + time window.
  const openCreatePanel = useCallback(
    (date: string, start: string, end: string) => {
      setPopover(null);
      setCreatePanel({ date, start, end });
    },
    [setCreatePanel, setPopover],
  );
  // Toolbar "Add event" / Mobile FAB → default 09:00–10:00 on the anchor day.
  const handleToolbarAdd = useCallback(
    () => openCreatePanel(anchorDate, "09:00", "10:00"),
    [openCreatePanel, anchorDate],
  );
  // Empty-slot click (week/day grid) → prefill from the clicked slot time.
  const handleGridCreateAt = useCallback(
    (dateISO: string, minutes: number) =>
      openCreatePanel(
        dateISO,
        minutesToTime(minutes),
        minutesToTime(minutes + CREATE_DURATION_MIN),
      ),
    [openCreatePanel],
  );
  // Month-cell day click (Desktop) → default 09:00–10:00 on that day.
  const handleMonthCreate = useCallback(
    (day: string) => openCreatePanel(day, "09:00", "10:00"),
    [openCreatePanel],
  );

  // #468: every panel path that actually PUTS something on the grid closes
  // through here, and clearing the lens is the point. A brand-new row carries
  // no tag, so while a calendar lens is on it is filtered out the instant it
  // exists — no block on the grid, no toast, and any selection made below
  // points at something nobody can see. The add button reads as broken.
  // Showing the thing that was just created is what the click asked for;
  // auto-filing it into the active calendar would be a write the user never
  // asked for.
  //
  // Placing an EXISTING todo gets the same treatment: it only survives the lens
  // if it already carries that calendar's tag, so otherwise it disappears from
  // the very slot it was just dropped into.
  //
  // Cancelling the panel deliberately does NOT come through here (those call
  // sites keep the bare setCreatePanel(null)): nothing new is on the grid to
  // reveal, so the lens the user set stays where they put it.
  const finishCreatePanel = useCallback(() => {
    setCreatePanel(null);
    clearCalendarLens();
  }, [setCreatePanel, clearCalendarLens]);

  // #299 create-panel submit: the panel carries the target day; the fields hand
  // over the trimmed title + times. Reuses the mutation layer's single create.
  //
  // #354: the new row's id was previously dropped on the floor, so nothing on
  // screen pointed at what had just been created and the memo / repeat fields
  // (which live in the detail editor, not this panel) were unreachable without
  // hunting for the item on the grid. The panel now offers both intents.
  const handleCreateSubmit = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      if (!createPanel) return;
      // #376: the note rides along with the create, but only once the row is
      // really there — `wiki_tag_connections` carries an FK to `items_meta`,
      // and the id handleCreate returns is the optimistic one (see the
      // ORDERING note in useCreatePanelNotes).
      const id = handleCreate(slot, title, (saved) => {
        if (saved) attachNote(saved.id, note);
        else if (note) onAttachError();
      });
      finishCreatePanel();
      // Desktop: select without opening anything — a quiet "here it is" that
      // does not interrupt blocking out the next slot. It shows as a ring on
      // the week/day grid (WeekTimeGrid) and a highlight in the sidebar
      // agenda; MonthGrid takes no selectedId, so month-cell creation gets no
      // marker (matching the pre-#354 behaviour there).
      // Mobile deliberately selects NOTHING: there, selection IS the detail
      // sheet (`editorPane` derives from it), so selecting would silently turn
      // the plain create into the other button.
      if (isWide) setSelectedId(id);
    },
    [
      createPanel,
      handleCreate,
      attachNote,
      onAttachError,
      isWide,
      // Stable in the host (a useState setter), but an ARG here, so eslint can
      // no longer see that for itself (#889).
      setSelectedId,
      finishCreatePanel,
    ],
  );

  // #354 secondary action: create, then land in the detail editor.
  const handleCreateSubmitAndOpen = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      if (!createPanel) return;
      const id = handleCreate(slot, title, (saved) => {
        if (saved) attachNote(saved.id, note);
        else if (note) onAttachError();
      });
      // Clears the lens too: the overlay hides the grid at first, but closing
      // it would otherwise drop the user back on a grid that does not draw the
      // row their selection still points at.
      finishCreatePanel();
      setSelectedId(id);
      // Desktop opens the body-level overlay; on Mobile the selection alone
      // brings up the BottomSheet editor (the same path a tap takes).
      if (isWide) setOverlayOpen(true);
    },
    [
      createPanel,
      handleCreate,
      attachNote,
      onAttachError,
      isWide,
      setSelectedId,
      finishCreatePanel,
      setOverlayOpen,
    ],
  );

  // #376 todo tab — the timed counterpart of the #298 tray. The tray stages a
  // todo as "today, time TBD" (all-day); this panel commits it to a concrete
  // day + window, which is what makes it show up as a placed block rather than
  // an all-day candidate (the shape itself: todoChipUndoWiring.timedPlacement).
  //
  // The day comes off the slot, not off `createPanel` (#940): the panel's date
  // field is what the user last said, and the gesture that opened it is only
  // the seed. `createPanel` still gates the call — a submit with the panel
  // closed is not a thing — but it no longer decides the day.
  const scheduleTodoAt = useCallback(
    (slot: ItemCreateSlot) => {
      if (!createPanel) return null;
      return timedPlacement(slot.date, slot.start, slot.end);
    },
    [createPanel],
  );

  const handleCreateTodoSubmit = useCallback(
    (title: string, slot: ItemCreateSlot, note: ItemCreateNoteDraft | null) => {
      const placement = scheduleTodoAt(slot);
      if (!placement) return;
      // Root-level todo (parentId null), matching every other "quick create"
      // entry — the panel carries no place-in-the-tree control, and the Todos
      // section is where re-parenting belongs.
      addNode("task", null, title, {
        ...placement,
        // Same ordering rule as the event path: the node is optimistic until
        // the tree sync lands, and the guard in useTodoTreeAPI can drop the
        // write entirely (tree not loaded), which reports `null` here.
        onSaved: (saved) => {
          if (saved) attachNote(saved.id, note);
          else if (note) onAttachError();
        },
      });
      finishCreatePanel();
    },
    [scheduleTodoAt, addNode, attachNote, onAttachError, finishCreatePanel],
  );

  const handlePlaceTodoSubmit = useCallback(
    (
      todoId: string,
      slot: ItemCreateSlot,
      note: ItemCreateNoteDraft | null,
    ) => {
      if (!createPanel) return;
      // Undoable only when no note rides along (#569): a note attaches a
      // separate link row this panel has no un-write for, and an undo that
      // moved the todo back while leaving the note on it would be a half
      // reversal the toast claims was whole. See placeTodoWrite.
      const { patch, options } = placeTodoWrite(
        slot.date,
        slot.start,
        slot.end,
        note != null,
      );
      updateNode(todoId, patch, options);
      // No onSaved wait here, unlike the create paths: this todo was picked
      // out of a pool that came from the DB, so its `items_meta` row is
      // already there and the link's FK is satisfied right now.
      attachNote(todoId, note);
      finishCreatePanel();
    },
    [createPanel, updateNode, attachNote, finishCreatePanel],
  );

  return {
    handleToolbarAdd,
    handleGridCreateAt,
    handleMonthCreate,
    handleCreateSubmit,
    handleCreateSubmitAndOpen,
    handleCreateTodoSubmit,
    handlePlaceTodoSubmit,
  };
}
