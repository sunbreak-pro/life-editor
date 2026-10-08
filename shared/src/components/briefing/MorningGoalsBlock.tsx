import { useId, useState } from "react";
import { ArrowUpRight, Link2 } from "lucide-react";
import type { GoalPeriodKind } from "../../types/goal";
import { isImeComposing } from "../../utils/imeGuard";
import { Button } from "../Button";
import { cn } from "../cn";
import { Input } from "../Input";
import { BlockHead } from "./BriefingView";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import { GOALS_PER_PERIOD_LIMIT } from "./goalNoteMigration";
import {
  GOAL_CHIP_ACHIEVED,
  GOAL_CHIP_UNACHIEVED,
  goalProgressText,
} from "./GoalProgressDelta";
import type { GoalProgress } from "./goalLinkPreview";
import type { MorningGoalLine, MorningGoals } from "./morningGoals";

/*
 * The morning paper's goals (#2106, plan Step 7 — design M1–M8 / P1 / P2 as
 * described in .claude/docs/design/briefs/briefing.md §8 / §10.2 / §11).
 *
 * This week's goals are the protagonists: one row each with its progress,
 * and the add field under them. This month's and this year's goals ride
 * above as one line per period — the paper offers making only the week's;
 * the rest, and renaming or deleting, live in Connect's "Goals & Todos" tab,
 * which the block links to.
 *
 * Ruled like every other block of the paper, not a stack of cards. Colours
 * are the plan's: achieved = mint, not yet = 朱, unconnected = an outline
 * only — and every state also says itself in words, never by colour alone.
 *
 * Pure presentation (§6.4): verdicts come in already judged (morningGoals.ts
 * over `judgeGoals`), copy comes in translated, writes go out as callbacks.
 */

export interface MorningGoalsLabels {
  title: string;
  /** Host-formatted「今週 10/4 – 10/10」per period. */
  periods: Record<GoalPeriodKind, string>;
  /** No goal this week (also what a new week opens on). */
  prompt: string;
  achieved: string;
  unconnected: string;
  /** Visible text of a row's link button. */
  linkTodos: string;
  /** Its accessible name — the visible text, then the goal's title. */
  linkTodosFor: (title: string) => string;
  addLabel: string;
  addPlaceholder: string;
  add: string;
  adding: string;
  /** This week is full — said in place of the add field. */
  limit: string;
  openInConnect: string;
}

export interface MorningGoalsBlockProps {
  goals: MorningGoals;
  labels: MorningGoalsLabels;
  onLinkTodos: (goalId: string) => void;
  /** Resolves true once the goal exists (the field clears), false to keep it. */
  onCreateWeekGoal: (title: string) => Promise<boolean>;
  /**
   * Another goal write (a review answer) is in flight: adding waits for it,
   * so the two cannot both count the same free slot.
   */
  writing?: boolean;
  /** Omitted → no link to Connect (a host with no navigation). */
  onOpenGoals?: () => void;
}

/*
 * The 44px floor below `md` (#1559) on every control here, grown on the box:
 * these rows have no ruled rhythm a taller box would break.
 */
const QUIET_ACTION =
  "inline-flex items-center gap-1 rounded-lumen-sm px-1.5 py-1 text-xs text-lumen-text-secondary transition-colors hover:text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11";

const OUTLINE_CHIP =
  "inline-flex items-center rounded-full border border-lumen-border px-2 py-0.5 text-xs text-lumen-text-tertiary";

function WeekGoalStatus({
  title,
  progress,
  labels,
}: {
  title: string;
  progress: GoalProgress;
  labels: MorningGoalsLabels;
}): React.JSX.Element {
  // Nothing linked: no bar to fill. Achieved by hand still reads as achieved.
  if (!progress.connected) {
    return progress.achieved ? (
      <span className={GOAL_CHIP_ACHIEVED}>{labels.achieved}</span>
    ) : (
      <span className={OUTLINE_CHIP}>{labels.unconnected}</span>
    );
  }
  const text = goalProgressText(progress, labels);
  // Full once achieved, whatever the count: a period-end「達成にする」
  // overrides the links (goalAchievement.ts), and the bar follows the verdict.
  // So does what the bar says to a screen reader: full, with the verdict.
  const pct = progress.achieved
    ? 100
    : Math.round((progress.done / progress.total) * 100);
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.achieved ? progress.total : progress.done}
        aria-valuetext={progress.achieved ? `${labels.achieved} ${text}` : text}
        className={cn(
          "h-1.5 w-16 overflow-hidden rounded-full",
          progress.achieved
            ? "bg-lumen-chip-mint-bg"
            : "bg-lumen-briefing-shu-subtle",
        )}
      >
        <span
          className={cn(
            "block h-full rounded-full",
            progress.achieved
              ? "bg-lumen-accent-secondary"
              : "bg-lumen-briefing-shu",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs tabular-nums text-lumen-text-secondary">
        {text}
      </span>
      {progress.achieved && (
        <span className={GOAL_CHIP_ACHIEVED}>{labels.achieved}</span>
      )}
    </span>
  );
}

/** 「達成」/「1/2」/「未接続」 after a month or year goal's title. */
function SmallStatus({
  progress,
  labels,
}: {
  progress: GoalProgress;
  labels: MorningGoalsLabels;
}): React.JSX.Element {
  if (progress.achieved) {
    return <span className={GOAL_CHIP_ACHIEVED}>{labels.achieved}</span>;
  }
  // Its own kind, drawn as the week rows and the review card draw it.
  if (!progress.connected) {
    return <span className={OUTLINE_CHIP}>{labels.unconnected}</span>;
  }
  return (
    <span className="text-xs tabular-nums text-lumen-text-tertiary">
      {goalProgressText(progress, labels)}
    </span>
  );
}

function PeriodLine({
  label,
  lines,
  labels,
}: {
  label: string;
  lines: readonly MorningGoalLine[];
  labels: MorningGoalsLabels;
}): React.JSX.Element | null {
  // No line over a period with nothing in it: the paper asks only for the
  // week's goals (brief §8), so an empty month would be a frame with no ask.
  if (lines.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-lumen-text">
      <span className={BRIEFING_HINT_CLASS}>{label}</span>
      {lines.map((line, i) => (
        <span key={line.id} className="inline-flex items-baseline gap-1.5">
          {i > 0 && (
            <span aria-hidden="true" className="text-lumen-text-tertiary">
              ・
            </span>
          )}
          <span>{line.title}</span>
          <SmallStatus progress={line.progress} labels={labels} />
        </span>
      ))}
    </p>
  );
}

export function MorningGoalsBlock({
  goals,
  labels,
  onLinkTodos,
  onCreateWeekGoal,
  writing = false,
  onOpenGoals,
}: MorningGoalsBlockProps): React.JSX.Element {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const full = goals.week.length >= GOALS_PER_PERIOD_LIMIT;
  // Someone else's write: greyed, not spinning (#1804 — busy ≠ disabled).
  const waiting = writing && !busy;

  const submit = (): void => {
    const title = draft.trim();
    if (!title || busy || waiting) return;
    setBusy(true);
    void onCreateWeekGoal(title).then((ok) => {
      setBusy(false);
      // A failed write keeps the words: they are the user's only copy.
      if (ok) setDraft("");
    });
  };

  return (
    <section className="border-b border-lumen-border py-5">
      <BlockHead title={labels.title} />
      <div className="space-y-1.5">
        <PeriodLine
          label={labels.periods.year}
          lines={goals.year}
          labels={labels}
        />
        <PeriodLine
          label={labels.periods.month}
          lines={goals.month}
          labels={labels}
        />
      </div>

      <p className={cn(BRIEFING_HINT_CLASS, "mb-1 mt-3")}>
        {labels.periods.week}
      </p>
      {goals.week.length === 0 ? (
        <p className="py-1 text-sm text-lumen-text-secondary">
          {labels.prompt}
        </p>
      ) : (
        <ul className="divide-y divide-lumen-border">
          {goals.week.map((line) => (
            <li
              key={line.id}
              className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
            >
              <span className="min-w-0 flex-1 text-base font-medium text-lumen-text">
                {line.title}
              </span>
              <WeekGoalStatus
                title={line.title}
                progress={line.progress}
                labels={labels}
              />
              <button
                type="button"
                onClick={() => onLinkTodos(line.id)}
                aria-label={labels.linkTodosFor(line.title)}
                className={QUIET_ACTION}
              >
                <Link2 size={13} aria-hidden="true" className="shrink-0" />
                {labels.linkTodos}
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="mt-2 text-xs text-lumen-text-tertiary">{labels.limit}</p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Input
            className="max-md:min-h-11"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (isImeComposing(e)) return;
              if (e.key === "Enter") submit();
            }}
            placeholder={labels.addPlaceholder}
            aria-label={labels.addLabel}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={submit}
            disabled={!draft.trim() || waiting}
            busy={busy}
            busyLabel={labels.adding}
            className="max-md:min-h-11"
          >
            {labels.add}
          </Button>
        </div>
      )}

      {onOpenGoals && (
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onOpenGoals} className={QUIET_ACTION}>
            <ArrowUpRight size={13} aria-hidden="true" className="shrink-0" />
            {labels.openInConnect}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Period-end review (P1 / P2) ────────────────────────────────────────

export type PeriodEndChoice = "carried" | "dropped" | "achieved";

export interface PeriodEndReviewLabels {
  title: string;
  /** 「残り 2 件」— how many are still to be asked, this one included. */
  remaining: string;
  /** The goal's own period, host-formatted (「週 · 9/27 – 10/3」). */
  periodLabel: string;
  question: string;
  /** The goal's progress as text (「1/2」/「未接続」). */
  progress: string;
  carry: string;
  drop: string;
  achieve: string;
  later: string;
  /** Why「持ち越す」is off — the current period is full. */
  carryBlocked?: string;
  saving: string;
}

export interface PeriodEndReviewCardProps {
  goalTitle: string;
  /** Any todo linked — false draws「未接続」as its own kind, not as 朱. */
  connected: boolean;
  canCarry: boolean;
  /** The answer being written, or null — only that button spins. */
  busy: PeriodEndChoice | null;
  /** Another goal write (the add field's) is in flight: the answers wait. */
  locked?: boolean;
  labels: PeriodEndReviewLabels;
  onDecide: (choice: PeriodEndChoice) => void;
  /** Not saved: the host asks again the next time the paper opens. */
  onLater: () => void;
}

/*
 * One unanswered goal from an ended period, asked on the morning paper. Two
 * by two below `md` so each answer keeps a 44px target on a phone; one row
 * from `md` up.
 */
export function PeriodEndReviewCard({
  goalTitle,
  connected,
  canCarry,
  busy,
  locked = false,
  labels,
  onDecide,
  onLater,
}: PeriodEndReviewCardProps): React.JSX.Element {
  const blockedId = useId();
  const writing = busy !== null || locked;
  const answer = (choice: PeriodEndChoice, text: string) => (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={writing || (choice === "carried" && !canCarry)}
      aria-describedby={
        choice === "carried" && !canCarry && labels.carryBlocked
          ? blockedId
          : undefined
      }
      busy={busy === choice}
      busyLabel={labels.saving}
      onClick={() => onDecide(choice)}
      className="max-md:min-h-11"
    >
      {text}
    </Button>
  );
  return (
    <section className="border-b border-lumen-border py-5">
      <BlockHead title={labels.title} hint={labels.remaining} />
      <div className="rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-4 py-3">
        <p className="text-xs text-lumen-briefing-kohaku">
          {labels.periodLabel}
        </p>
        <p className="mt-1 text-base font-medium text-lumen-text">
          {goalTitle}
        </p>
        <p className="mt-1.5">
          <span className={connected ? GOAL_CHIP_UNACHIEVED : OUTLINE_CHIP}>
            {labels.progress}
          </span>
        </p>
        <p className="mt-2 text-sm text-lumen-text-secondary">
          {labels.question}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          {answer("carried", labels.carry)}
          {answer("dropped", labels.drop)}
          {answer("achieved", labels.achieve)}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={writing}
            onClick={onLater}
            className="max-md:min-h-11"
          >
            {labels.later}
          </Button>
        </div>
        {!canCarry && labels.carryBlocked && (
          <p id={blockedId} className="mt-2 text-xs text-lumen-text-tertiary">
            {labels.carryBlocked}
          </p>
        )}
      </div>
    </section>
  );
}
