import { useMemo, useState } from "react";
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
 * Two kinds of thing can land on a day, so the panel has two type tabs:
 *   - event: creates a ScheduleItem, exactly as before.
 *   - task:  either creates a NEW TaskNode already scheduled into the target
 *            slot, or takes an EXISTING unscheduled task and gives it that slot
 *            (Tasks AC7). This is the timed sibling of the #298 "Today's Todo"
 *            tray: the tray declares "today, time TBD" (all-day staging), this
 *            panel says "this day, this time".
 *
 * The title draft and the times are shared across the type tabs on purpose —
 * realising halfway through that "歯医者" is a task rather than an event should
 * not cost the typing.
 *
 * Pure presentation (§3.1 / §6.4): copy injected already translated, every write
 * is a callback; lumen-* tokens only (§5). Enter in the title field submits the
 * active tab's plain create (IME composition respected — §frontend gotcha); a
 * blank title, or no selection in the picker, is a no-op.
 *
 * Both host frames (Modal / BottomSheet) unmount their children when closed, so
 * the local draft state re-seeds from the initial props on every open. When a
 * host keeps the panel open but changes the prefill (e.g. a different empty
 * slot), it should remount this with a `key` derived from the prefill.
 */

/** Which kind of item the panel is about to create. */
export type ItemCreateType = "event" | "task";
/** Within the task tab: type a new task, or place one that already exists. */
export type ItemCreateTaskSource = "new" | "existing";

/** One row of the "place an existing task" picker. */
export interface ItemCreateTaskOption {
  /** Source TaskNode id. */
  id: string;
  title: string;
}

export interface ItemCreatePanelLabels {
  /** Already-translated accessible name for the item-type tablist. */
  typeLabel: string;
  typeEvent: string;
  typeTask: string;
  /** Already-translated aria-label for the shared title input. */
  title: string;
  /** Per-type placeholder for the title input. */
  eventPlaceholder: string;
  taskPlaceholder: string;
  /** Field label of the read-only target-day row. */
  date: string;
  startTime: string;
  endTime: string;
  /** Event submit pair (#354 — create, and create-then-open-the-editor). */
  addEvent: string;
  addEventAndOpen: string;
  /** Accessible name for the new / existing task-source radiogroup. */
  taskSourceLabel: string;
  taskSourceNew: string;
  taskSourceExisting: string;
  /** Task submit — one label per source, because the acts differ. */
  addTask: string;
  placeTask: string;
  /** Placeholder + aria-label of the picker's search field. */
  searchTasks: string;
  /** Shown when the pool itself is empty (nothing left to place). */
  pickerEmpty: string;
  /** Shown when the search query matches nothing. */
  pickerNoMatch: string;
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
  /** Seeds the title field. Default empty. */
  initialTitle?: string;
  /**
   * The pool the "existing task" source picks from — the host's unscheduled,
   * incomplete leaf tasks (`pickAddableTasks`, the same pool the #298 tray
   * offers). Already-scheduled tasks are deliberately absent: re-timing one is
   * a drag on the grid, not a create gesture.
   */
  existingTasks: ItemCreateTaskOption[];
  /** Fired with the trimmed (non-empty) title + current times. */
  onSubmitEvent: (title: string, start: string, end: string) => void;
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
  onSubmitEventAndOpen: (title: string, start: string, end: string) => void;
  /** Create a new task scheduled into the target day + window. */
  onCreateTask: (title: string, start: string, end: string) => void;
  /**
   * Give an EXISTING task the target day + window. No "and open" twin: the
   * Schedule section has no task detail editor (task chips stay read-only
   * there — #297), so the follow-up the event pair offers has no counterpart.
   */
  onPlaceTask: (taskId: string, start: string, end: string) => void;
  labels: ItemCreatePanelLabels;
}

const PRIMARY_BTN =
  "flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";
const SECONDARY_BTN =
  "flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const HINT = "py-3 text-center text-xs text-lumen-text-secondary";

export function ItemCreatePanel({
  dateLabel,
  initialStart = "09:00",
  initialEnd = "10:00",
  initialTitle = "",
  existingTasks,
  onSubmitEvent,
  onSubmitEventAndOpen,
  onCreateTask,
  onPlaceTask,
  labels,
}: ItemCreatePanelProps) {
  const [type, setType] = useState<ItemCreateType>("event");
  const [source, setSource] = useState<ItemCreateTaskSource>("new");
  const [title, setTitle] = useState(initialTitle);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);

  const picking = type === "task" && source === "existing";

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return existingTasks;
    return existingTasks.filter((task) => task.title.toLowerCase().includes(q));
  }, [existingTasks, query]);

  // The selection is resolved THROUGH the current matches, so narrowing the
  // query past the picked row drops it from both the highlight and the submit
  // — placing a task the user can no longer see would be a silent surprise.
  const picked = matches.find((task) => task.id === pickedId) ?? null;

  const submitTitled = (handler: (t: string, s: string, e: string) => void) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    handler(trimmed, start, end);
  };
  const submitPrimary = () =>
    submitTitled(type === "event" ? onSubmitEvent : onCreateTask);
  const place = () => {
    if (!picked) return;
    onPlaceTask(picked.id, start, end);
  };

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={[
          { id: "event", label: labels.typeEvent },
          { id: "task", label: labels.typeTask },
        ]}
        value={type}
        onChange={(id) => setType(id as ItemCreateType)}
        label={labels.typeLabel}
      />
      {type === "task" && (
        <SegmentedToggle
          options={[
            { value: "new" as const, label: labels.taskSourceNew },
            { value: "existing" as const, label: labels.taskSourceExisting },
          ]}
          value={source}
          onChange={setSource}
          label={labels.taskSourceLabel}
        />
      )}
      {picking ? (
        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchTasks}
            aria-label={labels.searchTasks}
            className={FIELD}
          />
          {existingTasks.length === 0 ? (
            <p className={HINT}>{labels.pickerEmpty}</p>
          ) : matches.length === 0 ? (
            <p className={HINT}>{labels.pickerNoMatch}</p>
          ) : (
            // Capped height with its own scroll: the pool is the whole
            // unscheduled backlog, and letting it grow would push the times
            // and the submit button out of a Mobile sheet.
            <ul
              role="list"
              className="max-h-44 overflow-y-auto rounded-lumen-md border border-lumen-border"
            >
              {matches.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    aria-pressed={picked?.id === task.id}
                    onClick={() => setPickedId(task.id)}
                    className={cn(
                      "flex w-full items-center border-b border-lumen-border px-2.5 py-2 text-left text-sm transition-colors last:border-b-0",
                      picked?.id === task.id
                        ? "bg-lumen-accent-subtle text-lumen-accent"
                        : "text-lumen-text hover:bg-lumen-hover",
                      FOCUS_RING_TIGHT,
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {task.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
      <div className="flex gap-2">
        {type === "event" ? (
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
        ) : picking ? (
          <button type="button" onClick={place} className={PRIMARY_BTN}>
            {labels.placeTask}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submitTitled(onCreateTask)}
            className={PRIMARY_BTN}
          >
            {labels.addTask}
          </button>
        )}
      </div>
    </div>
  );
}
