import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectCheckbox, SelectCheckboxMark } from "../src/components";
import { TodoFilterPanel } from "../src/components/schedule";

/*
 * #2217 — the square selection checkbox. Completion is the round
 * <TodoStatusCheckbox>; picking things is this one. The contract under test
 * is the keyboard / assistive-tech behaviour the replaced browser boxes had:
 * a `checkbox` role with `aria-checked`, toggled by a click AND by Space.
 */

function Harness({
  initial = false,
  disabled = false,
}: {
  initial?: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(initial);
  return (
    <SelectCheckbox
      checked={checked}
      onChange={setChecked}
      label="Select milk"
      disabled={disabled}
    />
  );
}

describe("SelectCheckbox (#2217)", () => {
  it("is a checkbox named by its label and reports its state", () => {
    render(<Harness initial />);
    const box = screen.getByRole("checkbox", { name: "Select milk" });
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Select milk" });
    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.click(box);
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("toggles on Space, once per press", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Select milk" });
    fireEvent.keyDown(box, { key: " ", code: "Space" });
    fireEvent.keyUp(box, { key: " ", code: "Space" });
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(box, { key: " ", code: "Space" });
    fireEvent.keyUp(box, { key: " ", code: "Space" });
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("cancels the Space defaults so a button's keyup click cannot double it", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Select milk" });
    // fireEvent returns false when the handler called preventDefault().
    expect(fireEvent.keyDown(box, { key: " ", code: "Space" })).toBe(false);
    expect(fireEvent.keyUp(box, { key: " ", code: "Space" })).toBe(false);
  });

  it("ignores other keys", () => {
    const onChange = vi.fn();
    render(<SelectCheckbox checked={false} onChange={onChange} label="x" />);
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", () => {
    const onChange = vi.fn();
    render(
      <SelectCheckbox checked={false} onChange={onChange} label="x" disabled />,
    );
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: " ", code: "Space" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes its name from an enclosing label and is pressed by a click on it", () => {
    const onChange = vi.fn();
    render(
      <label>
        <SelectCheckbox checked={false} onChange={onChange} />
        <span>Errands</span>
      </label>,
    );
    fireEvent.click(screen.getByText("Errands"));
    expect(onChange).toHaveBeenCalledWith(true);
    screen.getByRole("checkbox", { name: "Errands" });
  });
});

describe("SelectCheckboxMark (#2217)", () => {
  it("is a square, filled with the accent only when checked", () => {
    const { container, rerender } = render(
      <SelectCheckboxMark checked={false} />,
    );
    const mark = container.firstElementChild!;
    expect(mark).toHaveAttribute("aria-hidden");
    // Square corners, never the round completion shape.
    expect(mark.className).toContain("rounded-sm");
    expect(mark.className).not.toContain("rounded-full");
    expect(mark.className).toContain("border-lumen-border-strong");
    expect(mark.querySelector("svg")).toBeNull();

    rerender(<SelectCheckboxMark checked />);
    expect(mark.className).toContain("bg-lumen-accent");
    expect(mark.querySelector("svg")).not.toBeNull();
  });
});

describe("TodoFilterPanel uses the square box (#2217)", () => {
  const labels = {
    panel: "Filter",
    scopeHeading: "List",
    scopeBoth: "Both",
    scopeToday: "Today",
    scopeOther: "Other",
    tagsHeading: "Tags",
    noTags: "No tags",
    clear: "Clear",
  };

  it("names each tag box by its row and toggles that tag on a click or Space", () => {
    const onToggleTag = vi.fn();
    const { container } = render(
      <TodoFilterPanel
        scope="both"
        onScopeChange={() => {}}
        tags={[{ id: "tag-1", name: "Errands", color: null, icon: null }]}
        selectedTagIds={["tag-1"]}
        onToggleTag={onToggleTag}
        onClear={() => {}}
        active
        labels={labels}
      />,
    );
    // No browser checkbox left behind.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    const box = screen.getByRole("checkbox", { name: "Errands" });
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: " ", code: "Space" });
    expect(onToggleTag.mock.calls).toEqual([["tag-1"], ["tag-1"]]);
  });
});
