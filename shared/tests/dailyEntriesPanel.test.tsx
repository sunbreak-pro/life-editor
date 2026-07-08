import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DailyEntriesPanel,
  type DailyEntriesPanelEntry,
} from "../src/components";

/*
 * Materials mini-plan Step 4 — Daily past-entries panel (rightSidebar, Desktop).
 * Pure presentation: the today / yesterday toggles report state via
 * aria-pressed and fire injected callbacks, the native date picker forwards its
 * value, the heading + entry rows render from props, and clicking an entry
 * fires onSelectEntry with the entry date. rightSidebar plumbing is covered
 * elsewhere and deliberately not re-tested here.
 */

const ENTRIES: DailyEntriesPanelEntry[] = [
  {
    date: "2026-07-04",
    dayLabel: "7/4（金）",
    excerpt: "予定と実績のズレを振り返った。",
    selected: false,
  },
  {
    date: "2026-07-01",
    dayLabel: "7/1（火）",
    excerpt: "今月の目標を立て直した。",
    isPinned: true,
    selected: false,
  },
];

const LABELS = {
  todayLabel: "Today",
  yesterdayLabel: "Yesterday",
  pickerLabel: "2026/07/05",
  datePickerLabel: "Pick a date",
  entriesHeading: "Entries (2)",
  pinnedLabel: "Pinned",
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof DailyEntriesPanel>> = {},
) {
  const props: React.ComponentProps<typeof DailyEntriesPanel> = {
    todaySelected: true,
    yesterdaySelected: false,
    onSelectToday: () => {},
    onSelectYesterday: () => {},
    pickerDate: "2026-07-05",
    onPickDate: () => {},
    entries: ENTRIES,
    onSelectEntry: () => {},
    ...LABELS,
    ...overrides,
  };
  return render(<DailyEntriesPanel {...props} />);
}

describe("DailyEntriesPanel", () => {
  it("renders the heading and every entry's day label + excerpt", () => {
    renderPanel();
    expect(screen.getByText("Entries (2)")).toBeInTheDocument();
    expect(screen.getByText("7/4（金）")).toBeInTheDocument();
    expect(screen.getByText("7/1（火）")).toBeInTheDocument();
    expect(
      screen.getByText("予定と実績のズレを振り返った。"),
    ).toBeInTheDocument();
    // The pinned entry surfaces its pin indicator via aria-label.
    expect(screen.getByLabelText("Pinned")).toBeInTheDocument();
  });

  it("reflects the selected date via the toggles' aria-pressed", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Yesterday" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("fires onSelectToday / onSelectYesterday on toggle click", () => {
    const onSelectToday = vi.fn();
    const onSelectYesterday = vi.fn();
    renderPanel({ onSelectToday, onSelectYesterday });
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(onSelectToday).toHaveBeenCalledTimes(1);
    expect(onSelectYesterday).toHaveBeenCalledTimes(1);
  });

  it("forwards a picked date through the native input", () => {
    const onPickDate = vi.fn();
    renderPanel({ onPickDate });
    fireEvent.change(screen.getByLabelText("Pick a date"), {
      target: { value: "2026-06-30" },
    });
    expect(onPickDate).toHaveBeenCalledWith("2026-06-30");
  });

  it("fires onSelectEntry with the entry date on row click", () => {
    const onSelectEntry = vi.fn();
    renderPanel({ onSelectEntry });
    fireEvent.click(screen.getByRole("button", { name: /7\/1（火）/ }));
    expect(onSelectEntry).toHaveBeenCalledWith("2026-07-01");
  });
});
