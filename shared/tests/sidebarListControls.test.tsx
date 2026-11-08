import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SidebarListControls, type SidebarSortMode } from "../src/components";

/*
 * #283 — sidebar sort + optional-filter controls (Notes / Daily rightSidebar).
 * Since #2577 the sort is ONE button that opens a chip panel in place: the
 * modes in one row, the two orders in the next, the pressed chip being the
 * active one. Pure presentation: every chip and the filter fire injected
 * callbacks; the filter is onChange-only (IME safety); a single mode hides the
 * mode chips; omitting the filter config renders no input.
 */

const MODES: SidebarSortMode[] = [
  { id: "updatedAt", label: "Updated" },
  { id: "createdAt", label: "Created" },
  { id: "title", label: "Title" },
];

const DIRECTIONS = [
  { id: "desc" as const, label: "Newest first" },
  { id: "asc" as const, label: "Oldest first" },
];

function renderControls(
  overrides: Partial<React.ComponentProps<typeof SidebarListControls>> = {},
) {
  const props: React.ComponentProps<typeof SidebarListControls> = {
    modes: MODES,
    activeModeId: "updatedAt",
    onModeChange: () => {},
    sortLabel: "Sort",
    modeGroupLabel: "Sort by",
    directionGroupLabel: "Order",
    directions: DIRECTIONS,
    direction: "desc",
    onDirectionChange: () => {},
    ...overrides,
  };
  return render(<SidebarListControls {...props} />);
}

const trigger = () => screen.getByRole("button", { name: "Sort" });
const openPanel = () => {
  fireEvent.click(trigger());
  return screen.getByRole("group", { name: "Sort" });
};

describe("SidebarListControls", () => {
  it("draws one button naming the active mode and order", () => {
    renderControls({ activeModeId: "title" });
    expect(trigger()).toHaveTextContent("Title · Newest first");
    expect(trigger()).toHaveAccessibleDescription("Title · Newest first");
    // No second control for the order beside it.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("joins the summary with the host's formatter", () => {
    renderControls({ formatSummary: (mode, order) => `${mode}・${order}` });
    expect(trigger()).toHaveTextContent("Updated・Newest first");
  });

  it("opens and closes the panel from the button, accent while open", () => {
    renderControls();
    // A hidden panel has no accessible name, so it is found through the id
    // the button points at.
    const panelId = trigger().getAttribute("aria-controls") ?? "";
    const panel = document.getElementById(panelId) as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).not.toHaveClass("border-lumen-accent");

    fireEvent.click(trigger());
    expect(panel).toBeVisible();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("aria-controls", panel.id);
    expect(trigger()).toHaveClass("border-lumen-accent", "text-lumen-accent");

    fireEvent.click(trigger());
    expect(panel).not.toBeVisible();
  });

  it("closes on Esc and gives the focus back to the button", () => {
    renderControls();
    const panel = openPanel();
    const chip = within(panel).getByRole("button", { name: "Created" });
    chip.focus();
    fireEvent.keyDown(chip, { key: "Escape" });
    expect(panel).not.toBeVisible();
    expect(trigger()).toHaveFocus();
  });

  it("presses the active mode and order chips, accent border and bold", () => {
    renderControls({ activeModeId: "createdAt", direction: "asc" });
    const panel = openPanel();
    const modes = within(
      within(panel).getByRole("group", { name: "Sort by" }),
    ).getAllByRole("button");
    expect(modes.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    const orders = within(
      within(panel).getByRole("group", { name: "Order" }),
    ).getAllByRole("button");
    expect(orders.map((b) => b.textContent)).toEqual([
      "Newest first",
      "Oldest first",
    ]);
    expect(orders.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
    ]);
    expect(modes[1]).toHaveClass("border-lumen-accent", "font-semibold");
    expect(modes[0]).not.toHaveClass("font-semibold");
  });

  it("fires onModeChange from a mode chip and keeps the panel open", () => {
    const onModeChange = vi.fn();
    renderControls({ onModeChange });
    const panel = openPanel();
    fireEvent.click(within(panel).getByRole("button", { name: "Title" }));
    expect(onModeChange).toHaveBeenCalledWith("title");
    expect(panel).toBeVisible();
  });

  it("fires onDirectionChange from an order chip", () => {
    const onDirectionChange = vi.fn();
    renderControls({ onDirectionChange });
    const panel = openPanel();
    fireEvent.click(
      within(panel).getByRole("button", { name: "Oldest first" }),
    );
    expect(onDirectionChange).toHaveBeenCalledWith("asc");
  });

  it("hides the mode chips when only one mode is given", () => {
    renderControls({
      modes: [{ id: "date", label: "Date" }],
      activeModeId: "date",
    });
    const panel = openPanel();
    expect(within(panel).queryByRole("group", { name: "Sort by" })).toBeNull();
    // The order chips remain.
    within(panel).getByRole("group", { name: "Order" });
  });

  it("draws the host's search box before the button", () => {
    renderControls({ search: <input aria-label="Search notes" /> });
    const search = screen.getByLabelText("Search notes");
    expect(
      search.compareDocumentPosition(trigger()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders no filter input when no filter config is given", () => {
    renderControls();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("fires filter onChange with the typed value (no keydown needed)", () => {
    const onChange = vi.fn();
    renderControls({
      filter: {
        value: "",
        onChange,
        placeholder: "Filter entries…",
        ariaLabel: "Filter entries",
      },
    });
    const input = screen.getByLabelText("Filter entries");
    fireEvent.change(input, { target: { value: "gym" } });
    expect(onChange).toHaveBeenCalledWith("gym");
  });
});
