import { useId } from "react";
import { ChevronRight, Target } from "lucide-react";
import type { GoalPeriodKind } from "../../types/goal";
import { Button } from "../Button";
import { cn } from "../cn";
import { BlockHead } from "./BriefingView";
import { BRIEFING_HINT_CLASS } from "./briefingStyles";
import {
  GOAL_CHIP_ACHIEVED,
  GOAL_CHIP_UNACHIEVED,
  goalProgressText,
} from "./GoalProgressDelta";
import type { GoalProgress } from "./goalLinkPreview";
import type { MorningGoalLine, MorningGoals } from "./morningGoals";

/*
 * The morning paper's goals (#2106 → #2286).
 *
 * Since #2286 the block is a summary: one line per period — this year, this
 * month, this week — each with its first goal, 「その他 N」 at the right edge
 * and the period's progress. Viewing, editing, linking and adding moved to
 * the goals panel (MorningGoalsPanel.tsx) that the「目標」button opens, so
 * the paper stays short on a phone. An ended period's unanswered goals are
 * a one-line notice above the rows; the review itself lives in the panel.
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
  /** 「今年」「今月」「今週」— the summary rows' heads. */
  periodNames: Record<GoalPeriodKind, string>;
  /** Host-formatted「今週 10/4 – 10/10」per period — the panel's headings. */
  periods: Record<GoalPeriodKind, string>;
  /** The block's button that opens the goals panel. */
  open: string;
  /** 「その他 2」— the goals a summary row does not name. */
  more: (count: number) => string;
  /** A period with no goal yet. */
  unset: string;
  /** 「終わった期間の目標が 2 件あります」— the review's one-line notice. */
  reviewNotice: (count: number) => string;
  /** No goal this week (also what a new week opens on) — in the panel. */
  prompt: string;
  achieved: string;
  unconnected: string;
  /** Visible text of a row's link button. */
  linkTodos: string;
  /** Its accessible name — the visible text, then the goal's title. */
  linkTodosFor: (title: string) => string;
  /** A goal title's accessible name in the panel: it opens the goal. */
  openGoalFor: (title: string) => string;
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
  /**
   * Phone width: the rows drop the bar and every count / chip (#2286) — the
   * panel still shows them per goal.
   */
  compact?: boolean;
  /** Unanswered goals of ended periods: a one-line notice above the rows. */
  reviewCount?: number;
  /** Opens the goals panel — from the button, an unset row or the notice. */
  onOpen: () => void;
}

const KINDS: readonly GoalPeriodKind[] = ["year", "month", "week"];

/*
 * The 44px floor below `md` (#1559) on every control here, grown on the box:
 * these rows have no ruled rhythm a taller box would break.
 */
export const QUIET_ACTION =
  "inline-flex items-center gap-1 rounded-lumen-sm px-1.5 py-1 text-xs text-lumen-text-secondary transition-colors hover:text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11 max-md:min-w-11";

const OUTLINE_CHIP =
  "inline-flex items-center rounded-full border border-lumen-border px-2 py-0.5 text-xs text-lumen-text-tertiary";

/**
 * A goal's progress (in the panel) or a period's (on a summary row): the bar
 * and count when anything is linked, otherwise a chip that says so.
 */
export function GoalStatusLine({
  title,
  progress,
  labels,
}: {
  /** The bar's accessible name — the goal's title or the period's name. */
  title: string;
  progress: GoalProgress;
  labels: Pick<MorningGoalsLabels, "achieved" | "unconnected">;
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

/**
 * A period's progress, summed over its goals: their linked todos and child
 * goals counted together, achieved once every goal is, unconnected while
 * none has anything linked. Each goal's verdict is still `judgeGoals`'.
 */
export function periodProgress(
  lines: readonly MorningGoalLine[],
): GoalProgress {
  return lines.reduce<GoalProgress>(
    (sum, { progress }) => ({
      done: sum.done + progress.done,
      total: sum.total + progress.total,
      achieved: sum.achieved && progress.achieved,
      connected: sum.connected || progress.connected,
    }),
    { done: 0, total: 0, achieved: lines.length > 0, connected: false },
  );
}

function SummaryRow({
  kind,
  lines,
  labels,
  compact,
  onOpen,
}: {
  kind: GoalPeriodKind;
  lines: readonly MorningGoalLine[];
  labels: MorningGoalsLabels;
  compact: boolean;
  onOpen: () => void;
}): React.JSX.Element {
  const [first] = lines;
  return (
    <li className="flex min-h-9 items-center gap-3 py-1">
      <span
        className={cn(BRIEFING_HINT_CLASS, "w-20 shrink-0 whitespace-nowrap")}
      >
        {labels.periodNames[kind]}
      </span>
      {first === undefined ? (
        // Unset: the row itself opens the panel, where goals are made.
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-lumen-sm text-left text-sm text-lumen-text-tertiary hover:text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
        >
          {labels.unset}
        </button>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm text-lumen-text">
            {first.title}
          </span>
          {lines.length > 1 && (
            <span className="shrink-0 whitespace-nowrap text-xs text-lumen-text-tertiary">
              {labels.more(lines.length - 1)}
            </span>
          )}
          {!compact && (
            <GoalStatusLine
              title={labels.periodNames[kind]}
              progress={periodProgress(lines)}
              labels={labels}
            />
          )}
        </>
      )}
    </li>
  );
}

export function MorningGoalsBlock({
  goals,
  labels,
  compact = false,
  reviewCount = 0,
  onOpen,
}: MorningGoalsBlockProps): React.JSX.Element {
  return (
    <section className="border-b border-lumen-border py-5">
      <BlockHead
        title={labels.title}
        action={
          // Never two lines (#2213 / #2286): the label keeps its width.
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpen}
            leadingIcon={<Target size={14} aria-hidden />}
            className="shrink-0 whitespace-nowrap max-md:min-h-11"
          >
            {labels.open}
          </Button>
        }
      />
      {reviewCount > 0 && (
        <button
          type="button"
          onClick={onOpen}
          className="mb-2 flex w-full items-center gap-2 rounded-lumen-sm border border-lumen-border bg-lumen-bg-secondary px-3 py-1.5 text-left text-sm text-lumen-text hover:text-lumen-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent max-md:min-h-11"
        >
          <span className="min-w-0 flex-1 truncate">
            {labels.reviewNotice(reviewCount)}
          </span>
          <ChevronRight size={14} aria-hidden className="shrink-0" />
        </button>
      )}
      <ul className="divide-y divide-lumen-border">
        {KINDS.map((kind) => (
          <SummaryRow
            key={kind}
            kind={kind}
            lines={goals[kind]}
            labels={labels}
            compact={compact}
            onOpen={onOpen}
          />
        ))}
      </ul>
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
 * One unanswered goal from an ended period, asked at the top of the goals
 * panel (on the paper itself until #2286). Two by two below `md` so each
 * answer keeps a 44px target on a phone; one row from `md` up.
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
