import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodoStagnationChart } from "../src/components/Analytics/TodoStagnationChart";
import { TodoWorkTimeChart } from "../src/components/Analytics/TodoWorkTimeChart";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #1478 — the last Analytics chart strings that never reached a catalog.
 *
 * The stagnation brackets ("< 1 week" … "3+ months") were literals inside
 * `aggregateTodoStagnation`, and the unattributed work-time row was a literal
 * inside `aggregateByTodo`, so the ja UI showed both in English while the ring
 * beside them said 「タグなし」. Both now arrive through props like every other
 * label, which is what these two tests pin: feed Japanese in, get Japanese out.
 *
 * recharts' ResponsiveContainer needs ResizeObserver (absent in jsdom), so the
 * primitives are stubbed the way tagWorkTimeChart.test.tsx does — the axes
 * spill the tick text so the mapping is assertable.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: { label?: string; name?: string }[];
    children: React.ReactNode;
  }) => (
    <ul>
      {data.map((d, i) => (
        <li key={i}>{d.label ?? d.name}</li>
      ))}
      {children}
    </ul>
  ),
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const JA_BUCKETS = {
  under1Week: "1週間未満",
  "1to2Weeks": "1〜2週間",
  "2to4Weeks": "2〜4週間",
  "1to3Months": "1〜3か月",
  over3Months: "3か月以上",
};

function todo(id: string, ageDays: number): TodoNode {
  const created = new Date();
  created.setDate(created.getDate() - ageDays);
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: created.toISOString(),
  } as TodoNode;
}

describe("stagnation brackets come from the catalog (#1478)", () => {
  it("renders the injected Japanese bracket names, not English literals", () => {
    render(
      <TodoStagnationChart
        nodes={[todo("task-1", 3), todo("task-2", 200)]}
        labels={{
          title: "経過日数",
          todos: "件",
          buckets: JA_BUCKETS,
        }}
      />,
    );

    const rows = screen.getAllByRole("listitem").map((el) => el.textContent);
    expect(rows).toEqual([
      "1週間未満",
      "1〜2週間",
      "2〜4週間",
      "1〜3か月",
      "3か月以上",
    ]);
    expect(rows.some((r) => r?.includes("month"))).toBe(false);
  });
});

describe("the unattributed work row comes from the catalog (#1478)", () => {
  it("names a session with no todo through labels.noTodo", () => {
    const session = {
      id: 1,
      todoId: null,
      sessionType: "WORK",
      startedAt: new Date(),
      completedAt: new Date(),
      duration: 1800,
      completed: true,
      label: null,
    } as unknown as TimerSession;

    render(
      <TodoWorkTimeChart
        sessions={[session]}
        todoNameMap={new Map()}
        labels={{
          title: "Todo 別作業時間",
          sessions: "セッション",
          noTodo: "Todo なし",
        }}
      />,
    );

    expect(screen.getByText("Todo なし")).toBeTruthy();
    expect(screen.queryByText("No Todo")).toBeNull();
  });
});
