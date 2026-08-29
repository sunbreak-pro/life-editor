import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  DailyEntriesPanel,
  type DailyEntriesPanelEntry,
} from "../src/components";

/*
 * Materials mini-plan Step 4 — Daily past-entries panel (rightSidebar, Desktop).
 * Pure presentation: the native date picker forwards its value, the heading +
 * entry rows render from props, and clicking an entry fires onSelectEntry with
 * the entry date. rightSidebar plumbing is covered elsewhere and deliberately
 * not re-tested here.
 *
 * #1189 removed the today / yesterday toggles that this suite used to pin. They
 * set the same selected date the picker and the rows set, so they read as a
 * filter that did nothing — the last assertion below is what remains of them:
 * the panel offers exactly one way to reach a day that has no entry yet.
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
  pickerLabel: "2026/07/05",
  datePickerLabel: "Pick a date",
  entriesHeading: "Entries (2)",
  pinnedLabel: "Pinned",
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof DailyEntriesPanel>> = {},
) {
  const props: React.ComponentProps<typeof DailyEntriesPanel> = {
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

  it("offers no day jump beside the picker (#1189)", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yesterday" })).toBeNull();
    // Every remaining button in the panel is an entry row.
    expect(screen.getAllByRole("button")).toHaveLength(ENTRIES.length);
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
