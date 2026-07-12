import { useState, type KeyboardEvent } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { ScheduleStatusTag } from "./ScheduleStatusTag";
import {
  FrequencyEditor,
  type FrequencyEditorValue,
  type FrequencyEditorGroup,
  type FrequencyEditorLabels,
} from "./FrequencyEditor";
import type { ScheduleStatus } from "../../utils/scheduleStatus";

/*
 * EventEditorPane (W8 target-IA) — the selected-event editor. Backs the
 * Desktop right pane and the Mobile detail sheet. Pure presentation (§3.1 /
 * §6.4): copy injected already translated, every mutation is a callback.
 * Title + memo are commit-on-blur local drafts (Enter blurs the title; IME
 * composition is respected). lumen-* tokens only (§5).
 *
 * Issue 017 (routine ghost-revival): a routine-generated item can only be
 * Dismissed ("skip this day"), NEVER deleted — deleting it lets the generator
 * revive it. A manual item is the inverse: Delete only, no Dismiss. The
 * component enforces this from `item.isRoutine`; the host cannot cross-wire it.
 *
 * Repeat section (#185 Step 3): when the host wires the repeat props
 * (`repeatLabels` + `repeatWeekdayLabels` + `onChangeRepeat`), every event
 * gains a "繰り返し" section backed by the shared <FrequencyEditor>. For a
 * routine-derived occurrence it replaces the old read-only "元 Routine" chip
 * and edits the whole series (host patches the source routine); "なし"
 * (onSelectNone → onDetachRepeat) turns the repeat off. For a manual item the
 * section starts at "なし" (value null) and choosing a frequency asks the host
 * to spin up a routine behind the scenes. group is not newly choosable here
 * (allowGroup=false — group routines stay editable in the Routines tab).
 */

export interface EventEditorItem {
  id: string;
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
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
  startTime: string;
  endTime: string;
  memo: string;
  memoPlaceholder?: string;
  /** Origin chip copy for a routine-generated item. */
  originRoutine: string;
  /** Origin chip copy for a manual (single) event. */
  originEvent: string;
  /** "この日はスキップ" (routine only). */
  skipThisDay: string;
  /** "削除" (manual only). */
  delete: string;
}

export interface EventEditorPaneProps {
  item: EventEditorItem;
  /** Extra origin detail appended to the routine chip (e.g. "月・水・金"). */
  originDetail?: string;
  onCommitTitle: (id: string, title: string) => void;
  onChangeStart: (id: string, value: string) => void;
  onChangeEnd: (id: string, value: string) => void;
  onToggleComplete: (id: string) => void;
  onChangeMemo: (id: string, memo: string) => void;
  /** Skip this occurrence (routine-generated items only). */
  onDismiss?: (id: string) => void;
  /** Delete (manual items only). */
  onDelete?: (id: string) => void;
  labels: EventEditorLabels;
  /**
   * Repeat section (#185 Step 3). Present the section only when the host
   * wires it (labels + weekday labels + onChangeRepeat); otherwise the pane
   * falls back to the read-only origin chip. `repeat` is the routine's
   * frequency for a routine occurrence, or null for a manual item ("なし").
   */
  repeat?: FrequencyEditorValue | null;
  repeatGroups?: FrequencyEditorGroup[];
  repeatWeekdayLabels?: string[];
  repeatLabels?: FrequencyEditorLabels;
  /** Frequency patch — host applies it to the source routine (or creates one
   *  for a manual item). */
  onChangeRepeat?: (patch: Partial<FrequencyEditorValue>) => void;
  /** "なし" selected — host turns the repeat off (detach the series). */
  onDetachRepeat?: () => void;
  className?: string;
}

const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg px-2.5 py-2 text-sm text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";
const FIELD_LABEL = "text-xs text-lumen-text-secondary";

/** Inner fields, keyed by item.id from the pane so a selection change reseeds
 *  the commit-on-blur drafts cleanly. */
function EventEditorFields({
  item,
  originDetail,
  onCommitTitle,
  onChangeStart,
  onChangeEnd,
  onToggleComplete,
  onChangeMemo,
  onDismiss,
  onDelete,
  labels,
  repeat,
  repeatGroups,
  repeatWeekdayLabels,
  repeatLabels,
  onChangeRepeat,
  onDetachRepeat,
}: Omit<EventEditorPaneProps, "className">) {
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [memoDraft, setMemoDraft] = useState(item.memo);

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
        allowGroup={false}
        groups={repeatGroups}
        weekdayLabels={repeatWeekdayLabels}
        labels={repeatLabels}
      />
    </div>
  ) : null;

  const commitTitle = () => {
    if (titleDraft !== item.title) onCommitTitle(item.id, titleDraft);
  };
  const commitMemo = () => {
    if (memoDraft !== item.memo) onChangeMemo(item.id, memoDraft);
  };
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

      {/* Start / End */}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.startTime}</span>
          <input
            type="time"
            value={item.startTime}
            onChange={(e) => onChangeStart(item.id, e.target.value)}
            aria-label={labels.startTime}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={FIELD_LABEL}>{labels.endTime}</span>
          <input
            type="time"
            value={item.endTime}
            onChange={(e) => onChangeEnd(item.id, e.target.value)}
            aria-label={labels.endTime}
            className={cn(FIELD, "tabular-nums")}
          />
        </label>
      </div>

      {/* Origin chip + provenance action (Issue 017). The repeat section
          (#185) replaces the read-only routine chip when the host wires it;
          otherwise the legacy chip renders. */}
      {item.isRoutine ? (
        <>
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

      {/* Delete (manual only) */}
      {!item.isRoutine && onDelete && (
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
      <EventEditorFields key={rest.item.id} {...rest} />
    </div>
  );
}
