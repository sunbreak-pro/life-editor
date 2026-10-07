import { ArrowRight } from "lucide-react";
import { cn } from "../cn";
import type { GoalProgress } from "./goalLinkPreview";

/*
 * The small pieces both linking screens share (#2109): a goal's progress as
 * text, the "before → after" line shown ahead of a save, and the chip that
 * says an achievement just came off (S1 / S2).
 *
 * Colours are the plan's (§デザイン): achieved = mint chip, not achieved = 朱
 * on its subtle ground. Never colour alone — every state also has its word.
 */

export interface GoalProgressLabels {
  /** 「未接続」— shown instead of 0/0. */
  unconnected: string;
  /** 「達成」 */
  achieved: string;
  /** 「達成になります」 */
  becomesAchieved: string;
  /** 「達成が外れます」 */
  losesAchievement: string;
}

const CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-xs";
export const GOAL_CHIP_ACHIEVED = cn(
  CHIP,
  "bg-lumen-chip-mint-bg text-lumen-chip-mint-fg",
);
export const GOAL_CHIP_UNACHIEVED = cn(
  CHIP,
  "bg-lumen-briefing-shu-subtle text-lumen-briefing-shu",
);

/** 「2/4」, or 「未接続」 when nothing is linked. */
export function goalProgressText(
  progress: GoalProgress,
  labels: Pick<GoalProgressLabels, "unconnected">,
): string {
  return progress.connected
    ? `${progress.done}/${progress.total}`
    : labels.unconnected;
}

export function GoalProgressDelta({
  title,
  before,
  after,
  labels,
}: {
  title: string;
  before: GoalProgress;
  after: GoalProgress;
  labels: GoalProgressLabels;
}): React.JSX.Element {
  const verdict =
    !before.achieved && after.achieved
      ? { text: labels.becomesAchieved, className: GOAL_CHIP_ACHIEVED }
      : before.achieved && !after.achieved
        ? { text: labels.losesAchievement, className: GOAL_CHIP_UNACHIEVED }
        : null;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="min-w-0 truncate text-lumen-text">{title}</span>
      <span className="inline-flex items-center gap-1 tabular-nums text-lumen-text-secondary">
        {goalProgressText(before, labels)}
        <ArrowRight aria-hidden className="size-3.5" />
        <span className="font-medium text-lumen-text">
          {goalProgressText(after, labels)}
        </span>
      </span>
      {verdict && <span className={verdict.className}>{verdict.text}</span>}
    </li>
  );
}

/**
 * S1 / S2: the achievement that the last operation took away. Held only by
 * the screen the operation happened in — never saved (plan §デザイン).
 */
export function GoalAchievementLostNotice({
  label,
  titles,
}: {
  /** 「達成が外れました」 */
  label: string;
  titles: readonly string[];
}): React.JSX.Element | null {
  if (titles.length === 0) return null;
  return (
    <p role="status" className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className={GOAL_CHIP_UNACHIEVED}>{label}</span>
      {titles.map((title, i) => (
        <span key={`${i}-${title}`} className="text-lumen-text-secondary">
          {title}
        </span>
      ))}
    </p>
  );
}
