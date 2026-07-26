import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "../cn";
import { FIELD, FIELD_LABEL, FOCUS_RING_TIGHT } from "../styleTokens";
import { SegmentedControl } from "../SegmentedControl";
import { SegmentedToggle } from "../SegmentedToggle";

/*
 * ItemCreatePanel (#376) — the unified "add something to this day" panel behind
 * BOTH the Desktop creation overlay and the Mobile QuickCaptureSheet. It
 * supersedes <EventCreateFields> (#299), the event-only form those two frames
 * used to share.
 *
 * Three tabs, but only TWO of them create something:
 *   - event: creates a ScheduleItem, exactly as before.
 *   - task:  either creates a NEW TaskNode already scheduled into the target
 *            slot, or takes an EXISTING unscheduled task and gives it that slot
 *            (Tasks AC7). This is the timed sibling of the #298 "Today's Todo"
 *            tray: the tray declares "today, time TBD" (all-day staging), this
 *            panel says "this day, this time".
 *   - note:  STAGES a note (new or existing) to be linked to whatever the panel
 *            creates — "book the meeting, and have its minutes ready" in one
 *            pass. A note has no time of its own, so it cannot be a creation
 *            target here; the submit stays the event/task one and the panel
 *            remembers which of the two was last chosen (`target`).
 *
 * The item title and the times are shared across the event/task tabs on purpose
 * — realising halfway through that "歯医者" is a task rather than an event
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
/** Within the task and note tabs: make a new one, or pick one that exists. */
export type ItemCreateSource = "new" | "existing";

/** One row of a picker (an existing task, or an existing note). */
export interface ItemCreateOption {
  /** Source TaskNode / NoteNode id. */
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
  typeTask: string;
  typeNote: string;
  /** Already-translated aria-label for the shared item-title input. */
  title: string;
  /** Per-type placeholder for the item-title input. */
  eventPlaceholder: string;
  taskPlaceholder: string;
  /** Field label of the read-only target-day row. */
  date: string;
  startTime: string;
  endTime: string;
  /** Event submit pair (#354 — create, and create-then-open-the-editor). */
  addEvent: string;
  addEventAndOpen: string;
  /** Task submit — one label per source, because the acts differ. */
  addTask: string;
  placeTask: string;
  /** Accessible name for the new / existing radiogroup (task and note tabs). */
  sourceLabel: string;
  sourceNew: string;
  sourceExisting: string;
  /** Task picker. */
  searchTasks: string;
  /** Shown when the task pool itself is empty (nothing left to place). */
  taskPickerEmpty: string;
  /** Shown when the task search query matches nothing. */
  taskPickerNoMatch: string;
  /** Note tab. */
  noteTitleLabel: string;
  notePlaceholder: string;
  searchNotes: string;
  notePickerEmpty: string;
  notePickerNoMatch: string;
  /** Explains that the note rides along with the event / task being created. */
  noteLinkHint: string;
  /** Heading of the staged-note row shown on the event / task tabs. */
  attachedNote: string;
  /** Accessible name for the button that unstages the note. */
  clearNote: string;
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
  /** Seeds the start-time field (HH:MM). Default 09:00. */
  initialStart?: string;
  /** Seeds the end-time field (HH:MM). Default 10:00. */
  initialEnd?: string;
  /** Seeds the item-title field. Default empty. */
  initialTitle?: string;
  /**
   * The pool the "existing task" source picks from — the host's unscheduled,
   * incomplete leaf tasks (`pickAddableTasks`, the same pool the #298 tray
   * offers). Already-scheduled tasks are deliberately absent: re-timing one is
   * a drag on the grid, not a create gesture.
   */
  existingTasks: ItemCreateOption[];
  /** The pool the "existing note" source picks from (live notes, no folders). */
  existingNotes: ItemCreateOption[];
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
  /** Create a new task scheduled into the target day + window. */
  onCreateTask: (
    title: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
  /**
   * Give an EXISTING task the target day + window. No "and open" twin: the
   * Schedule section has no task detail editor (task chips stay read-only
   * there — #297), so the follow-up the event pair offers has no counterpart.
   */
  onPlaceTask: (
    taskId: string,
    start: string,
    end: string,
    note: ItemCreateNoteDraft | null,
  ) => void;
  labels: ItemCreatePanelLabels;
}

const PRIMARY_BTN =
  "flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";
const SECONDARY_BTN =
  "flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const HINT = "py-3 text-center text-xs text-lumen-text-secondary";

/**
 * Search field + single-select list, shared by the task and note pickers.
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
          role="list"
          className="max-h-44 overflow-y-auto rounded-lumen-md border border-lumen-border"
        >
          {matches.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={pickedId === option.id}
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
 * Resolve a picker selection THROUGH the current query, so narrowing past the
 * picked row drops it from both the highlight and the submit — acting on
 * something the user can no longer see would be a silent surprise.
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
  initialStart = "09:00",
  initialEnd = "10:00",
  initialTitle = "",
  existingTasks,
  existingNotes,
  onSubmitEvent,
  onSubmitEventAndOpen,
  onCreateTask,
  onPlaceTask,
  labels,
}: ItemCreatePanelProps) {
  const [type, setType] = useState<ItemCreateType>("event");
  // The note tab creates nothing, so the submit keeps acting on whichever of
  // event / task was last open. Without this the footer would have nothing to
  // do while the note tab is showing.
  const [target, setTarget] = useState<"event" | "task">("event");
  const [title, setTitle] = useState(initialTitle);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const [taskSource, setTaskSource] = useState<ItemCreateSource>("new");
  const [taskQuery, setTaskQuery] = useState("");
  const [pickedTaskId, setPickedTaskId] = useState<string | null>(null);

  const [noteSource, setNoteSource] = useState<ItemCreateSource>("new");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [pickedNoteId, setPickedNoteId] = useState<string | null>(null);

  const selectType = (next: ItemCreateType) => {
    setType(next);
    if (next !== "note") setTarget(next);
  };

  const pickedTask = resolvePicked(existingTasks, taskQuery, pickedTaskId);
  const pickedNote = resolvePicked(existingNotes, noteQuery, pickedNoteId);
  const placing = target === "task" && taskSource === "existing";

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
      if (!pickedTask) return;
      onPlaceTask(pickedTask.id, start, end, stagedNote);
      return;
    }
    submitTitled(target === "event" ? onSubmitEvent : onCreateTask);
  };

  const source = type === "note" ? noteSource : taskSource;
  const setSource = type === "note" ? setNoteSource : setTaskSource;

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={[
          { id: "event", label: labels.typeEvent },
          { id: "task", label: labels.typeTask },
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
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  submitPrimary();
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
          options={existingTasks}
          query={taskQuery}
          onQueryChange={setTaskQuery}
          pickedId={pickedTask?.id ?? null}
          onPick={setPickedTaskId}
          searchLabel={labels.searchTasks}
          emptyLabel={labels.taskPickerEmpty}
          noMatchLabel={labels.taskPickerNoMatch}
        />
      ) : (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing)
              submitPrimary();
          }}
          placeholder={
            type === "event" ? labels.eventPlaceholder : labels.taskPlaceholder
          }
          aria-label={labels.title}
          className={FIELD}
        />
      )}
      {/* Staged note, echoed on the event / task tabs: the note tab is one
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
      <div className="flex gap-2">
        <label className={cn("flex flex-1 flex-col gap-1", FIELD_LABEL)}>
          {labels.startTime}
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label={labels.startTime}
            className={`${FIELD} tabular-nums`}
          />
        </label>
        <label className={cn("flex flex-1 flex-col gap-1", FIELD_LABEL)}>
          {labels.endTime}
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-label={labels.endTime}
            className={`${FIELD} tabular-nums`}
          />
        </label>
      </div>
      {/* The footer always acts on `target`, so it survives a trip to the note
          tab unchanged. */}
      <div className="flex gap-2">
        {target === "event" ? (
          <>
            <button
              type="button"
              onClick={() => submitTitled(onSubmitEvent)}
              className={PRIMARY_BTN}
            >
              {labels.addEvent}
            </button>
            <button
              type="button"
              onClick={() => submitTitled(onSubmitEventAndOpen)}
              className={SECONDARY_BTN}
            >
              {labels.addEventAndOpen}
            </button>
          </>
        ) : (
          <button type="button" onClick={submitPrimary} className={PRIMARY_BTN}>
            {placing ? labels.placeTask : labels.addTask}
          </button>
        )}
      </div>
    </div>
  );
}
