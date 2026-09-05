import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TagWorkTimeChart } from "../src/components/Analytics/TagWorkTimeChart";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * #1477 — the ring's share moved from a leader-line label to the legend.
 *
 * recharts draws `<Pie label>` OUTSIDE the chart box and never clips it to the
 * card, so a long tag name ran past the card's right edge and was cut mid-word
 * ("PWV1408-tag (" — 13px over at 1280x800). Two things are pinned here: the
 * Pie carries no `label`/`labelLine` any more, and the percentage is still
 * shown, now through the legend's formatter.
 *
 * The share must be looked up by NAME: <Legend> sorts alphabetically by
 * default, so formatting by index would put "Untagged 60%" on the wrong row.
 */
const captured = vi.hoisted(() => ({
  pie: null as Record<string, unknown> | null,
  legend: null as { formatter?: (name: string) => string } | null,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: (props: Record<string, unknown>) => {
    captured.pie = props;
    return null;
  },
  Cell: () => null,
  Tooltip: () => null,
  Legend: (props: { formatter?: (name: string) => string }) => {
    captured.legend = props;
    return null;
  },
}));

const LABELS = {
  title: "Work Time by Tag",
  noData: "No work time recorded yet",
  untagged: "Untagged",
  other: "Other tags",
  formatHours: (minutes: number) => `${Math.round(minutes)}m`,
};

function tag(id: string, name: string): WikiTag {
  return {
    id,
    name,
    color: "#112233",
    icon: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  };
}

function assignment(itemId: string, tagId: string): WikiTagAssignment {
  return {
    id: `asg-${itemId}-${tagId}`,
    itemId,
    tagId,
    updatedAt: "2025-01-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  };
}

function todo(id: string): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
  } as TodoNode;
}

function session(id: number, minutes: number, todoId: string): TimerSession {
  return {
    id,
    todoId,
    sessionType: "WORK",
    startedAt: new Date(),
    completedAt: new Date(),
    duration: minutes * 60,
    completed: true,
    label: null,
  } as unknown as TimerSession;
}

/** 75 min on a tagged todo, 25 min on an untagged one → 75% / 25%. */
function renderChart(): void {
  render(
    <TagWorkTimeChart
      sessions={[session(1, 75, "task-1"), session(2, 25, "task-2")]}
      nodes={[todo("task-1"), todo("task-2")]}
      events={[]}
      assignments={[assignment("task-1", "tag-1")]}
      tags={[tag("tag-1", "PWV1408-tag")]}
      labels={LABELS}
    />,
  );
}

describe("tag ring keeps its labels inside the card (#1477)", () => {
  it("draws no leader-line label on the pie", () => {
    renderChart();

    expect(captured.pie?.label).toBeUndefined();
    expect(captured.pie?.labelLine).toBeUndefined();
  });

  it("shows each slice's share through the legend, matched by name", () => {
    renderChart();

    const format = captured.legend?.formatter;
    expect(format).toBeTypeOf("function");
    expect(format?.("PWV1408-tag")).toBe("PWV1408-tag 75%");
    expect(format?.("Untagged")).toBe("Untagged 25%");
  });
});
