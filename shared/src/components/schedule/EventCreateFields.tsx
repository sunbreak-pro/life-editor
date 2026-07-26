import { useState } from "react";
import { FIELD } from "../styleTokens";

/*
 * EventCreateFields (#299) — the shared title + start/end + submit form for
 * creating an event. Extracted from QuickCaptureSheet so the same fields back
 * BOTH the Desktop creation overlay (inside ItemDetailOverlay) and the Mobile
 * QuickCaptureSheet (inside BottomSheet). Pure presentation (§3.1 / §6.4): copy
 * injected already translated, the single mutation is the onSubmit callback;
 * lumen-* tokens only (§5). Enter submits (IME composition respected —
 * §frontend gotcha); a blank title is a no-op.
 *
 * Both host frames (Modal / BottomSheet) unmount their children when closed, so
 * the local draft state re-seeds from the initial props on every open. When a
 * host keeps the panel open but changes the prefill (e.g. a different empty
 * slot), it should remount this with a `key` derived from the prefill.
 */

export interface EventCreateFieldsLabels {
  /** Already-translated aria-label for the title input. */
  title: string;
  /** Already-translated placeholder for the title input. */
  placeholder: string;
  /** Already-translated submit button label. */
  add: string;
  /**
   * Already-translated label of the secondary "create, then open the detail
   * editor" action.
   */
  addAndOpen: string;
  /** Field label for the read-only target-day row. */
  date: string;
  startTime: string;
  endTime: string;
}

export interface EventCreateFieldsProps {
  /**
   * The day the event will land on, already formatted for display (#353).
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
  /** Fired with the trimmed (non-empty) title + current times. */
  onSubmit: (title: string, start: string, end: string) => void;
  /**
   * Same payload as `onSubmit`, but the host should follow the write by
   * opening the new item's detail editor (#354).
   *
   * Two buttons rather than one policy: creating an event and filling in a
   * memo / repeat rule are different intents. Blocking on the editor every
   * time punishes the common case (blocking out several slots in a row),
   * while never opening it strands the other one — the panel only carries
   * title + times. Enter keeps the plain create, so the fast path stays fast.
   */
  onSubmitAndOpen: (title: string, start: string, end: string) => void;
  labels: EventCreateFieldsLabels;
}

export function EventCreateFields({
  dateLabel,
  initialStart = "09:00",
  initialEnd = "10:00",
  initialTitle = "",
  onSubmit,
  onSubmitAndOpen,
  labels,
}: EventCreateFieldsProps) {
  const [title, setTitle] = useState(initialTitle);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);

  const submitTo = (handler: (t: string, s: string, e: string) => void) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    handler(trimmed, start, end);
  };
  const submit = () => submitTo(onSubmit);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        placeholder={labels.placeholder}
        aria-label={labels.title}
        className={FIELD}
      />
      {dateLabel && (
        <div className="flex flex-col gap-1 text-xs text-lumen-text-secondary">
          {labels.date}
          {/* Read-only, so a <p> rather than a disabled input: it is context
              for the times below, not something the user can act on. */}
          <p className="text-sm font-medium text-lumen-text">{dateLabel}</p>
        </div>
      )}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
          {labels.startTime}
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label={labels.startTime}
            className={`${FIELD} tabular-nums`}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-lumen-text-secondary">
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
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-lumen-md bg-lumen-accent py-2 text-center text-sm font-medium text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg"
        >
          {labels.add}
        </button>
        <button
          type="button"
          onClick={() => submitTo(onSubmitAndOpen)}
          className="flex-1 rounded-lumen-md border border-lumen-border-strong py-2 text-center text-sm font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          {labels.addAndOpen}
        </button>
      </div>
    </div>
  );
}
