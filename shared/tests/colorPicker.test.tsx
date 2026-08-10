import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "../src/components";

/*
 * Shared color-change control (#586 pins). The behavior under guard here is
 * the custom-hue input's local value: it seeds from `current`, RE-SEEDS when
 * the committed color changes from outside, gives instant local feedback on
 * drag, and commits through ONE trailing-debounced onPick per drag.
 */

function renderPicker(props?: Partial<Parameters<typeof ColorPicker>[0]>) {
  const onPick = vi.fn();
  const view = render(
    <ColorPicker
      label="Color"
      clearLabel="Clear color"
      customLabel="Custom color"
      onPick={onPick}
      {...props}
    />,
  );
  return { onPick, view };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "Color" }));
}

function customInput(): HTMLInputElement {
  return screen.getByLabelText("Custom color");
}

afterEach(() => {
  vi.useRealTimers();
});

describe("ColorPicker", () => {
  it("opens the panel on trigger click and picks a preset (then closes)", () => {
    const { onPick } = renderPicker();
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));
    expect(onPick).toHaveBeenCalledWith("#2563eb");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("clears the color via the clear option", () => {
    const { onPick } = renderPicker({ current: "#ef4444" });
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Clear color" }));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it("seeds the custom input from `current` (fallback gray when unset)", () => {
    renderPicker({ current: "#123456" });
    openPanel();
    expect(customInput().value).toBe("#123456");
  });

  it("falls back to #808080 when `current` is not a full hex", () => {
    renderPicker();
    openPanel();
    expect(customInput().value).toBe("#808080");
  });

  it("re-seeds the custom input when the committed color changes from outside", () => {
    const onPick = vi.fn();
    const { rerender } = render(
      <ColorPicker
        current="#111111"
        label="Color"
        clearLabel="Clear color"
        customLabel="Custom color"
        onPick={onPick}
      />,
    );
    openPanel();
    expect(customInput().value).toBe("#111111");
    rerender(
      <ColorPicker
        current="#222222"
        label="Color"
        clearLabel="Clear color"
        customLabel="Custom color"
        onPick={onPick}
      />,
    );
    expect(customInput().value).toBe("#222222");
  });

  it("shows drag ticks instantly but commits ONE debounced onPick", () => {
    vi.useFakeTimers();
    const { onPick } = renderPicker({ current: "#111111" });
    openPanel();
    const input = customInput();
    fireEvent.change(input, { target: { value: "#333333" } });
    fireEvent.change(input, { target: { value: "#444444" } });
    fireEvent.change(input, { target: { value: "#555555" } });
    // Instant local feedback, no commit yet.
    expect(input.value).toBe("#555555");
    expect(onPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    // One trailing commit with the last value — not a write storm.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith("#555555");
  });
});
