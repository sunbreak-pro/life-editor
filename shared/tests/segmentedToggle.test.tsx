import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedToggle } from "../src/components";

/*
 * Form-mode toggle (Auth "Sign in / Sign up"). Radiogroup semantics —
 * the active segment carries aria-checked; clicking / arrowing another
 * segment reports it via onChange (contrast: SegmentedControl is a
 * tablist for header-tab navigation).
 */

const OPTIONS = [
  { value: "signIn", label: "Sign in" },
  { value: "signUp", label: "Sign up" },
] as const;

function renderToggle(
  props?: Partial<Parameters<typeof SegmentedToggle<"signIn" | "signUp">>[0]>,
) {
  const onChange = vi.fn();
  render(
    <SegmentedToggle
      options={OPTIONS}
      value="signIn"
      onChange={onChange}
      label="Authentication mode"
      {...props}
    />,
  );
  return { onChange };
}

describe("SegmentedToggle", () => {
  it("exposes a labelled radiogroup and marks the active segment", () => {
    renderToggle();
    expect(
      screen.getByRole("radiogroup", { name: "Authentication mode" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Sign in" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Sign up" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports the chosen segment via onChange on click", () => {
    const { onChange } = renderToggle();
    fireEvent.click(screen.getByRole("radio", { name: "Sign up" }));
    expect(onChange).toHaveBeenCalledWith("signUp");
  });

  it("moves selection with arrow keys (roving tabindex)", () => {
    const { onChange } = renderToggle();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Sign in" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("signUp");
  });

  it("wraps backwards from the first segment on ArrowLeft", () => {
    const { onChange } = renderToggle();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Sign in" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenCalledWith("signUp");
  });

  it("disables every segment when disabled", () => {
    const { onChange } = renderToggle({ disabled: true });
    const signUp = screen.getByRole("radio", { name: "Sign up" });
    expect(signUp).toBeDisabled();
    fireEvent.click(signUp);
    expect(onChange).not.toHaveBeenCalled();
  });
});
