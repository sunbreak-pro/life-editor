import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { TodoNode } from "../src/types/todoTree";
import type { ScheduleItem } from "../src/types/schedule";
import type { NoteNode } from "../src/types/note";
import type {
  WikiTag,
  WikiTagAssignment,
} from "../src/types/wikiTagUnified";
import {
  TagUsageCard,
  type TagUsageCardLabels,
} from "../src/components/Analytics/TagUsageCard";

/*
 * Tag usage card (#1379). The aggregation's own semantics live in
 * analyticsAggregation.test.ts; what this suite protects is the part a user
 * actually reads — that BOTH numbers reach the screen, that each one sits under
 * a header naming its window, and that all three roles feed the counts.
 *
 * Times are midday JST (TZ is pinned in vitest.config.ts, #449) so the local
 * calendar key the range is sliced on is never a boundary case.
 */
const LABELS: TagUsageCardLabels = {
  title: "Tag Usage",
  tag: "Tag",
  inRange: "Created in range",
  liveTotal: "Current total",
  rangeLabel: "Last 30 days",
  empty: { title: "No tagged items", description: "Tag something." },
};

/** 2026-07-15 12:00 JST — inside the range every test below uses. */
const IN_RANGE = "2026-07-15T03:00:00.000Z";
/** 2026-05-15 12:00 JST — before it. */
const BEFORE_RANGE = "2026-05-15T03:00:00.000Z";

const RANGE = {
  start: new Date(2026, 6, 1, 0, 0, 0),
  end: new Date(2026, 6, 31, 23, 59, 59),
};

function todo(id: string, createdAt: string): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    createdAt,
  };
}

function event(id: string, createdAt: string): ScheduleItem {
  return {
    id,
    date: "2026-07-15",
    title: id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function note(id: string, createdAt: string): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  };
}

function tag(id: string, name: string): WikiTag {
  return {
    id,
    name,
    color: "#ff0000",
    icon: null,
    createdAt: BEFORE_RANGE,
    updatedAt: BEFORE_RANGE,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

function assign(id: string, itemId: string, tagId: string): WikiTagAssignment {
  return {
    id,
    itemId,
    tagId,
    updatedAt: BEFORE_RANGE,
    isDeleted: false,
    deletedAt: null,
  };
}

/** The cells of the row whose tag cell reads `tagName`, in column order. */
function rowCells(tagName: string): string[] {
  const row = screen.getByText(tagName).closest("tr");
  expect(row).not.toBeNull();
  return within(row as HTMLElement)
    .getAllByRole("cell")
    .map((cell) => cell.textContent?.trim() ?? "");
}

describe("TagUsageCard", () => {
  it("counts Todo, Event and Note under one tag and labels both windows", () => {
    render(
      <TagUsageCard
        todos={[todo("task-1", IN_RANGE)]}
        events={[event("event-1", IN_RANGE)]}
        // Created before the range: it lifts the total but not the range count,
        // which is the whole point of showing two numbers.
        notes={[note("note-1", BEFORE_RANGE)]}
        assignments={[
          assign("asg-1", "task-1", "tag-a"),
          assign("asg-2", "event-1", "tag-a"),
          assign("asg-3", "note-1", "tag-a"),
        ]}
        tags={[tag("tag-a", "Work")]}
        dateRange={RANGE}
        labels={LABELS}
      />,
    );

    // Both windows are NAMED, not implied — a column header each, plus the
    // active preset beside the title so "in range" says which range.
    expect(
      screen.getByRole("columnheader", { name: LABELS.inRange }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: LABELS.liveTotal }),
    ).toBeInTheDocument();
    expect(screen.getByText(LABELS.rangeLabel)).toBeInTheDocument();

    // [tag, created in range, current total] — the todo and the event, then
    // all three items.
    expect(rowCells("Work")).toEqual(["Work", "2", "3"]);
  });

  it("ranks tags by the range count", () => {
    render(
      <TagUsageCard
        todos={[
          todo("task-1", IN_RANGE),
          todo("task-2", IN_RANGE),
          todo("task-3", IN_RANGE),
        ]}
        events={[]}
        notes={[]}
        assignments={[
          assign("asg-1", "task-1", "tag-a"),
          assign("asg-2", "task-2", "tag-b"),
          assign("asg-3", "task-3", "tag-b"),
        ]}
        tags={[tag("tag-a", "Admin"), tag("tag-b", "Work")]}
        dateRange={RANGE}
        labels={LABELS}
      />,
    );

    const names = screen
      .getAllByRole("row")
      // Drop the header row; each body row's first cell is the tag name.
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[0].textContent?.trim());
    expect(names).toEqual(["Work", "Admin"]);
  });

  it("shows the designed empty state when nothing in the range is tagged", () => {
    render(
      <TagUsageCard
        todos={[todo("task-1", BEFORE_RANGE)]}
        events={[]}
        notes={[]}
        assignments={[assign("asg-1", "task-1", "tag-a")]}
        tags={[tag("tag-a", "Work")]}
        dateRange={RANGE}
        labels={LABELS}
      />,
    );

    expect(screen.getByText(LABELS.empty.title)).toBeInTheDocument();
    expect(screen.getByText(LABELS.empty.description)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
