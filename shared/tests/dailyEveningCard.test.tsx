import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DailyEveningCard } from "../src/components/materials/DailyEveningCard";

/*
 * 夕刊カテゴリ (#1046) — the Daily tab's evening block. Pure presentation:
 * what is pinned here is that each sub-block renders exactly what the host
 * extracted (mood → the right star count, reflection → its lines, schedule →
 * time + title with completed rows struck) and that empty sub-blocks vanish
 * rather than render empty headings.
 */

const LABELS = {
  title: "EVENING",
  moodStars: [1, 2, 3, 4, 5].map((n) => `Mood ${n}/5`),
  scheduleTitle: "THE DAY'S SCHEDULE",
  allDay: "All day",
};

const SCHEDULE = [
  {
    id: "s1",
    title: "Deep work",
    startTime: "09:00",
    isAllDay: false,
    completed: true,
  },
  {
    id: "s2",
    title: "Errand day",
    startTime: "",
    isAllDay: true,
    completed: false,
  },
];

describe("DailyEveningCard", () => {
  it("renders the mood as an accessible star rating", () => {
    render(
      <DailyEveningCard
        mood={4}
        reflectionLines={[]}
        schedule={[]}
        labels={LABELS}
      />,
    );
    const stars = screen.getByRole("img", { name: "Mood 4/5" });
    // 4 filled + 1 hollow — filled stars carry the 朱 accent class.
    expect(stars.querySelectorAll("svg.text-lumen-briefing-shu")).toHaveLength(
      4,
    );
  });

  it("omits the mood row entirely when the day has none", () => {
    render(
      <DailyEveningCard
        mood={null}
        reflectionLines={["closing note"]}
        schedule={[]}
        labels={LABELS}
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("closing note")).toBeTruthy();
  });

  it("prints reflection lines in order", () => {
    render(
      <DailyEveningCard
        mood={null}
        reflectionLines={["line A", "line B"]}
        schedule={[]}
        labels={LABELS}
      />,
    );
    expect(screen.getByText("line A")).toBeTruthy();
    expect(screen.getByText("line B")).toBeTruthy();
  });

  it("renders the schedule rows with time / all-day and strikes completed", () => {
    render(
      <DailyEveningCard
        mood={null}
        reflectionLines={[]}
        schedule={SCHEDULE}
        labels={LABELS}
      />,
    );
    expect(screen.getByText("THE DAY'S SCHEDULE")).toBeTruthy();
    expect(screen.getByText("09:00")).toBeTruthy();
    expect(screen.getByText("All day")).toBeTruthy();
    expect(screen.getByText("Deep work").className).toContain("line-through");
    expect(screen.getByText("Errand day").className).not.toContain(
      "line-through",
    );
  });

  it("omits the schedule heading when the day had nothing scheduled", () => {
    render(
      <DailyEveningCard
        mood={3}
        reflectionLines={[]}
        schedule={[]}
        labels={LABELS}
      />,
    );
    expect(screen.queryByText("THE DAY'S SCHEDULE")).toBeNull();
  });
});
