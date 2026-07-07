import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  StatusFilterChips,
  type StatusFilterChip,
} from "../src/components";

/*
 * Mobile Tasks status filter. Single-select group of aria-pressed pills:
 * clicking an unselected chip selects it (emits its id), clicking the active
 * chip again clears the filter (emits null). Counts render when provided.
 */
const CHIPS: StatusFilterChip[] = [
  { id: "todo", label: "To do", count: 4 },
  { id: "progress", label: "In progress", count: 2 },
  { id: "done", label: "Done", count: 7 },
];

function renderChips(
  props?: Partial<Parameters<typeof StatusFilterChips>[0]>,
) {
  const onChange = vi.fn();
  render(
    <StatusFilterChips
      chips={CHIPS}
      value="todo"
      onChange={onChange}
      label="Filter tasks"
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
    expect(
      screen.getByRole("button", { name: /To do/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Done/ }),
    ).toHaveAttribute("aria-pressed", "false");
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
      screen.getByRole("group", { name: "Filter tasks" }),
    ).toBeInTheDocument();
  });
});
