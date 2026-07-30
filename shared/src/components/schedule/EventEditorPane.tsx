import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { ScheduleStatusTag } from "./ScheduleStatusTag";
import {
  FrequencyEditor,
  type FrequencyEditorValue,
  type FrequencyEditorLabels,
} from "./FrequencyEditor";
import type { ScheduleStatus } from "../../utils/scheduleStatus";
import { FIELD, FIELD_LABEL, FOCUS_RING_TIGHT } from "../styleTokens";

/*
 * EventEditorPane (W8 target-IA) — the selected-event editor. Backs the
 * Desktop right pane and the Mobile detail sheet. Pure presentation (§3.1 /
 * §6.4): copy injected already translated, every mutation is a callback.
 * Title + memo + start/end time are commit-on-blur local drafts (Enter blurs;
 * IME composition is respected). lumen-* tokens only (§5).
 *
 * Issue 017 (routine ghost-revival): a routine-generated item is never
 * hard/soft-deleted as a single row — deleting it lets the generator revive
 * it. Since #279 the delete button renders for routine items too, but the
 * host routes it into the this/future/all scope dialog whose "this only"
 * choice performs a Dismiss (revival-safe). Dismiss ("skip this day") stays
 * routine-only; a manual item keeps the plain delete.
 *
 * Repeat section (#185 Step 3): when the host wires the repeat props
 * (`repeatLabels` + `repeatWeekdayLabels` + `onChangeRepeat`), every event
 * gains a "繰り返し" section backed by the shared <FrequencyEditor>. For a
 * routine-derived occurrence it replaces the old read-only "元 Routine" chip
 * and edits the whole series (host patches the source routine); "なし"
 * (onSelectNone → onDetachRepeat) turns the repeat off. For a manual item the
 * section starts at "なし" (value null) and choosing a frequency asks the host
 * to spin up a routine behind the scenes.
 */

export interface EventEditorItem {
  id: string;
  title: string;
  /** Calendar day this occurrence sits on (YYYY-MM-DD) — #469. */
  date: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  /** All-day occupies the day rather than a time span (#469). */
  isAllDay: boolean;
  completed: boolean;
  /** Derived status (#222) — shown as a tag on the completion toggle. */
  status: ScheduleStatus;
  memo: string;
  isRoutine: boolean;
}

export interface EventEditorLabels {
  complete: string;
  /** Already-translated status-tag labels (#222). */
  statusLabels: Record<ScheduleStatus, string>;
  title: string;
  /** Caption for the date picker (#469). */
  date: string;
  /** Caption for the all-day switch (#469). */
  allDay: string;
  startTime: string;
  endTime: string;
  memo: string;
  memoPlaceholder?: string;
  /**
   * Shown on a routine occurrence: says that title / time edits ask which part
   * of the series to apply to, while the day and the all-day switch only ever
   * touch this one occurrence (#469 小粒 — the 「系列全体に適用」 hint). Omit to
   * render no hint.
   */
  seriesHint?: string;
  /** Origin chip copy for a routine-generated item. */
  originRoutine: string;
  /** Origin chip copy for a manual (single) event. */
  originEvent: string;
  /** "この日はスキップ" (routine only). */
  skipThisDay: string;
  /** "削除" — manual: plain delete / routine: opens the scope dialog (#279). */
  delete: string;
}

export interface EventEditorPaneProps {
  item: EventEditorItem;
  /** Extra origin detail appended to the routine chip (e.g. "月・水・金"). */
  originDetail?: string;
  onCommitTitle: (id: string, title: string) => void;
  /**
   * Move the occurrence to another day (#469). Omit to render the date as
   * read-only. Unlike the times this never propagates to a series — the routine
   * template has no concrete date — so the host applies it to this row alone.
   */
  onChangeDate?: (id: string, date: string) => void;
  /**
   * Flip all-day (#469). Omit to hide the switch. Turning it OFF has to hand
   * the row usable times back, so the host (not this pane) decides the
   * fallback: an all-day row may carry no start/end at all.
   */
  onToggleAllDay?: (id: string, next: boolean) => void;
  onChangeStart: (id: string, value: string) => void;
  onChangeEnd: (id: string, value: string) => void;
  onToggleComplete: (id: string) => void;
  onChangeMemo: (id: string, memo: string) => void;
  /** Skip this occurrence (routine-generated items only). */
  onDismiss?: (id: string) => void;
  /**
   * Delete. Manual items: plain single-item delete. Routine items (#279):
   * the host MUST route this into the this/future/all scope dialog — a
   * plain single-row delete would be revived by the generator (Issue 017).
   */
  onDelete?: (id: string) => void;
  labels: EventEditorLabels;
  /**
   * Repeat section (#185 Step 3). Present the section only when the host
   * wires it (labels + weekday labels + onChangeRepeat); otherwise the pane
   * falls back to the read-only origin chip. `repeat` is the routine's
   * frequency for a routine occurrence, or null for a manual item ("なし").
   */
  repeat?: FrequencyEditorValue | null;
  repeatWeekdayLabels?: string[];
  repeatLabels?: FrequencyEditorLabels;
  /** An Event→Repeats conversion is in flight — lock the section (#434). */
  repeatPending?: boolean;
  /** Frequency patch — host applies it to the source routine (or creates one
   *  for a manual item). */
  onChangeRepeat?: (patch: Partial<FrequencyEditorValue>) => void;
  /** "なし" selected — host turns the repeat off (detach the series). */
  onDetachRepeat?: () => void;
  className?: string;
}

/** Inner fields, keyed by item.id + isAllDay from the pane so a selection
 *  change — or an all-day flip, which has the host rewrite start/end — reseeds
 *  the commit-on-blur drafts cleanly. */
function EventEditorFields({
  item,
  originDetail,
  onCommitTitle,
  onChangeDate,
  onToggleAllDay,
  onChangeStart,
  onChangeEnd,
  onToggleComplete,
  onChangeMemo,
  onDismiss,
  onDelete,
  labels,
  repeat,
  repeatWeekdayLabels,
  repeatLabels,
  repeatPending,
  onChangeRepeat,
  onDetachRepeat,
}: Omit<EventEditorPaneProps, "className">) {
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [memoDraft, setMemoDraft] = useState(item.memo);
  // #279: start/end are commit-on-blur drafts too. A write-through onChange
  // fired per keystroke segment, which routed a HALF-TYPED time into the
  // host's scope dialog for routine occurrences (focus stolen mid-edit,
  // intermediate value committed to the series). Blur commits one complete
  // value exactly once.
  const [startDraft, setStartDraft] = useState(item.startTime);
  const [endDraft, setEndDraft] = useState(item.endTime);
  // #469 follow-up: the date is a draft too. It shipped as commit-on-change on
  // the theory that a date input only reports complete values — true, but it
  // reports one per SEGMENT STEP: holding ↑ on the day field wrote a row (and
  // an undo entry) per press, and typing a year passed through the years 2, 20
  // and 202 on the way to 2026. What made blur unsafe for a date was Esc
  // closing the overlay without one; the unmount flush below covers that
  // instead.
  const [dateDraft, setDateDraft] = useState(item.date);

  // The repeat section renders only when the host fully wires it (labels +
  // weekday labels + change handler). Existing hosts/tests that omit it keep
  // the legacy read-only origin chip.
  const showRepeat =
    !!onChangeRepeat && !!repeatLabels && !!repeatWeekdayLabels;
  const repeatSection = showRepeat ? (
    <div className="flex flex-col gap-2 border-t border-lumen-border pt-3">
      <FrequencyEditor
        value={repeat ?? null}
        onChange={onChangeRepeat}
        onSelectNone={onDetachRepeat}
        weekdayLabels={repeatWeekdayLabels}
        labels={repeatLabels}
        pending={repeatPending}
      />
    </div>
  ) : null;

  const commitTitle = () => {
    if (titleDraft !== item.title) onCommitTitle(item.id, titleDraft);
  };
  const commitMemo = () => {
    if (memoDraft !== item.memo) onChangeMemo(item.id, memoDraft);
  };
  // Empty guard: a time input reports "" while cleared — never commit that.
  const commitStart = () => {
    if (startDraft && startDraft !== item.startTime)
      onChangeStart(item.id, startDraft);
  };
  const commitEnd = () => {
    if (endDraft && endDraft !== item.endTime) onChangeEnd(item.id, endDraft);
  };
  // A cleared date input reports "" — never commit that as a day.
  const commitDate = () => {
    if (dateDraft && dateDraft !== item.date)
      onChangeDate?.(item.id, dateDraft);
  };
  // Flush the date on unmount: the overlay/sheet can be dismissed with Esc or a
  // backdrop click, and neither is guaranteed to blur the input first. The ref
  // keeps the effect's cleanup from capturing a stale draft (an empty dep list
  // is what makes it fire exactly once, on unmount).
  const commitDateRef = useRef(commitDate);
  commitDateRef.current = commitDate;
  useEffect(() => () => commitDateRef.current(), []);
  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME guard: do not treat a composition-confirming Enter as commit.
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Completion — the status tag (#222) doubles as the toggle. Clicking
          flips completed; the derived status paints the tag. */}
      <button
        type="button"
        aria-pressed={item.completed}
        aria-label={labels.complete}
        onClick={() => onToggleComplete(item.id)}
        className="flex items-center gap-2 self-start rounded-sm text-sm text-lumen-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        <ScheduleStatusTag
          status={item.status}
          label={labels.statusLabels[item.status]}
        />
        <span>{labels.complete}</span>
      </button>

      {/* Title */}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.title}</span>
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={blurOnEnter}
          aria-label={labels.title}
          className={FIELD}
        />
      </label>

      {/* Date + all-day (#469). Before this the day could only be changed by
          dragging the item across the grid, which is impossible for a day the
          grid is not showing. Commit-on-blur like the fields above, plus an
          unmount flush (see commitDate) — a date input steps its value once per
          segment press, so committing on change wrote a row per keypress. */}
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.date}</span>
          <input
            type="date"
            value={dateDraft}
            readOnly={!onChangeDate}
            onChange={(e) => setDateDraft(e.target.value)}
            onBlur={commitDate}
            onKeyDown={blurOnEnter}
            aria-label={labels.date}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        {onToggleAllDay && (
          <button
            type="button"
            role="switch"
            aria-checked={item.isAllDay}
            onClick={() => onToggleAllDay(item.id, !item.isAllDay)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lumen-md border px-2.5 py-2 text-[13px] font-medium transition-colors",
              FOCUS_RING_TIGHT,
              item.isAllDay
                ? "border-lumen-accent bg-lumen-accent-subtle text-lumen-accent"
                : "border-lumen-border-strong text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            )}
          >
            {labels.allDay}
          </button>
        )}
      </div>

      {/* Start / End — an all-day occurrence has no time span to edit. Hidden
          rather than disabled: the switch that hides them keeps the focus, and
          a locked pair of inputs would leave the times looking authoritative
          while the row ignores them. */}
      {!item.isAllDay && (
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.startTime}</span>
            <input
              type="time"
              value={startDraft}
              onChange={(e) => setStartDraft(e.target.value)}
              onBlur={commitStart}
              onKeyDown={blurOnEnter}
              aria-label={labels.startTime}
              className={cn(FIELD, "tabular-nums")}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={FIELD_LABEL}>{labels.endTime}</span>
            <input
              type="time"
              value={endDraft}
              onChange={(e) => setEndDraft(e.target.value)}
              onBlur={commitEnd}
              onKeyDown={blurOnEnter}
              aria-label={labels.endTime}
              className={cn(FIELD, "tabular-nums")}
            />
          </label>
        </div>
      )}

      {/* Origin chip + provenance action (Issue 017). The repeat section
          (#185) replaces the read-only routine chip when the host wires it;
          otherwise the legacy chip renders. */}
      {item.isRoutine ? (
        <>
          {/* #469 小粒: the fields above behave differently on a series, and
              until now the only way to find out was to edit one and watch a
              scope dialog appear. Say it before the edit instead. */}
          {labels.seriesHint && (
            <p className="text-xs leading-relaxed text-lumen-text-secondary">
              {labels.seriesHint}
            </p>
          )}
          {showRepeat ? (
            repeatSection
          ) : (
            <div className="flex items-start gap-1.5 rounded-lumen-md bg-lumen-chip-routine-bg px-2.5 py-2 text-xs leading-relaxed text-lumen-chip-routine-fg">
              <Repeat
                aria-hidden
                className="mt-0.5 size-3 shrink-0"
                strokeWidth={2.5}
              />
              <span>
                {labels.originRoutine}
                {originDetail ? ` — ${originDetail}` : ""}
              </span>
            </div>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="rounded-lumen-md border border-lumen-border-strong py-2 text-center text-[13px] font-medium text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
            >
              {labels.skipThisDay}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 self-start rounded-lumen-md bg-lumen-chip-event-bg px-2.5 py-1 text-xs font-medium text-lumen-chip-event-fg">
            {labels.originEvent}
          </div>
          {repeatSection}
        </>
      )}

      {/* Memo */}
      <label className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{labels.memo}</span>
        <textarea
          value={memoDraft}
          onChange={(e) => setMemoDraft(e.target.value)}
          onBlur={commitMemo}
          placeholder={labels.memoPlaceholder}
          aria-label={labels.memo}
          className={cn(FIELD, "min-h-[72px] resize-y")}
        />
      </label>

      {/* Delete. Manual: plain single-item delete. Routine (#279): the host
          opens the this/future/all scope dialog instead of deleting directly
          — "this only" maps to Dismiss there, so the Issue 017 ghost-revival
          guard (a deleted occurrence would be regenerated) still holds. */}
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="flex items-center gap-1.5 self-start rounded-sm text-[13px] font-medium text-lumen-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
        >
          <Trash2 aria-hidden className="size-3.5" />
          {labels.delete}
        </button>
      )}
    </div>
  );
}

export function EventEditorPane({ className, ...rest }: EventEditorPaneProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-lumen-border bg-lumen-bg-secondary p-4",
        className,
      )}
    >
      {/* isAllDay in the key (#469 follow-up): turning all-day OFF has the host
          write new start/end, and the time drafts are seeded from props only —
          without the remount they stayed EMPTY for a row that had no times,
          showing blank fields on an item the grid now draws at 09:00. */}
      <EventEditorFields
        key={`${rest.item.id}:${rest.item.isAllDay}`}
        {...rest}
      />
    </div>
  );
}
