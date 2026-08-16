import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../cn";
import {
  FIELD,
  FIELD_LABEL,
  FOCUS_RING_ON_ACCENT,
  FOCUS_RING_TIGHT,
} from "../styleTokens";
import { SegmentedControl } from "../SegmentedControl";
import { SegmentedToggle } from "../SegmentedToggle";
import { TimeRangeField } from "../TimeRangeField";
import { isImeComposing } from "../../utils/imeGuard";

/*
 * ItemCreatePanel (#376) — the unified "add something to this day" panel behind
 * BOTH the Desktop creation overlay and the Mobile QuickCaptureSheet. It
 * supersedes <EventCreateFields> (#299), the event-only form those two frames
 * used to share.
 *
 * Three tabs, but only TWO of them create something:
 *   - event: creates a ScheduleItem, exactly as before.
 *   - todo:  either creates a NEW TodoNode already scheduled into the target
 *            slot, or takes an EXISTING unscheduled todo and gives it that slot
 *            (Todos AC7). This is the timed sibling of the #298 "Today's Todo"
 *            tray: the tray declares "today, time TBD" (all-day staging), this
 *            panel says "this day, this time".
 *   - note:  STAGES a note (new or existing) to be linked to whatever the panel
 *            creates — "book the meeting, and have its minutes ready" in one
 *            pass. A note has no time of its own, so it cannot be a creation
 *            target here; the submit stays the event/todo one and the panel
 *            remembers which of the two was last chosen (`target`).
 *
 * The item title and the times are shared across the event/todo tabs on purpose
 * — realising halfway through that "歯医者" is a todo rather than an event
 * should not cost the typing. The note's own title is separate state, since it
 * names a different thing.
 *
 * Pure presentation (§3.1 / §6.4): copy injected already translated, every write
 * is a callback; lumen-* tokens only (§5). Enter in a text field submits the
 * active target's plain create (IME composition respected — §frontend gotcha); a
 * blank title, or no selection in a picker, is a no-op.
 *
 * Both host frames (Modal / BottomSheet) unmount their children when closed, so
 * the local draft state re-seeds from the initial props on every open. When a
 * host keeps the panel open but changes the prefill (e.g. a different empty
 * slot), it should remount this with a `key` derived from the prefill.
 */

/** Which tab is showing. Only `event` / `task` can be a creation target. */
export type ItemCreateType = "event" | "task" | "note";
/** Within the todo and note tabs: make a new one, or pick one that exists. */
export type ItemCreateSource = "new" | "existing";

/** One row of a picker (an existing todo, or an existing note). */
export interface ItemCreateOption {
  /** Source TodoNode / NoteNode id. */
  id: string;
  title: string;
}

/**
 * The note the panel will link to the item it creates. `new` still needs
 * creating (the host owns the write); `existing` is already an item id.
 * `null` at submit time means the user staged nothing.
 */
export type ItemCreateNoteDraft =
  { kind: "new"; title: string } | { kind: "existing"; id: string };

export interface ItemCreatePanelLabels {
  /** Already-translated accessible name for the item-type tablist. */
  typeLabel: string;
  typeEvent: string;
  typeTodo: string;
  typeNote: string;
  /** Already-translated aria-label for the shared item-title input. */
  title: string;
  /** Per-type placeholder for the item-title input. */
  eventPlaceholder: string;
  todoPlaceholder: string;
  /** Field label of the read-only target-day row. */
  date: string;
  startTime: string;
  endTime: string;
  /** Event submit pair (#354 — create, and create-then-open-the-editor). */
  addEvent: string;
  addEventAndOpen: string;
  /** Todo submit — one label per source, because the acts differ. */
  addTodo: string;
  placeTodo: string;
  /** Accessible name for the new / existing radiogroup (todo and note tabs). */
  sourceLabel: string;
  sourceNew: string;
  sourceExisting: string;
  /** Todo picker. */
  searchTodos: string;
  /** Shown when the todo pool itself is empty (nothing left to place). */
  todoPickerEmpty: string;
  /** Shown when the todo search query matches nothing. */
  todoPickerNoMatch: string;
  /** Note tab. */
  noteTitleLabel: string;
  notePlaceholder: string;
  searchNotes: string;
  notePickerEmpty: string;
  notePickerNoMatch: string;
  /** Explains that the note rides along with the event / todo being created. */
  noteLinkHint: string;
  /** Heading of the staged-note row shown on the event / todo tabs. */
  attachedNote: string;
  /** Accessible name for the button that unstages the note. */
  clearNote: string;
}

/**
 * Seed values for the panel's own draft state. One bundle rather than three
 * `initial*` props (#893): they are read ONCE, at mount, and only ever travel
 * together — a host that seeds the times but not the title is passing the same
 * "where the gesture landed" fact, just partially.
 */
export interface ItemCreatePanelInitial {
  /** Seeds the start-time field (HH:MM). Default 09:00. */
  start?: string;
  /** Seeds the end-time field (HH:MM). Default 10:00. */
  end?: string;
  /** Seeds the item-title field. Default empty. */
  title?: string;
}

/** The two "pick an existing one" pools the panel offers. */
export interface ItemCreatePanelPools {
  /**
   * The pool the "existing todo" source picks from — the host's unscheduled,
   * incomplete leaf todos (`pickAddableTodos`, the same pool the #298 tray
   * offers). Already-scheduled todos are deliberately absent: re-timing one is
   * a drag on the grid, not a create gesture.
   */
  todos: ItemCreateOption[];
  /** The pool the "existing note" source picks from (live notes). */
  notes: ItemCreateOption[];
}

/**
 * Every write the panel can perform. Bundled (#893) because they are ONE
 * capability, not four independent ones: a host that wires three of them ships
 * a submit button that silently does nothing on the fourth tab, and the
 * required-object shape makes that a compile error instead.
 */
export interface ItemCreatePanelHandlers {
  /** Fired with the trimmed (non-empty) title, the times, and the staged note. */
  onSubmitEvent: (
    title: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /**
   * Same payload as `onSubmitEvent`, but the host should follow the write by
   * opening the new item's detail editor (#354).
   *
   * Two buttons rather than one policy: creating an event and filling in a
   * memo / repeat rule are different intents. Blocking on the editor every
   * time punishes the common case (blocking out several slots in a row),
   * while never opening it strands the other one — the panel only carries
   * title + times. Enter keeps the plain create, so the fast path stays fast.
   */
  onSubmitEventAndOpen: (
    title: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /** Create a new todo scheduled into the target day + window. */
  onCreateTodo: (
    title: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /**
   * Give an EXISTING todo the target day + window. No "and open" twin: the
   * Schedule section has no todo detail editor (todo chips stay read-only
   * there — #297), so the follow-up the event pair offers has no counterpart.
   */
  onPlaceTodo: (
    todoId: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
}

export interface ItemCreatePanelProps {
  /**
   * The day the item will land on, already formatted for display (#353).
   * The host owns the target date and the locale (§6.4), so it hands the
   * finished string down. Read-only: the day comes from where the user
   * opened the panel (toolbar → anchor day, empty slot / month cell → that
   * cell's day), and changing it here would contradict that gesture.
   *
   * Optional because it tracks the host's OPEN-PANEL STATE, not its
   * capabilities: with the panel closed there is no target day, and the
   * Mobile frame (QuickCaptureSheet) stays mounted across that transition.
   * `labels.date` is required precisely so a host cannot forget the row
   * exists — only the value comes and goes. Absent ⇒ the row is skipped
   * rather than rendered empty.
   */
  dateLabel?: string;
  /** Draft seeds, all optional. Omit entirely for the defaults. */
  initial?: ItemCreatePanelInitial;
  pools: ItemCreatePanelPools;
  handlers: ItemCreatePanelHandlers;
  /** Formats the duration suffix on the end-time options (#553). */
  formatDuration?: (minutes: number) => string;
  labels: ItemCreatePanelLabels;
}

// `disabled:` states matter more here than on a normal form: the note tab hides
// the field the submit depends on, so a dead-but-lit button would give the user
// nothing to look at when a click does nothing.
const DISABLED_BTN = "disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN = `flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover ${FOCUS_RING_ON_ACCENT} ${DISABLED_BTN}`;
const SECONDARY_BTN = `flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent ${DISABLED_BTN}`;
const HINT = "py-3 text-center text-xs text-lumen-text-secondary";

/**
 * Search field + single-select list, shared by the todo and note pickers.
 * Capped height with its own scroll: a pool is the whole backlog, and letting
 * it grow would push the times and the submit button out of a Mobile sheet.
 */
function PickerList({
  options,
  query,
  onQueryChange,
  pickedId,
  onPick,
  searchLabel,
  emptyLabel,
  noMatchLabel,
}: {
  options: ItemCreateOption[];
  query: string;
  onQueryChange: (value: string) => void;
  pickedId: string | null;
  onPick: (id: string) => void;
  searchLabel: string;
  emptyLabel: string;
  noMatchLabel: string;
}) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.title.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
        className={FIELD}
      />
      {options.length === 0 ? (
        <p className={HINT}>{emptyLabel}</p>
      ) : matches.length === 0 ? (
        <p className={HINT}>{noMatchLabel}</p>
      ) : (
        <ul
          role="listbox"
          className="max-h-44 overflow-y-auto rounded-lumen-md border border-lumen-border"
        >
          {matches.map((option) => (
            // `presentation` on the <li> so the button is the listbox's
            // effective child: single-select semantics, not a row of toggles.
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={pickedId === option.id}
                onClick={() => onPick(option.id)}
                className={cn(
                  "flex w-full items-center border-b border-lumen-border px-2.5 py-2 text-left text-sm transition-colors last:border-b-0",
                  pickedId === option.id
                    ? "bg-lumen-accent-subtle text-lumen-accent"
                    : "text-lumen-text hover:bg-lumen-hover",
                  FOCUS_RING_TIGHT,
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Resolve the TODO selection THROUGH the current query, so narrowing past the
 * picked row drops it from both the highlight and the submit — the picked todo
 * IS what the submit acts on, and acting on something the user can no longer
 * see would be a silent surprise.
 *
 * The note picker deliberately does NOT go through this (see `pickedNote`): a
 * staged note is carried across tabs and shown back as a chip, so it stays
 * visible after the query moves on.
 */
function resolvePicked(
  options: ItemCreateOption[],
  query: string,
  pickedId: string | null,
): ItemCreateOption | null {
  if (!pickedId) return null;
  const q = query.trim().toLowerCase();
  const found = options.find((o) => o.id === pickedId);
  if (!found) return null;
  return !q || found.title.toLowerCase().includes(q) ? found : null;
}

export function ItemCreatePanel({
  dateLabel,
  initial,
  pools,
  handlers,
  formatDuration,
  labels,
}: ItemCreatePanelProps) {
  // Unpacked back into the flat names the body has always used, so the bundles
  // (#893) stay a wire-format change and nothing below has to know about them.
  const {
    start: initialStart = "09:00",
    end: initialEnd = "10:00",
    title: initialTitle = "",
  } = initial ?? {};
  const { todos: existingTodos, notes: existingNotes } = pools;
  const { onSubmitEvent, onSubmitEventAndOpen, onCreateTodo, onPlaceTodo } =
    handlers;
  const [type, setType] = useState<ItemCreateType>("event");
  // The note tab creates nothing, so the submit keeps acting on whichever of
  // event / todo was last open. Without this the footer would have nothing to
  // do while the note tab is showing.
  const [target, setTarget] = useState<"event" | "task">("event");
  const [title, setTitle] = useState(initialTitle);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const [todoSource, setTodoSource] = useState<ItemCreateSource>("new");
  const [todoQuery, setTodoQuery] = useState("");
  const [pickedTodoId, setPickedTodoId] = useState<string | null>(null);

  const [noteSource, setNoteSource] = useState<ItemCreateSource>("new");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(null);

  const selectType = (next: ItemCreateType) => {
    setType(next);
    if (next !== "note") setTarget(next);
  };

  const pickedTodo = resolvePicked(existingTodos, todoQuery, pickedTodoId);
  // By id alone, unlike the todo above: the note is staged, then the user
  // leaves for the event / todo tab to actually submit. Dropping it because
  // the search box it was picked in still holds a narrower query would throw
  // the attachment away between picking it and using it.
  const pickedNote = pickedNoteId
    ? (existingNotes.find((o) => o.id === pickedNoteId) ?? null)
    : null;
  const placing = target === "task" && todoSource === "existing";

  // What rides along with the create. A blank new-note title stages nothing —
  // opening the note tab and changing your mind must not create an "Untitled".
  const stagedNoteTitle =
    noteSource === "new" ? noteTitle.trim() : (pickedNote?.title ?? "");
  const stagedNote: ItemCreateNoteDraft | null =
    noteSource === "new"
      ? stagedNoteTitle
        ? { kind: "new", title: stagedNoteTitle }
        : null
      : pickedNote
        ? { kind: "existing", id: pickedNote.id }
        : null;
  const clearNote = () => {
    if (noteSource === "new") setNoteTitle("");
    else setPickedNoteId(null);
  };

  const submitTitled = (
    handler: (
      t: string,
      s: string,
      e: string,
      n: ItemCreateNoteDraft | null,
    ) => void,
  ) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    handler(trimmed, start, end, stagedNote);
  };
  const submitPrimary = () => {
    if (placing) {
      if (!pickedTodo) return;
      onPlaceTodo(pickedTodo.id, start, end, stagedNote);
      return;
    }
    submitTitled(target === "event" ? onSubmitEvent : onCreateTodo);
  };
  // What the footer needs before it can act. Read on the note tab too, where
  // neither the title field nor the todo picker is on screen.
  const canSubmit = placing ? !!pickedTodo : !!title.trim();

  const source = type === "note" ? noteSource : todoSource;
  const setSource = type === "note" ? setNoteSource : setTodoSource;

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={[
          { id: "event", label: labels.typeEvent },
          { id: "task", label: labels.typeTodo },
          { id: "note", label: labels.typeNote },
        ]}
        value={type}
        onChange={(id) => selectType(id as ItemCreateType)}
        label={labels.typeLabel}
      />
      {type !== "event" && (
        <SegmentedToggle
          options={[
            { value: "new" as const, label: labels.sourceNew },
            { value: "existing" as const, label: labels.sourceExisting },
          ]}
          value={source}
          onChange={setSource}
          label={labels.sourceLabel}
        />
      )}
      {type === "note" ? (
        <>
          {noteSource === "new" ? (
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isImeComposing(e)) submitPrimary();
              }}
              placeholder={labels.notePlaceholder}
              aria-label={labels.noteTitleLabel}
              className={FIELD}
            />
          ) : (
            <PickerList
              options={existingNotes}
              query={noteQuery}
              onQueryChange={setNoteQuery}
              pickedId={pickedNote?.id ?? null}
              onPick={setPickedNoteId}
              searchLabel={labels.searchNotes}
              emptyLabel={labels.notePickerEmpty}
              noMatchLabel={labels.notePickerNoMatch}
            />
          )}
          {/* The note is an attachment, not a target — say so, or the submit
              button below ("Add event") reads like a mistake. */}
          <p className="text-xs text-lumen-text-secondary">
            {labels.noteLinkHint}
          </p>
        </>
      ) : placing ? (
        <PickerList
          options={existingTodos}
          query={todoQuery}
          onQueryChange={setTodoQuery}
          pickedId={pickedTodo?.id ?? null}
          onPick={setPickedTodoId}
          searchLabel={labels.searchTodos}
          emptyLabel={labels.todoPickerEmpty}
          noMatchLabel={labels.todoPickerNoMatch}
        />
      ) : (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isImeComposing(e)) submitPrimary();
          }}
          placeholder={
            type === "event" ? labels.eventPlaceholder : labels.todoPlaceholder
          }
          aria-label={labels.title}
          className={FIELD}
        />
      )}
      {/* Staged note, echoed on the event / todo tabs: the note tab is one
          click away, so without this the attachment would be invisible at the
          moment the user commits to it. */}
      {stagedNote && type !== "note" && (
        <div className="flex items-center gap-2 rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2.5 py-1.5">
          <span className={cn("shrink-0", FIELD_LABEL)}>
            {labels.attachedNote}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-lumen-text">
            {stagedNoteTitle}
          </span>
          <button
            type="button"
            aria-label={labels.clearNote}
            onClick={clearNote}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
              FOCUS_RING_TIGHT,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
      {dateLabel && (
        <div className={cn("flex flex-col gap-1", FIELD_LABEL)}>
          {labels.date}
          {/* Read-only, so a <p> rather than a disabled input: it is context
              for the times below, not something the user can act on. */}
          <p className="text-sm font-medium text-lumen-text">{dateLabel}</p>
        </div>
      )}
      {/* #553: the shared TimeRangeField replaces the native time pair —
          typed entry + snapped lists, and the range invariant lives there. */}
      <TimeRangeField
        start={start}
        end={end}
        onChange={(next) => {
          setStart(next.start);
          setEnd(next.end);
        }}
        labels={{ start: labels.startTime, end: labels.endTime }}
        formatDuration={formatDuration}
      />
      {/* The footer always acts on `target`, so it survives a trip to the note
          tab unchanged. */}
      <div className="flex gap-2">
        {target === "event" ? (
          <>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submitTitled(onSubmitEvent)}
              className={PRIMARY_BTN}
            >
              {labels.addEvent}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submitTitled(onSubmitEventAndOpen)}
              className={SECONDARY_BTN}
            >
              {labels.addEventAndOpen}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submitPrimary}
            className={PRIMARY_BTN}
          >
            {placing ? labels.placeTodo : labels.addTodo}
          </button>
        )}
      </div>
    </div>
  );
}
