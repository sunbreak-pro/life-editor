import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SteppedSlider } from "../src/components";

/*
 * Discrete tick slider (WAI-ARIA slider). Pure presentation: arrow / Home /
 * End keys step the value (clamped), and the aria-value* trio + aria-valuetext
 * describe the current step for assistive tech.
 */
function renderSlider(props?: Partial<Parameters<typeof SteppedSlider>[0]>) {
  const onChange = vi.fn();
  render(
    <SteppedSlider
      value={4}
      min={1}
      max={10}
      onChange={onChange}
      ariaLabel="Font size"
      valueText="16px (4/10)"
      {...props}
    />,
  );
  return { onChange };
}

describe("SteppedSlider", () => {
  it("exposes the aria-value trio + valuetext", () => {
    renderSlider();
    const slider = screen.getByRole("slider", { name: "Font size" });
    expect(slider).toHaveAttribute("aria-valuemin", "1");
    expect(slider).toHaveAttribute("aria-valuemax", "10");
    expect(slider).toHaveAttribute("aria-valuenow", "4");
    expect(slider).toHaveAttribute("aria-valuetext", "16px (4/10)");
  });

  it("steps up on ArrowRight and down on ArrowLeft", () => {
    const { onChange } = renderSlider();
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(5);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("jumps to the bounds on Home / End", () => {
    const { onChange } = renderSlider();
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith(1);
    fireEvent.keyDown(slider, { key: "End" });
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("does not fire past the max bound", () => {
    const { onChange } = renderSlider({ value: 10 });
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
