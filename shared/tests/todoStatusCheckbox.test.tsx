import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodoStatusCheckbox,
  toggledTodoStatus,
  TODO_CHECKBOX_ICON_PX,
} from "../src/components";

/*
 * #873 — the list-row status control after the three-value cycle was retired.
 *
 * The rename is not cosmetic: a control that cycled had to be a plain button
 * (there is no ARIA role for "advances through three states"), and a user on a
 * screen reader got "Status: Not started, button" with no way to know what a
 * press would do. Two values means the row can say checked / not checked, so
 * these cases pin the role and the aria-checked state, not just the callback.
 */

const LABELS = {
  statusNotStarted: "Not started",
  statusDone: "Done",
};

describe("toggledTodoStatus", () => {
  it("flips between the two values", () => {
    expect(toggledTodoStatus("NOT_STARTED")).toBe("DONE");
    expect(toggledTodoStatus("DONE")).toBe("NOT_STARTED");
  });
});

describe("TodoStatusCheckbox", () => {
  function renderCheckbox(status: "NOT_STARTED" | "DONE") {
    const onChange = vi.fn();
    return render(
      <TodoStatusCheckbox
        status={status}
        onChange={onChange}
        labels={LABELS}
        label="Status"
      />,
    );
  }

  function renderAndSpy(status: "NOT_STARTED" | "DONE") {
    const onChange = vi.fn();
    render(
      <TodoStatusCheckbox
        status={status}
        onChange={onChange}
        labels={LABELS}
        label="Status"
      />,
    );
    return onChange;
  }

  it("reports an unfinished todo as an unchecked checkbox", () => {
    renderCheckbox("NOT_STARTED");
    const box = screen.getByRole("checkbox", { name: "Status: Not started" });
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("reports a done todo as a checked checkbox", () => {
    renderCheckbox("DONE");
    expect(
      screen.getByRole("checkbox", { name: "Status: Done" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("sends the status the press lands on, both ways", () => {
    const onChange = renderAndSpy("NOT_STARTED");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("DONE");
  });

  it("unchecks a done todo back to not started", () => {
    const onChange = renderAndSpy("DONE");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("NOT_STARTED");
  });

  it("keeps the phone minimum touch target", () => {
    renderCheckbox("NOT_STARTED");
    // mobile-scope.md: 44px is the floor for anything a thumb aims at.
    expect(screen.getByRole("checkbox").className).toContain("min-h-11");
  });

  /*
   * #1368 — the drawn mark is one size app-wide, and it is THIS number.
   * The Notes editor's checkbox is a ProseMirror-owned <input> that only CSS
   * can size, so the constant has to be reachable from outside this file;
   * web/tests/taskListCheckboxSize.test.ts reads it and the stylesheet together.
   */
  it("draws the mark at the shared size", () => {
    const { container } = renderCheckbox("NOT_STARTED");
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("width")).toBe(String(TODO_CHECKBOX_ICON_PX));
    expect(icon?.getAttribute("height")).toBe(String(TODO_CHECKBOX_ICON_PX));
  });
});
