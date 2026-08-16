import { lazy, Suspense } from "react";
import type { TodoNode } from "../../types/todoTree";
import type { TimerSession } from "../../types/timer";
import {
  StreakDisplay,
  type StreakDisplayLabels,
} from "../Analytics/StreakDisplay";
import type { TodoCompletionTrendLabels } from "../Analytics/TodoCompletionTrend";
import type { WorkBreakBalanceLabels } from "../Analytics/WorkBreakBalance";
import { ChartCard } from "../Analytics/ChartCard";
import { CHART_HEIGHT_MD } from "../Analytics/chartTheme";

/*
 * The two recharts-backed widgets load on demand (#991).
 *
 * Briefing is the default landing section (useStartupSection), so anything it
 * imports statically is in the first download. recharts is ~245 KB of it, and
 * these two charts were the only thing keeping it there — Analytics and
 * Connect have been code-split since #676 (a). Measured on #797: lazy() was
 * reaching 9% of a 2,090 KB initial bundle (gzip 586 KB).
 *
 * D-20260812-web-1 chose to leave this alone, and named its own condition for
 * revisiting: "when the briefing's first paint is measured slow, not felt
 * slow". #797 is that measurement, and #991 is the Issue it produced.
 *
 * StreakDisplay stays static on purpose — it draws a number and a row of
 * marks, imports no charting library at all (grep: zero recharts references),
 * and so costs nothing to keep. Deferring it would buy no bytes and add a
 * second boundary for the panel to flicker through.
 *
 * `import type` for the label types: type-only imports are erased, so they
 * name the same modules without pulling them into this chunk.
 */
const TodoCompletionTrend = lazy(() =>
  import("../Analytics/TodoCompletionTrend").then((m) => ({
    default: m.TodoCompletionTrend,
  })),
);

const WorkBreakBalance = lazy(() =>
  import("../Analytics/WorkBreakBalance").then((m) => ({
    default: m.WorkBreakBalance,
  })),
);

/**
 * Placeholder that occupies exactly what the chart will. ChartCard is the same
 * frame the real widget renders into and carries no charting code of its own,
 * so the title lands in its final position and only the plot area fills in —
 * the panel does not jump when the chunk arrives.
 */
function ChartPlaceholder({ title }: { title: string }) {
  return (
    <ChartCard title={title}>
      <div style={{ height: CHART_HEIGHT_MD }} aria-hidden />
    </ChartCard>
  );
}

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
        {/* One boundary around both charts, not one each: they arrive in the
            same chunk, so two boundaries would only add a second way for the
            panel to be half-drawn. */}
        <Suspense
          fallback={
            <>
              <ChartPlaceholder title={trendLabels.title} />
              <ChartPlaceholder title={balanceLabels.title} />
            </>
          }
        >
          <TodoCompletionTrend
            nodes={todoNodes}
            days={7}
            labels={trendLabels}
          />
          <WorkBreakBalance
            sessions={sessions}
            days={7}
            labels={balanceLabels}
          />
        </Suspense>
      </div>
    </section>
  );
}
