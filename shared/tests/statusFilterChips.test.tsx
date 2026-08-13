import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusFilterChips, type StatusFilterChip } from "../src/components";

/*
 * Mobile Todos status filter. Single-select group of aria-pressed pills:
 * clicking an unselected chip selects it (emits its id), clicking the active
 * chip again clears the filter (emits null). Counts render when provided.
 */
const CHIPS: StatusFilterChip[] = [
  { id: "todo", label: "To do", count: 4 },
  { id: "progress", label: "In progress", count: 2 },
  { id: "done", label: "Done", count: 7 },
];

function renderChips(props?: Partial<Parameters<typeof StatusFilterChips>[0]>) {
  const onChange = vi.fn();
  render(
    <StatusFilterChips
      chips={CHIPS}
      value="todo"
      onChange={onChange}
      label="Filter todos"
      {...props}
    />,
  );
  return { onChange };
}

describe("StatusFilterChips", () => {
  it("renders every chip with its count", () => {
    renderChips();
    expect(screen.getByRole("button", { name: /To do/ })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("marks the selected chip with aria-pressed", () => {
    renderChips();
    expect(screen.getByRole("button", { name: /To do/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Done/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects an unselected chip by id", () => {
    const { onChange } = renderChips();
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(onChange).toHaveBeenCalledWith("done");
  });

  it("clears the filter when the active chip is clicked again", () => {
    const { onChange } = renderChips();
    fireEvent.click(screen.getByRole("button", { name: /To do/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("exposes an accessible group label", () => {
    renderChips();
    expect(
      screen.getByRole("group", { name: "Filter todos" }),
    ).toBeInTheDocument();
  });

  /*
   * #369 reuses this component as the Notes tag filter inside a ~240px
   * rightSidebar, which needs a smaller pill. The variant must change ONLY the
   * metrics — the same selection contract has to hold, since the sidebar is now
   * a second caller relying on it.
   */
  it("keeps the selection contract in the sm variant", () => {
    const { onChange } = renderChips({ size: "sm" });
    const active = screen.getByRole("button", { name: /To do/ });
    expect(active).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(active);
    expect(onChange).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: /Done/ }));
    expect(onChange).toHaveBeenCalledWith("done");
  });

  it("renders smaller padding/type in the sm variant", () => {
    renderChips({ size: "sm" });
    const chip = screen.getByRole("button", { name: /To do/ });
    // The sm variant used to name a literal text-[12px]; it now names the
    // scale's smallest step, which follows the Settings font-size instead of
    // staying frozen at 12px. The assertion it protects is unchanged — the sm
    // chip must be a step BELOW the default chip, not equal to it.
    expect(chip.className).toContain("text-xs");
    expect(chip.className).not.toContain("text-sm");
  });
});
