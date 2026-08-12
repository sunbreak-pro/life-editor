import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsSegment } from "../src/components";

/*
 * Labeled settings segment (§216 Appearance). Radiogroup semantics like
 * SegmentedToggle, but with a group label/description. Keyboard walk is the
 * shared stepSegmentFocus, so this file also guards that ←/→ and ↑/↓ both
 * move focus + select here — the hand-rolled copy this replaced (#779) had no
 * test at all.
 */

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
] as const;

type Font = (typeof OPTIONS)[number]["value"];

function renderSegment(
  props?: Partial<Parameters<typeof SettingsSegment<Font>>[0]>,
) {
  const onChange = vi.fn();
  render(
    <SettingsSegment
      label="Font family"
      value="serif"
      onChange={onChange}
      options={[...OPTIONS]}
      {...props}
    />,
  );
  return { onChange };
}

describe("SettingsSegment", () => {
  it("exposes a labelled radiogroup and marks the selected option", () => {
    renderSegment();
    expect(
      screen.getByRole("radiogroup", { name: "Font family" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Serif" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("renders the optional description under the label", () => {
    renderSegment({ description: "Applies to body text" });
    expect(screen.getByText("Applies to body text")).toBeInTheDocument();
  });

  it("reports the chosen option via onChange on click", () => {
    const { onChange } = renderSegment();
    fireEvent.click(screen.getByRole("radio", { name: "Mono" }));
    expect(onChange).toHaveBeenCalledWith("mono");
  });

  it("keeps only the selected radio in the tab order (roving tabindex)", () => {
    renderSegment();
    expect(screen.getByRole("radio", { name: "Serif" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("falls back to the first radio as tab-stop when value matches no option", () => {
    renderSegment({ value: "gone" as Font });
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("moves selection with ←/→ (wrapping past the ends)", () => {
    const { onChange } = renderSegment();
    const serif = screen.getByRole("radio", { name: "Serif" });
    fireEvent.keyDown(serif, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("mono");
    fireEvent.keyDown(screen.getByRole("radio", { name: "System" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("mono");
  });

  it("moves selection with ↑/↓ too (radiogroup pattern)", () => {
    const { onChange } = renderSegment();
    const serif = screen.getByRole("radio", { name: "Serif" });
    fireEvent.keyDown(serif, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("mono");
    fireEvent.keyDown(serif, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("moves DOM focus onto the segment it selects", () => {
    renderSegment();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Serif" }), {
      key: "ArrowRight",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Mono" }),
    );
  });

  it("leaves non-arrow keys alone", () => {
    const { onChange } = renderSegment();
    const event = fireEvent.keyDown(
      screen.getByRole("radio", { name: "Serif" }),
      {
        key: "Tab",
      },
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(event).toBe(true); // not preventDefault()-ed
  });
});
