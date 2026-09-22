import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WorkTimeHeatmap } from "../src/components/Analytics/WorkTimeHeatmap";
import { TagUsageCard } from "../src/components/Analytics/TagUsageCard";
import {
  evenDateTicks,
  MAX_DATE_TICKS,
} from "../src/components/Analytics/chartTheme";
import {
  aggregateByHourAndDay,
  TAG_USAGE_LIMIT,
} from "../src/utils/analyticsAggregation";
import { WEEK_STARTS_ON } from "../src/utils/scheduleGridLayout";
import type { TimerSession } from "../src/types/timer";
import type { TodoNode } from "../src/types/todoTree";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";

/*
 * #1866 — three small things:
 *  1. the heatmap opened on a hardcoded Monday while the rest of Analytics
 *     opens its weeks on WEEK_STARTS_ON;
 *  2. Tag Usage stopped at 10 rows with no sign anything was left out;
 *  3. day axes thinned from the start, so only the LAST gap was uneven.
 */

const HEATMAP_LABELS = {
  title: "Heatmap",
  meta: "hour × day",
  less: "Less",
  more: "More",
  days: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  tooltip: (minutes: number) => `${minutes} min`,
};

function workSession(startedAt: Date): TimerSession {
  return {
    id: 1,
    todoId: null,
    sessionType: "WORK",
    startedAt,
    completedAt: startedAt,
    duration: 1800,
    completed: true,
    label: null,
  };
}

describe("heatmap rows open on the app-wide week start (#1866)", () => {
  it("lists the days from WEEK_STARTS_ON, not from a hardcoded Monday", () => {
    render(<WorkTimeHeatmap sessions={[]} labels={HEATMAP_LABELS} />);

    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const expected = names.map((_, i) => names[(WEEK_STARTS_ON + i) % 7]);
    const rendered = screen
      .getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
      .map((el) => el.textContent);

    expect(rendered).toEqual(expected);
  });

  it("keys cells on Date#getDay(), so row order stays a display choice", () => {
    // 2026-09-20 is a Sunday.
    const cells = aggregateByHourAndDay([
      workSession(new Date(2026, 8, 20, 14, 0, 0)),
    ]);
    const hit = cells.filter((c) => c.totalMinutes > 0);

    expect(hit).toEqual([{ dayOfWeek: 0, hour: 14, totalMinutes: 30 }]);
  });
});

const RANGE = {
  start: new Date(2026, 6, 1, 0, 0, 0, 0),
  end: new Date(2026, 6, 31, 23, 59, 59, 999),
};
const IN_RANGE = "2026-07-15T03:00:00.000Z";

const TAG_LABELS = {
  title: "Tag Usage",
  tag: "Tag",
  inRange: "Created in range",
  liveTotal: "Current total",
  rangeLabel: "Last 30 days",
  topOf: (shown: number, total: number) => `Top ${shown} of ${total} tags`,
  empty: { title: "No tagged items", description: "Tag something." },
};

function renderTagUsage(tagCount: number): void {
  const todos = Array.from({ length: tagCount }, (_, i) => ({
    id: `task-${i}`,
    type: "task",
    title: `task-${i}`,
    parentId: null,
    order: i,
    createdAt: IN_RANGE,
  })) as unknown as TodoNode[];
  const tags = Array.from({ length: tagCount }, (_, i) => ({
    id: `tag-${i}`,
    name: `tag-${String(i).padStart(2, "0")}`,
    color: null,
    isDeleted: false,
  })) as unknown as WikiTag[];
  const assignments = Array.from({ length: tagCount }, (_, i) => ({
    id: `a-${i}`,
    itemId: `task-${i}`,
    tagId: `tag-${i}`,
    isDeleted: false,
  })) as unknown as WikiTagAssignment[];

  render(
    <TagUsageCard
      todos={todos}
      events={[]}
      notes={[]}
      assignments={assignments}
      tags={tags}
      dateRange={RANGE}
      labels={TAG_LABELS}
    />,
  );
}

describe("Tag Usage says when it is showing a top-N (#1866)", () => {
  it("caps the rows and names how many tags there are", () => {
    renderTagUsage(15);

    const body = screen.getByRole("table").querySelector("tbody");
    expect(within(body as HTMLElement).getAllByRole("row")).toHaveLength(
      TAG_USAGE_LIMIT,
    );
    expect(
      screen.getByText(`Top ${TAG_USAGE_LIMIT} of 15 tags`),
    ).toBeInTheDocument();
  });

  it("says nothing when every tag fits", () => {
    renderTagUsage(TAG_USAGE_LIMIT);

    expect(screen.queryByText(/^Top /)).toBeNull();
  });
});

describe("evenDateTicks (#1866)", () => {
  const days = Array.from(
    { length: 30 },
    (_, i) => `d${String(i).padStart(2, "0")}`,
  );

  it("always ends on the last label — today", () => {
    const ticks = evenDateTicks(days);
    expect(ticks[ticks.length - 1]).toBe("d29");
  });

  it("keeps every gap equal, the last one included", () => {
    const idx = evenDateTicks(days).map((t) => days.indexOf(t));
    const gaps = idx.slice(1).map((v, i) => v - idx[i]);

    expect(new Set(gaps).size).toBe(1);
    expect(idx.length).toBeLessThanOrEqual(MAX_DATE_TICKS);
  });

  it("labels every point when there are few enough", () => {
    expect(evenDateTicks(days.slice(0, 7))).toEqual(days.slice(0, 7));
  });
});
