import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagWorkTimeChart } from "../src/components/Analytics/TagWorkTimeChart";
import type { TimerSession } from "../src/types/timer";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";
import type { TaskNode } from "../src/types/taskTree";

/*
 * #334: the aggregation tests cover the buckets; this covers the mapping from
 * buckets to slices — which label and which colour each `kind` gets. recharts'
 * ResponsiveContainer needs ResizeObserver (absent in jsdom), so the chart
 * primitives are stubbed the way scheduleTab.test.tsx does, with <Pie> spilling
 * its data so the mapping is assertable.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Pie: ({
    data,
    children,
  }: {
    data: { name: string; value: number }[];
    children: React.ReactNode;
  }) => (
    <ul>
      {data.map((d, i) => (
        <li key={i}>{`${d.name} = ${d.value}`}</li>
      ))}
      {children}
    </ul>
  ),
  Cell: ({ fill }: { fill: string }) => <span data-testid="cell">{fill}</span>,
  Tooltip: () => null,
  Legend: () => null,
}));

const LABELS = {
  title: "Work Time by Tag",
  noData: "No work time recorded yet",
  untagged: "Untagged",
  other: "Other tags",
  formatHours: (minutes: number) => `${Math.round(minutes)}m`,
};

function tag(id: string, name: string, color: string | null): WikiTag {
  return {
    id,
    name,
    color,
    icon: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    version: 1,
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

function session(id: number, taskId: string | null, minutes: number) {
  return {
    id,
    taskId,
    sessionType: "WORK",
    startedAt: new Date("2026-07-11T10:00:00"),
    completedAt: new Date("2026-07-11T10:30:00"),
    duration: minutes * 60,
    completed: true,
    label: null,
  } as unknown as TimerSession;
}

/** Live task tree stand-in — ids absent from it read as trashed (#428). */
function liveTasks(...ids: string[]): TaskNode[] {
  return ids.map((id, i) => ({
    id,
    type: "task",
    title: id,
    parentId: null,
    order: i,
    createdAt: "2025-01-01T00:00:00.000Z",
  }));
}

function fills(): string[] {
  return screen.getAllByTestId("cell").map((el) => el.textContent ?? "");
}

describe("TagWorkTimeChart slice mapping (#334)", () => {
  it("labels the synthetic slices from props and mutes their colour", () => {
    // 12 tags so two of them fall past the top-10 cap, plus untagged work.
    const tags = Array.from({ length: 12 }, (_, i) =>
      tag(`tag-${i}`, `Tag ${i}`, "#112233"),
    );
    const sessions = tags.map((t, i) => session(i + 1, `task-${i}`, i + 1));
    sessions.push(session(99, "task-none", 5));
    const assignments = tags.map((t, i) => assignment(`task-${i}`, t.id));

    render(
      <TagWorkTimeChart
        sessions={sessions}
        nodes={liveTasks(...tags.map((_, i) => `task-${i}`), "task-none")}
        assignments={assignments}
        tags={tags}
        labels={LABELS}
      />,
    );

    // Tail folded, not dropped: tag-0 (1) + tag-1 (2) = 3 minutes.
    expect(screen.getByText("Other tags = 3")).toBeInTheDocument();
    expect(screen.getByText("Untagged = 5")).toBeInTheDocument();
    expect(screen.getByText("Tag 11 = 12")).toBeInTheDocument();

    const cells = fills();
    expect(cells).toHaveLength(12); // 10 tags + other + untagged
    expect(cells.at(-2)).toBe("var(--color-lumen-text-secondary)"); // other
    expect(cells.at(-1)).toBe("var(--color-lumen-text-tertiary)"); // untagged
  });

  it("uses the tag's own colour, falling back to the categorical palette", () => {
    render(
      <TagWorkTimeChart
        sessions={[session(1, "task-a", 30), session(2, "task-b", 10)]}
        nodes={liveTasks("task-a", "task-b")}
        assignments={[
          assignment("task-a", "tag-a"),
          assignment("task-b", "tag-b"),
        ]}
        tags={[tag("tag-a", "Tag A", "#ff0000"), tag("tag-b", "Tag B", null)]}
        labels={LABELS}
      />,
    );

    expect(fills()).toEqual(["#ff0000", "var(--color-chart-cat-2)"]);
  });

  it("renders the empty state when no work time is logged", () => {
    render(
      <TagWorkTimeChart
        sessions={[]}
        nodes={liveTasks("task-a")}
        assignments={[assignment("task-a", "tag-a")]}
        tags={[tag("tag-a", "Tag A", "#ff0000")]}
        labels={LABELS}
      />,
    );

    expect(screen.getByText("No work time recorded yet")).toBeInTheDocument();
    expect(screen.queryAllByTestId("cell")).toHaveLength(0);
  });
});
