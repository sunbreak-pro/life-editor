import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageWidthToggle } from "../src/components";

/*
 * Layout Standard v2 §5 — the header width tab. Two fixed segments (wide /
 * narrow), radiogroup semantics with roving tabindex, icon + label on both.
 */

const LABELS = { group: "Content width", wide: "Wide", narrow: "Narrow" };

function renderToggle(value: "wide" | "narrow" = "wide") {
  const onChange = vi.fn();
  render(<PageWidthToggle value={value} onChange={onChange} labels={LABELS} />);
  return { onChange };
}

describe("PageWidthToggle", () => {
  it("renders a labelled radiogroup with exactly the two width segments", () => {
    renderToggle();
    expect(
      screen.getByRole("radiogroup", { name: "Content width" }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Narrow" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("fires onChange with the segment's mode on click", () => {
    const { onChange } = renderToggle("wide");
    fireEvent.click(screen.getByRole("radio", { name: "Narrow" }));
    expect(onChange).toHaveBeenCalledWith("narrow");
  });

  it("moves selection with ArrowRight / ArrowLeft (roving tabindex)", () => {
    const { onChange } = renderToggle("wide");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Wide" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("narrow");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Wide" }), {
      key: "ArrowLeft",
    });
    // Two options → left from the first wraps to the same "narrow" segment.
    expect(onChange).toHaveBeenLastCalledWith("narrow");
  });

  it("keeps only the active segment in the tab order", () => {
    renderToggle("narrow");
    expect(screen.getByRole("radio", { name: "Narrow" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "Wide" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
