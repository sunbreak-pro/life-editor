import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarListControls, type SidebarSortMode } from "../src/components";

/*
 * #283 — sidebar sort + optional-filter controls (Notes / Daily rightSidebar).
 * Pure presentation: the mode picker + direction toggle + filter fire injected
 * callbacks; the filter is onChange-only (IME safety); a single mode hides the
 * picker; omitting the filter config renders no input.
 */

const MODES: SidebarSortMode[] = [
  { id: "updatedAt", label: "Updated" },
  { id: "createdAt", label: "Created" },
  { id: "title", label: "Title" },
];

function renderControls(
  overrides: Partial<React.ComponentProps<typeof SidebarListControls>> = {},
) {
  const props: React.ComponentProps<typeof SidebarListControls> = {
    modes: MODES,
    activeModeId: "updatedAt",
    onModeChange: () => {},
    sortLabel: "Sort",
    direction: "asc",
    onToggleDirection: () => {},
    directionLabel: "Newest first",
    directionToggleLabel: "Toggle sort direction",
    ...overrides,
  };
  return render(<SidebarListControls {...props} />);
}

describe("SidebarListControls", () => {
  it("shows the active mode label on the picker trigger", () => {
    renderControls({ activeModeId: "title" });
    expect(screen.getByRole("button", { name: "Sort" })).toHaveTextContent(
      "Title",
    );
  });

  it("fires onModeChange when a menu item is picked", () => {
    const onModeChange = vi.fn();
    renderControls({ onModeChange });
    fireEvent.click(screen.getByRole("button", { name: "Sort" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Created" }));
    expect(onModeChange).toHaveBeenCalledWith("createdAt");
  });

  it("fires onToggleDirection on the direction toggle", () => {
    const onToggleDirection = vi.fn();
    renderControls({ onToggleDirection });
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle sort direction" }),
    );
    expect(onToggleDirection).toHaveBeenCalledTimes(1);
  });

  it("reflects direction via the toggle's aria-pressed", () => {
    renderControls({ direction: "desc" });
    expect(
      screen.getByRole("button", { name: "Toggle sort direction" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("hides the mode picker when only one mode is given", () => {
    renderControls({
      modes: [{ id: "date", label: "Date" }],
      activeModeId: "date",
    });
    expect(screen.queryByRole("button", { name: "Sort" })).toBeNull();
    // The direction toggle remains.
    expect(
      screen.getByRole("button", { name: "Toggle sort direction" }),
    ).toBeInTheDocument();
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
