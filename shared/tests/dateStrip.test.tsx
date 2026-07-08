import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateStrip, type DateStripDay } from "../src/components";

/*
 * Daily Mobile date chip row. Equal-width chips carry weekday + day labels;
 * the selected date is aria-pressed and clicking a chip emits its date.
 */
const DAYS: DateStripDay[] = [
  { date: "2026-07-06", weekdayLabel: "月", dayLabel: "7/6", hasEntry: true },
  { date: "2026-07-07", weekdayLabel: "火", dayLabel: "7/7", hasEntry: false },
  { date: "2026-07-08", weekdayLabel: "水", dayLabel: "7/8", hasEntry: true },
];

function renderStrip(props?: Partial<Parameters<typeof DateStrip>[0]>) {
  const onSelect = vi.fn();
  render(
    <DateStrip
      days={DAYS}
      selectedDate="2026-07-08"
      onSelect={onSelect}
      label="Pick a day"
      {...props}
    />,
  );
  return { onSelect };
}

describe("DateStrip", () => {
  it("renders a chip per day with weekday + day labels", () => {
    renderStrip();
    expect(screen.getAllByRole("button")).toHaveLength(DAYS.length);
    expect(screen.getByText("7/6")).toBeInTheDocument();
    expect(screen.getByText("火")).toBeInTheDocument();
  });

  it("marks the selected date with aria-pressed", () => {
    renderStrip();
    expect(
      screen.getByRole("button", { name: /7\/8/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /7\/6/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("emits the date on click", () => {
    const { onSelect } = renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /7\/6/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-07-06");
  });

  it("exposes an accessible group label", () => {
    renderStrip();
    expect(
      screen.getByRole("group", { name: "Pick a day" }),
    ).toBeInTheDocument();
  });
});
