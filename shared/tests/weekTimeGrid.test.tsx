import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeekTimeGrid, type WeekTimeGridItem } from "../src/components";

/*
 * WeekTimeGrid (W8) — pure presentational grid. It does NOT call useMediaQuery
 * (the host switches wide↔narrow), so no matchMedia mock is needed; it renders
 * identically under jsdom. We assert the header, all-day lane, timed events,
 * and that clicking an event reports its id back to the host.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const items: WeekTimeGridItem[] = [
  { id: "a", date: "2026-06-14", title: "Standup", startTime: "09:00", endTime: "09:30" },
  { id: "b", date: "2026-06-15", title: "Vacation", startTime: "00:00", endTime: "23:59", isAllDay: true },
  { id: "c", date: "2026-06-14", title: "Review", startTime: "09:15", endTime: "10:00" },
];

function renderGrid(props?: Partial<Parameters<typeof WeekTimeGrid>[0]>) {
  const onSelectItem = vi.fn();
  render(
    <WeekTimeGrid
      weekStart="2026-06-14"
      items={items}
      weekdayLabels={WEEKDAYS}
      allDayLabel="All-day"
      todayKey="2026-06-14"
      onSelectItem={onSelectItem}
      {...props}
    />,
  );
  return { onSelectItem };
}

describe("WeekTimeGrid", () => {
  it("renders the weekday header for all seven days", () => {
    renderGrid();
    for (const label of WEEKDAYS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders the all-day lane label and an all-day event", () => {
    renderGrid();
    expect(screen.getByText("All-day")).toBeInTheDocument();
    expect(screen.getByText("Vacation")).toBeInTheDocument();
  });

  it("renders timed events", () => {
    renderGrid();
    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("reports the clicked event id to the host", () => {
    const { onSelectItem } = renderGrid();
    fireEvent.click(screen.getByText("Standup"));
    expect(onSelectItem).toHaveBeenCalledWith("a");
  });

  it("reports the clicked all-day event id to the host", () => {
    const { onSelectItem } = renderGrid();
    fireEvent.click(screen.getByText("Vacation"));
    expect(onSelectItem).toHaveBeenCalledWith("b");
  });

  it("supports a single-day column via days={1}", () => {
    renderGrid({ days: 1 });
    // Only Sunday's column (2026-06-14) is present.
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.queryByText("Mon")).not.toBeInTheDocument();
  });
});
