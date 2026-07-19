import { useEffect, useRef } from "react";
import { ArrowUpRight, Check, Circle, Sunrise } from "lucide-react";
import type { TaskNode, TaskStatus } from "../../types/taskTree";
import type { TimerSession } from "../../types/timer";
import { SkeletonList } from "../SkeletonList";
import {
  StreakDisplay,
  type StreakDisplayLabels,
} from "../Analytics/StreakDisplay";
import {
  TaskCompletionTrend,
  type TaskCompletionTrendLabels,
} from "../Analytics/TaskCompletionTrend";
import {
  WorkBreakBalance,
  type WorkBreakBalanceLabels,
} from "../Analytics/WorkBreakBalance";
import type { ExtractedBriefing } from "./extractBriefing";

/*
 * BriefingView — the morning-paper home surface (Briefing plan Step 1).
 *
 * Pure presentation (§6.4): no DataService, no useTranslation — the host
 * (web/src/briefing/BriefingScreen.tsx) fetches + aggregates and injects
 * everything through props. Layout language is "紙面, not dashboard":
 * a single centered reading column, generous rules (borders), serif display
 * type for the masthead/focus line, and the Briefing accent duo (#269):
 * 朱 lumen-briefing-shu for "today / action" marks, 琥珀 lumen-briefing-kohaku
 * for context / annotations. All colors are lumen-* tokens (no hardcodes).
 *
 * The visual zone deliberately reuses the three Analytics widgets
 * (StreakDisplay / TaskCompletionTrend / WorkBreakBalance) — the Analytics
 * section shrink decision (redesign doc §3): the dashboards freeze, these
 * three move in here. Their labels are re-resolved by the host from the
 * existing analytics.* i18n keys, so no copy is duplicated.
 */

/** One row of「今日の予定」— today's schedule, host-shaped. */
export interface BriefingScheduleEntry {
  id: string;
  title: string;
  /** "HH:MM" (empty for all-day). */
  startTime: string;
  completed: boolean;
  /** True when the item was generated from a Routine (shows the tag). */
  isRoutine: boolean;
  isAllDay: boolean;
}

/** One row of「今日の Todo」— host-shaped, purposes resolved to titles. */
export interface BriefingTaskEntry {
  id: string;
  title: string;
  status: TaskStatus;
  /** Titles of linked goal/notes (WikiTagsUnified item↔item links). */
  purposes: string[];
}

/** One row of「持ち越し」. */
export interface BriefingCarryoverEntry {
  id: string;
  title: string;
  /** Host-formatted "N日目" label (i18n interpolation stays host-side). */
  daysLabel: string;
  /** True once completed today — kept on the board with a strikethrough. */
  completed: boolean;
}

export interface BriefingData {
  /** Host-formatted date line, e.g. "2026年7月13日 月曜日". */
  dateLine: string;
  /** Extracted briefing (null → "no briefing yet" empty state). */
  briefing: ExtractedBriefing | null;
  schedule: BriefingScheduleEntry[];
  tasks: BriefingTaskEntry[];
  carryover: BriefingCarryoverEntry[];
  /** Timer sessions — feeds StreakDisplay + WorkBreakBalance. */
  sessions: TimerSession[];
  /** Full task tree — feeds TaskCompletionTrend. */
  taskNodes: TaskNode[];
}

export interface BriefingLabels {
  masthead: string;
  focusLabel: string;
  aiTitle: string;
  aiSource: string;
  noBriefing: string;
  intentionTitle: string;
  /** Saved-state caption next to the intention title (host-computed). */
  intentionCaption: string;
  intentionPlaceholder: string;
  scheduleTitle: string;
  noSchedule: string;
  routineTag: string;
  allDay: string;
  tasksTitle: string;
  noTasks: string;
  vizTitle: string;
  carryoverTitle: string;
  toggleComplete: string;
  jumpToSchedule: string;
  jumpToTasks: string;
}

export interface BriefingViewProps {
  loading: boolean;
  data: BriefingData;
  labels: BriefingLabels;
  streakLabels: StreakDisplayLabels;
  trendLabels: TaskCompletionTrendLabels;
  balanceLabels: WorkBreakBalanceLabels;
  /** Today's declaration (宣言 — Step 4), newline-separated lines. */
  intentionText: string;
  /** Every keystroke — the host owns draft state + debounced persistence. */
  onIntentionChange: (text: string) => void;
  /** Blur — the host flushes a pending debounced save. */
  onIntentionBlur: () => void;
  /** Completes / un-completes a schedule item (host → DataService). */
  onToggleScheduleItem: (id: string) => void;
  /** Completes / un-completes a task or carryover row (host → DataService). */
  onToggleTask: (id: string) => void;
  /** Jumps to the Schedule section (host → nav). */
  onJumpToSchedule: () => void;
  /** Jumps to the Tasks section (host → nav). */
  onJumpToTasks: () => void;
}

/** Section heading row — 段標 (朱 bar) + small-caps kicker over a hairline. */
function BlockHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="flex items-center gap-2.5 text-xs font-bold tracking-[0.25em] text-lumen-text-secondary">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-[7px] bg-lumen-briefing-shu"
        />
        {title}
      </h3>
      {hint !== undefined && (
        <span className="text-[10px] tracking-wider text-lumen-briefing-kohaku">
          {hint}
        </span>
      )}
    </div>
  );
}

/**
 * 宣言 input — an auto-growing bare textarea so the declaration reads as
 * ink on the paper, not a form control. Sits on the 朱 side of the accent
 * duo (the user's action voice; Claude's 講評 block is 琥珀).
 */
function IntentionField({
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  value: string;
  placeholder: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="w-full resize-none overflow-hidden rounded-lumen-md border-l-2 border-lumen-briefing-shu bg-lumen-briefing-shu-subtle px-4 py-3 font-serif text-base leading-relaxed text-lumen-text outline-none placeholder:font-sans placeholder:text-sm placeholder:text-lumen-text-secondary"
    />
  );
}

export function BriefingView({
  loading,
  data,
  labels,
  streakLabels,
  trendLabels,
  balanceLabels,
  intentionText,
  onIntentionChange,
  onIntentionBlur,
  onToggleScheduleItem,
  onToggleTask,
  onJumpToSchedule,
  onJumpToTasks,
}: BriefingViewProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        <SkeletonList rows={8} rowHeight={44} gap={12} />
      </div>
    );
  }

  const { briefing } = data;

  return (
    <div className="mx-auto w-full max-w-2xl pb-16">
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <header className="border-b-4 border-double border-lumen-border-strong pb-4 pt-6 text-center">
        <h2 className="font-serif text-2xl font-semibold tracking-[0.3em] text-lumen-text">
          {labels.masthead}
        </h2>
        <p className="mt-2 text-xs tracking-[0.2em] text-lumen-text-secondary">
          {data.dateLine}
        </p>
      </header>

      {/* ── Focus line ───────────────────────────────────────────── */}
      <section className="border-b border-lumen-border px-2 py-6 text-center">
        <p className="mb-2 text-[10px] font-bold tracking-[0.3em] text-lumen-briefing-shu">
          {labels.focusLabel}
        </p>
        {briefing?.focus !== null && briefing?.focus !== undefined ? (
          <p className="font-serif text-xl font-semibold leading-relaxed text-lumen-text">
            {briefing.focus}
          </p>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-lumen-text-secondary">
            <Sunrise size={16} aria-hidden="true" />
            {labels.noBriefing}
          </p>
        )}
      </section>

      {/* ── AI comment (rest of the briefing section) ────────────── */}
      {briefing !== null && briefing.paragraphs.length > 0 && (
        <section className="border-b border-lumen-border py-5">
          <BlockHead title={labels.aiTitle} hint={labels.aiSource} />
          <div className="rounded-lumen-md border-l-2 border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-4 py-3">
            {briefing.paragraphs.map((text, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-lumen-text [&+&]:mt-2"
              >
                {text}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's intention (宣言 — Step 4) ────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead
          title={labels.intentionTitle}
          hint={labels.intentionCaption}
        />
        <IntentionField
          value={intentionText}
          placeholder={labels.intentionPlaceholder}
          onChange={onIntentionChange}
          onBlur={onIntentionBlur}
        />
      </section>

      {/* ── Today's schedule ─────────────────────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.scheduleTitle} />
        {data.schedule.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">
            {labels.noSchedule}
          </p>
        ) : (
          <ul className="space-y-1">
            {data.schedule.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 py-1">
                <span className="w-14 flex-shrink-0 text-xs font-bold tabular-nums text-lumen-briefing-shu">
                  {item.isAllDay ? labels.allDay : item.startTime}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleScheduleItem(item.id)}
                  aria-label={labels.toggleComplete}
                  className="flex-shrink-0 self-center text-lumen-text-secondary transition-colors hover:text-lumen-accent"
                >
                  {item.completed ? (
                    <Check size={15} className="text-lumen-briefing-shu" />
                  ) : (
                    <Circle size={15} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleScheduleItem(item.id)}
                  className={
                    item.completed
                      ? "text-left text-sm text-lumen-text-secondary line-through transition-colors hover:text-lumen-accent"
                      : "text-left text-sm text-lumen-text transition-colors hover:text-lumen-accent"
                  }
                >
                  {item.title}
                </button>
                <button
                  type="button"
                  onClick={onJumpToSchedule}
                  aria-label={labels.jumpToSchedule}
                  className="flex-shrink-0 self-center text-lumen-text-secondary transition-colors hover:text-lumen-accent"
                >
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
                {item.isRoutine && (
                  <span className="rounded-full border border-lumen-briefing-kohaku bg-lumen-briefing-kohaku-subtle px-2 text-[10px] text-lumen-briefing-kohaku">
                    {labels.routineTag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Today's tasks + purposes ─────────────────────────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.tasksTitle} />
        {data.tasks.length === 0 ? (
          <p className="text-sm text-lumen-text-secondary">{labels.noTasks}</p>
        ) : (
          <ul>
            {data.tasks.map((task) => (
              <li
                key={task.id}
                className="border-b border-dashed border-lumen-border py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        task.status === "DONE"
                          ? "grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-lumen-briefing-shu text-lumen-on-accent"
                          : "h-4 w-4 flex-shrink-0 rounded border border-lumen-border-strong"
                      }
                    >
                      {task.status === "DONE" && <Check size={11} />}
                    </span>
                    <span
                      className={
                        task.status === "DONE"
                          ? "text-sm text-lumen-text-secondary line-through"
                          : "text-sm text-lumen-text"
                      }
                    >
                      {task.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onJumpToTasks}
                    aria-label={labels.jumpToTasks}
                    className="flex-shrink-0 self-center text-lumen-text-secondary transition-colors hover:text-lumen-accent"
                  >
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </div>
                {task.purposes.length > 0 && (
                  <p className="ml-[26px] mt-0.5 text-xs text-lumen-text-secondary">
                    <span className="font-semibold text-lumen-briefing-kohaku">
                      ◈ {task.purposes.join(" ・ ")}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Visual zone — the 3 adopted Analytics widgets ────────── */}
      <section className="border-b border-lumen-border py-5">
        <BlockHead title={labels.vizTitle} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StreakDisplay sessions={data.sessions} labels={streakLabels} />
          <TaskCompletionTrend
            nodes={data.taskNodes}
            days={7}
            labels={trendLabels}
          />
          <div className="sm:col-span-2">
            <WorkBreakBalance
              sessions={data.sessions}
              days={7}
              labels={balanceLabels}
            />
          </div>
        </div>
      </section>

      {/* ── Carryover ────────────────────────────────────────────── */}
      {data.carryover.length > 0 && (
        <section className="py-5">
          <BlockHead title={labels.carryoverTitle} />
          <ul className="space-y-1">
            {data.carryover.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-sm text-lumen-text-secondary"
              >
                <span className="font-bold text-lumen-briefing-shu">
                  {item.daysLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleTask(item.id)}
                  className="flex items-center gap-2.5 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={
                      item.completed
                        ? "grid h-4 w-4 flex-shrink-0 place-items-center rounded bg-lumen-briefing-shu text-lumen-on-accent"
                        : "h-4 w-4 flex-shrink-0 rounded border border-lumen-border-strong"
                    }
                  >
                    {item.completed && <Check size={11} />}
                  </span>
                  <span className={item.completed ? "line-through" : undefined}>
                    {item.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onJumpToTasks}
                  aria-label={labels.jumpToTasks}
                  className="flex-shrink-0 self-center text-lumen-text-secondary transition-colors hover:text-lumen-accent"
                >
                  <ArrowUpRight size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
