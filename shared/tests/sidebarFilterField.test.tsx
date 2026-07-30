import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarFilterField } from "../src/components";

/*
 * #368 — the shared name-filter field, split out of SidebarListControls so a
 * filter-only surface can mount it without inheriting sort controls.
 *
 * Two surface presets: "sm" for the Materials sidebar row, "md" for a modal
 * row. The preset IS the visual contract — `cn` is a plain joiner (no
 * tailwind-merge), so a caller cannot override the defaults from outside — and
 * the modal one must carry a focus affordance because every control beside it
 * inside a dialog draws one.
 */

function renderField(
  over: Partial<React.ComponentProps<typeof SidebarFilterField>> = {},
) {
  const onChange = vi.fn();
  render(
    <SidebarFilterField
      value=""
      onChange={onChange}
      placeholder="Filter tags…"
      ariaLabel="Filter tags by name"
      {...over}
    />,
  );
  return { onChange, input: screen.getByLabelText("Filter tags by name") };
}

describe("SidebarFilterField (#368)", () => {
  it("reports every keystroke without needing a keydown (IME-safe)", () => {
    const { onChange, input } = renderField();
    fireEvent.change(input, { target: { value: "ho" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("ho");
  });

  it("is a controlled input driven by the host's value", () => {
    const { input } = renderField({ value: "work" });
    expect(input).toHaveValue("work");
  });

  it("shows the injected placeholder", () => {
    renderField();
    expect(screen.getByPlaceholderText("Filter tags…")).toBeInTheDocument();
  });

  it("gives the modal preset a focus ring, matching the controls beside it", () => {
    const { input } = renderField({ size: "md" });
    expect(input.parentElement?.className).toContain("focus-within:ring-2");
  });

  it("leaves the sidebar preset ringless, matching the search boxes it sits with", () => {
    const { input } = renderField();
    expect(input.parentElement?.className).not.toContain("focus-within:ring-2");
  });
});
