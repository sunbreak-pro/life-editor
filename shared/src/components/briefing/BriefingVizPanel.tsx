import { lazy, Suspense } from "react";
import type { TodoNode } from "../../types/todoTree";
import type { TodoCompletionTrendLabels } from "../Analytics/TodoCompletionTrend";
import { ChartCard } from "../Analytics/ChartCard";
import {
  CHART_HEIGHT_MD,
  MAX_DATE_TICKS,
  NARROW_MAX_DATE_TICKS,
} from "../Analytics/chartTheme";
import { WIDE_QUERY } from "../../constants/breakpoints";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { PANEL_BLOCK_RULE } from "./briefingStyles";

/*
 * The recharts-backed widget loads on demand (#991).
 *
 * Briefing is the default landing section (useStartupSection), so anything it
 * imports statically is in the first download. recharts is ~245 KB of it, and
 * this chart is the only thing that would keep it there — Analytics and
 * Connect have been code-split since #676 (a). Measured on #797: lazy() was
 * reaching 9% of a 2,090 KB initial bundle (gzip 586 KB).
 *
 * D-20260812-web-1 chose to leave this alone, and named its own condition for
 * revisiting: "when the briefing's first paint is measured slow, not felt
 * slow". #797 is that measurement, and #991 is the Issue it produced.
 *
 * `import type` for the label type: type-only imports are erased, so it
 * names the same module without pulling it into this chunk.
 */
const TodoCompletionTrend = lazy(() =>
  import("../Analytics/TodoCompletionTrend").then((m) => ({
    default: m.TodoCompletionTrend,
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
 * Why it left the paper: the widget looks BACKWARDS (the last seven days of
 * completions) while everything above it on the page is about today. Read top
 * to bottom, the paper kept breaking its own thread — and the widgets pushed
 * 持ち越し, which IS about today, below the fold. In the detail panel it is a
 * thing you go and look at, which is what it always was.
 *
 * Nothing about the data changed: the host still computes it (the same
 * BriefingData it feeds the paper) and still resolves the widget copy from the
 * existing analytics.* keys. Only the destination moved.
 *
 * The panel is one column, not the paper's `sm:grid-cols-2` — the well is
 * ~320px wide (RightSidebarContext DEFAULT_WIDTH) and two columns there would
 * squeeze each chart below the width its axis labels need.
 *
 * On a phone the panel is the MobileDrawer (~316px on a 390px screen), and the
 * 7-day axis prints every other day there (#2505) — seven labels touched and
 * read as one run of digits. The wide panel (~478px) keeps all seven, and
 * Analytics, which mounts the same charts, is not touched: the count is a prop.
 *
 * Pure presentation (§6.4): no DataService, no useTranslation.
 */
export interface BriefingVizPanelProps {
  /** Full todo tree — feeds TodoCompletionTrend. */
  todoNodes: TodoNode[];
  /** Panel heading (「きのうまでの自分」— briefing.vizTitle). */
  title: string;
  trendLabels: TodoCompletionTrendLabels;
}

export function BriefingVizPanel({
  todoNodes,
  title,
  trendLabels,
}: BriefingVizPanelProps): React.JSX.Element {
  // Fallback true (wide): jsdom has no matchMedia, and wide is what the panel
  // drew before #2505.
  const wide = useMediaQuery(WIDE_QUERY, true);
  const maxDateTicks = wide ? MAX_DATE_TICKS : NARROW_MAX_DATE_TICKS;
  return (
    <section className={`flex flex-col gap-3 ${PANEL_BLOCK_RULE}`}>
      {/* Same heading shape as the tray above it, not the paper's 段標 —
          inside the panel these are two peers, and a 朱 bar here would claim
          the panel is a second front page.

          The rule and the padding are what make them read as two (#1826). The
          detail well stacks its portals in a plain div with no gap of its own,
          so this heading's top and the todo tray's bottom both measured 387px
          —「きのうまでの自分」looked like the last line of the todo list. The
          4-unit padding is wider than the panel's own `gap-3`, so the heading
          now belongs to what is BELOW it rather than sitting midway between
          two blocks. Since the Todo tray left the morning panel (#2223) this
          is 朝刊's FIRST block, and `first:` drops the rule and the margin
          there (#2285) — a rule with nothing above it only pushed the
          heading down from the panel's top. */}
      <h3 className="text-sm font-semibold text-lumen-text">{title}</h3>
      <div className="flex flex-col gap-3">
        <Suspense fallback={<ChartPlaceholder title={trendLabels.title} />}>
          <TodoCompletionTrend
            nodes={todoNodes}
            days={7}
            labels={trendLabels}
            maxDateTicks={maxDateTicks}
          />
        </Suspense>
      </div>
    </section>
  );
}
