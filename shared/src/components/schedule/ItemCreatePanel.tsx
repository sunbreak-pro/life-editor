import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
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
import { AllDaySwitch } from "./AllDaySwitch";
import { isImeComposing } from "../../utils/imeGuard";

/*
 * ItemCreatePanel (#376) — the unified "add something to this day" panel behind
 * BOTH the Desktop creation overlay and the Mobile QuickCaptureSheet. It
 * supersedes <EventCreateFields> (#299), the event-only form those two frames
 * used to share.
 *
 * Two tabs, and both of them create something (#1370):
 *   - event: creates a ScheduleItem, exactly as before.
 *   - todo:  either creates a NEW TodoNode already scheduled into the target
 *            slot, or takes an EXISTING unscheduled todo and gives it that slot
 *            (Todos AC7). This is the timed sibling of the #298 "Today's Todo"
 *            tray: the tray declares "today, time TBD" (all-day staging), this
 *            panel says "this day, this time".
 *
 * Linking a note is NOT a third tab any more (#1370). It never created a note
 * of its own — it STAGES one (new or existing) to be linked to whatever the
 * panel creates — so sitting beside "event" and "todo" it read as a third
 * thing you could make, and reaching it hid the title field the submit
 * depends on. It is now a collapsible section BOTH tabs carry, below the
 * times and above the footer: "book the meeting, and have its minutes ready"
 * is still one pass, and the fields that pass depends on never leave the
 * screen. Collapsed by default — most creates attach nothing, and the note
 * picker is a list several rows tall.
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

/** Which tab is showing; it is also what the submit acts on (#1370). */
export type ItemCreateType = "event" | "task";
/** Within the todo tab and the note section: make a new one, or pick one that
 *  exists. */
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
  /** Already-translated aria-label for the shared item-title input. */
  title: string;
  /** Per-type placeholder for the item-title input. */
  eventPlaceholder: string;
  todoPlaceholder: string;
  /** Field label of the target-day input. */
  date: string;
  /** Label and accessible name of the all-day switch (#940). */
  allDay: string;
  startTime: string;
  endTime: string;
  /** Event submit pair (#354 — create, and create-then-open-the-editor). */
  addEvent: string;
  addEventAndOpen: string;
  /** Todo submit — one label per source, because the acts differ. */
  addTodo: string;
  placeTodo: string;
  /** Accessible name for the new / existing radiogroup (todo tab). */
  sourceLabel: string;
  sourceNew: string;
  sourceExisting: string;
  /** Todo picker. */
  searchTodos: string;
  /** Shown when the todo pool itself is empty (nothing left to place). */
  todoPickerEmpty: string;
  /** Shown when the todo search query matches nothing. */
  todoPickerNoMatch: string;
  /** Note attachment (#1370) — the collapsible section BOTH tabs carry. */
  /** Trigger label of that section, e.g. "Attach a note". */
  attachNote: string;
  /**
   * Accessible name for the note section's new / existing radiogroup, and its
   * two segment labels. Deliberately NOT `sourceLabel` / `sourceNew` /
   * `sourceExisting`: on the todo tab both radiogroups are on screen at once,
   * and two groups reading "How to add: New / From existing" would be one
   * ambiguous control as far as a screen reader is concerned.
   */
  noteSourceLabel: string;
  noteSourceNew: string;
  noteSourceExisting: string;
  noteTitleLabel: string;
  notePlaceholder: string;
  searchNotes: string;
  notePickerEmpty: string;
  notePickerNoMatch: string;
  /** Explains that the note rides along with the event / todo being created. */
  noteLinkHint: string;
  /** Heading of the staged-note row echoed once the section folds up. */
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
  /**
   * The day the item lands on (YYYY-MM-DD), seeding the panel's own date
   * field (#940).
   *
   * Required, and the reason `initial` itself became required: the panel used
   * to take a pre-formatted `dateLabel` it only displayed, so a host that
   * forgot it lost a caption. Now the value is what the submit carries, and a
   * host that forgot it would create items on no day at all.
   */
  date: string;
  /** Seeds the start-time field (HH:MM). Default 09:00. */
  start?: string;
  /** Seeds the end-time field (HH:MM). Default 10:00. */
  end?: string;
  /** Seeds the item-title field. Default empty. */
  title?: string;
}

/**
 * Where the new item lands — the panel's own answer, not the host's (#940).
 *
 * Bundled for the same reason the handlers were (#893): date / start / end /
 * isAllDay are one fact with four fields, and threading them positionally
 * through four callbacks is how a host ends up reading the day off its own
 * state and quietly ignoring the one the user just picked.
 */
export interface ItemCreateSlot {
  /** YYYY-MM-DD, as edited in the panel. */
  date: string;
  start: string;
  end: string;
  /**
   * True only on the event target — a todo has no all-day notion here, and
   * the switch is not rendered for it. When true the time fields are off
   * screen and `start` / `end` are stale draft values the host must ignore.
   */
  isAllDay: boolean;
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
  /** Fired with the trimmed (non-empty) title, the slot, and the staged note. */
  onSubmitEvent: (
    title: string,
    slot: ItemCreateSlot,
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
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /** Create a new todo scheduled into the chosen day + window. */
  onCreateTodo: (
    title: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /**
   * Give an EXISTING todo the target day + window. No "and open" twin: the
   * Schedule section has no todo detail editor (todo chips stay read-only
   * there — #297), so the follow-up the event pair offers has no counterpart.
   */
  onPlaceTodo: (
    todoId: string,
    slot: ItemCreateSlot,
    note: ItemCreateNoteDraft | null,
  ) => void;
}

export interface ItemCreatePanelProps {
  /**
   * Draft seeds. Required since #940 — see `ItemCreatePanelInitial.date`.
   *
   * The day used to arrive as a pre-formatted `dateLabel` the panel only
   * printed: where the user opened the panel WAS the day, so offering to
   * change it here would have contradicted the gesture. It turned out the
   * gesture is often only how the panel got opened — the toolbar「+」lands on
   * the anchor day, and Briefing always says today — leaving no way to book
   * next Tuesday without navigating there first. The row is now an input, and
   * the host reads the day back off the submit.
   */
  initial: ItemCreatePanelInitial;
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
  initial,
  pools,
  handlers,
  formatDuration,
  labels,
}: ItemCreatePanelProps) {
  // Unpacked back into the flat names the body has always used, so the bundles
  // (#893) stay a wire-format change and nothing below has to know about them.
  const {
    date: initialDate,
    start: initialStart = "09:00",
    end: initialEnd = "10:00",
    title: initialTitle = "",
  } = initial;
  const { todos: existingTodos, notes: existingNotes } = pools;
  const { onSubmitEvent, onSubmitEventAndOpen, onCreateTodo, onPlaceTodo } =
    handlers;
  const [type, setType] = useState<ItemCreateType>("event");
  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [allDay, setAllDay] = useState(false);

  const [todoSource, setTodoSource] = useState<ItemCreateSource>("new");
  const [todoQuery, setTodoQuery] = useState("");
  const [pickedTodoId, setPickedTodoId] = useState<string | null>(null);

  // Collapsed by default (#1370) — see the header. The staged-note state below
  // is independent of it, so folding the section up never drops the note.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteSource, setNoteSource] = useState<ItemCreateSource>("new");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(null);
  const noteSectionId = useId();

  const pickedTodo = resolvePicked(existingTodos, todoQuery, pickedTodoId);
  // By id alone, unlike the todo above: the note is staged, then the section
  // folds up and the user submits the event / todo. Dropping it because the
  // search box it was picked in still holds a narrower query would throw the
  // attachment away between picking it and using it.
  const pickedNote = pickedNoteId
    ? (existingNotes.find((o) => o.id === pickedNoteId) ?? null)
    : null;
  const placing = type === "task" && todoSource === "existing";

  // What rides along with the create. A blank new-note title stages nothing —
  // opening the section and changing your mind must not create an "Untitled".
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

  // All-day belongs to the event target alone (#940), so the switch is only
  // rendered there — and the slot spells the same rule, or turning it on and
  // then switching to the todo tab would smuggle it into a todo that has no
  // way to show it.
  const isAllDay = type === "event" && allDay;
  const slot: ItemCreateSlot = { date, start, end, isAllDay };

  const submitTitled = (
    handler: (
      t: string,
      s: ItemCreateSlot,
      n: ItemCreateNoteDraft | null,
    ) => void,
  ) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    handler(trimmed, slot, stagedNote);
  };
  const submitPrimary = () => {
    if (placing) {
      if (!pickedTodo) return;
      onPlaceTodo(pickedTodo.id, slot, stagedNote);
      return;
    }
    submitTitled(type === "event" ? onSubmitEvent : onCreateTodo);
  };
  // What the footer needs before it can act.
  const canSubmit = placing ? !!pickedTodo : !!title.trim();

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={[
          { id: "event", label: labels.typeEvent },
          { id: "task", label: labels.typeTodo },
        ]}
        value={type}
        onChange={(id) => setType(id as ItemCreateType)}
        label={labels.typeLabel}
      />
      {type === "task" && (
        <SegmentedToggle
          options={[
            { value: "new" as const, label: labels.sourceNew },
            { value: "existing" as const, label: labels.sourceExisting },
          ]}
          value={todoSource}
          onChange={setTodoSource}
          label={labels.sourceLabel}
        />
      )}
      {placing ? (
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
      {/* Date + all-day (#940), laid out and worded exactly like the editing
          side (EventEditorPane): same row, same switch, so "all day" does not
          become two different controls depending on whether the row exists
          yet. The date input keeps its own draft — changing it here books the
          item elsewhere without moving the calendar the panel was opened
          from. Clearing it back to blank restores the day the panel opened
          on, since a create with no date is not a thing the user can mean. */}
      <div className="flex items-end gap-3">
        {/* `min-w-0` matches EventEditorPane's row (#1036) — without it the
            date input's intrinsic width floors the flex item and the row
            resolves by overflowing to the right, taking the all-day switch
            with it. `appearance-none` + `min-w-0` on the input and the wider
            `gap-3` are #1403's half of the same fix (see the note there). */}
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.date}</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={() => {
              if (!date) setDate(initialDate);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isImeComposing(e)) submitPrimary();
            }}
            aria-label={labels.date}
            className={cn(FIELD, "min-w-0 appearance-none tabular-nums")}
          />
        </label>
        {type === "event" && (
          <AllDaySwitch
            checked={allDay}
            onToggle={() => setAllDay((v) => !v)}
            label={labels.allDay}
          />
        )}
      </div>
      {/* #553: the shared TimeRangeField replaces the native time pair —
          typed entry + snapped lists, and the range invariant lives there.
          Hidden rather than disabled while all-day is on, matching
          EventEditorPane: the switch that hides them keeps the focus, and a
          locked pair would leave the times looking authoritative while
          nothing reads them. */}
      {!isAllDay && (
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
      )}
      {/* Note attachment (#1370) — was a third tab; see the header. Placed
          last because it is the optional extra: the fields the submit needs
          stay at the top whether or not this is open. */}
      <div className="flex flex-col gap-2 border-t border-lumen-border pt-2">
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-expanded={noteOpen}
          aria-controls={noteSectionId}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-lumen-md px-1 py-1 text-left text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text",
            FOCUS_RING_TIGHT,
          )}
        >
          {noteOpen ? (
            <ChevronDown aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight aria-hidden className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{labels.attachNote}</span>
        </button>
        {noteOpen && (
          <div id={noteSectionId} className="flex flex-col gap-2">
            <SegmentedToggle
              options={[
                { value: "new" as const, label: labels.noteSourceNew },
                {
                  value: "existing" as const,
                  label: labels.noteSourceExisting,
                },
              ]}
              value={noteSource}
              onChange={setNoteSource}
              label={labels.noteSourceLabel}
            />
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
          </div>
        )}
        {/* Echoed exactly when the controls are off screen — the same rule the
            tab layout used, and what keeps "clear the selection" reachable
            after the section folds up. */}
        {stagedNote && !noteOpen && (
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
      </div>
      {/* The footer acts on the active tab; opening the note section leaves it
          alone. */}
      <div className="flex gap-2">
        {type === "event" ? (
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
