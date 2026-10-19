import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ScheduleSidebarTabs,
  type ScheduleSidebarTab,
} from "../src/components";

/*
 * ScheduleSidebarTabs — the frame the Schedule section pushes into the shared
 * detail panel. It owns two decisions worth pinning: whether the switcher
 * shows at all, and how its labels are allowed to break.
 *
 * The labels here are the real ja ones on purpose. They are why #1343 exists:
 * at the panel's default 320px, 「今日の流れ」and「本日の Todo」were breaking
 * mid-label while「繰り返し」was not, so the three tabs stopped reading as one
 * control. jsdom has no layout (CLAUDE.md §7.1) — the widths are not
 * observable here, only the contract that fixes them.
 */

const TABS: ScheduleSidebarTab[] = [
  { id: "flow", label: "今日の流れ" },
  { id: "todo", label: "本日の Todo" },
  { id: "repeats", label: "繰り返し" },
];

function renderTabs(tabs: ScheduleSidebarTab[] = TABS) {
  const onChange = vi.fn();
  render(
    <ScheduleSidebarTabs
      tabs={tabs}
      value={tabs[0]?.id ?? ""}
      onChange={onChange}
      label="詳細パネル"
    >
      <p>body</p>
    </ScheduleSidebarTabs>,
  );
  return { onChange };
}

describe("ScheduleSidebarTabs", () => {
  it("keeps the three tabs on one row and cuts a label that will not fit (#2281)", () => {
    // #1343 wrapped the track instead, and at the panel's minimum width
    // 繰り返し still ran past the edge. One row, equal shares, "…" on overrun.
    renderTabs();
    expect(screen.getByRole("tablist")).not.toHaveClass("flex-wrap");
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("min-w-0");
      expect(tab.querySelector("span.truncate")).not.toBeNull();
      expect(tab).toHaveAttribute("title", tab.textContent ?? "");
    }
  });

  it("gives the labels the room that takes", () => {
    renderTabs();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveClass("px-1");
      expect(tab).not.toHaveClass("px-1.5");
      expect(tab).toHaveClass("text-xs");
    }
  });

  it("drops the switcher entirely with a single tab", () => {
    // The shell panel already shows a "詳細" heading, so a one-segment track
    // would be a control with nothing to choose between.
    renderTabs([TABS[0]!]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("names the panel after the tab that is showing", () => {
    renderTabs();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-label",
      "今日の流れ",
    );
  });
});
