import type { TodoNode } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import {
  StreakDisplay,
  type StreakDisplayLabels,
} from "../Analytics/StreakDisplay";
import {
  TodoCompletionTrend,
  type TodoCompletionTrendLabels,
} from "../Analytics/TodoCompletionTrend";
import {
  WorkBreakBalance,
  type WorkBreakBalanceLabels,
} from "../Analytics/WorkBreakBalance";

/*
 * 「きのうまでの自分」— the morning paper's visual zone, moved out of the
 * paper's own column and into the shared detail panel (#938).
 *
 * Why it left the paper: the three widgets look BACKWARDS (streak, the last
 * seven days of completions, work/break balance) while everything above them
 * on the page is about today. Read top to bottom, the paper kept breaking its
 * own thread — and the widgets pushed 持ち越し, which IS about today, below the
 * fold. In the detail panel they are a thing you go and look at, which is what
 * they always were.
 *
 * Nothing about the data changed: the host still computes it (the same
 * BriefingData it feeds the paper) and still resolves the widget copy from the
 * existing analytics.* keys. Only the destination moved.
 *
 * The panel is one column, not the paper's `sm:grid-cols-2` — the well is
 * ~320px wide (RightSidebarContext DEFAULT_WIDTH) and two columns there would
 * squeeze each chart below the width its axis labels need.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation.
 */
export interface BriefingVizPanelProps {
  /** Timer sessions — feeds StreakDisplay + WorkBreakBalance. */
  sessions: TimerSession[];
  /** Full todo tree — feeds TodoCompletionTrend. */
  todoNodes: TodoNode[];
  /** Panel heading (「きのうまでの自分」— briefing.vizTitle). */
  title: string;
  streakLabels: StreakDisplayLabels;
  trendLabels: TodoCompletionTrendLabels;
  balanceLabels: WorkBreakBalanceLabels;
}

export function BriefingVizPanel({
  sessions,
  todoNodes,
  title,
  streakLabels,
  trendLabels,
  balanceLabels,
}: BriefingVizPanelProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      {/* Same heading shape as the tray above it, not the paper's 段標 —
          inside the panel these are two peers, and a 朱 bar here would claim
          the panel is a second front page. */}
      <h3 className="text-sm font-semibold text-lumen-text">{title}</h3>
      <div className="flex flex-col gap-3">
        <StreakDisplay sessions={sessions} labels={streakLabels} />
        <TodoCompletionTrend nodes={todoNodes} days={7} labels={trendLabels} />
        <WorkBreakBalance sessions={sessions} days={7} labels={balanceLabels} />
      </div>
    </section>
  );
}
