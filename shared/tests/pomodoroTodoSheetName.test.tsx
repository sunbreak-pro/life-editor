import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PomodoroTodoSheet } from "../src/components/PomodoroTodoSheet";

/*
 * #2009 — the mobile target sheet can name a new free session. The field is
 * opt-in (a host that passes no `freeSessionName` keeps a plain picker), and
 * using it clears the picked target and closes the sheet the way a row does.
 */

const labels = {
  title: "Choose a work name",
  close: "Close",
  clearSelection: "Free session",
  emptyHint: "Nothing to pick",
  nameLabel: "Work name",
  namePlaceholder: "Free session",
  nameSubmit: "Work under this name",
};

function renderSheet(name: string | null = "") {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const onNameSubmit = vi.fn();
  render(
    <PomodoroTodoSheet
      open
      onClose={onClose}
      items={[{ id: "task-1", title: "Write the spec", kind: "todo" }]}
      selectedId="task-1"
      labels={labels}
      onSelect={onSelect}
      freeSessionName={name ?? undefined}
      onNameSubmit={name === null ? undefined : onNameSubmit}
    />,
  );
  return { onSelect, onClose, onNameSubmit };
}

const field = () => screen.getByRole("textbox", { name: "Work name" });

describe("PomodoroTodoSheet — naming a free session (#2009)", () => {
  it("shows the default title as the placeholder and starts from the saved name", () => {
    renderSheet("Draft the pitch");
    expect(field().getAttribute("placeholder")).toBe("Free session");
    expect((field() as HTMLInputElement).value).toBe("Draft the pitch");
  });

  it("hands over the name, clears the target and closes", () => {
    const { onSelect, onClose, onNameSubmit } = renderSheet();
    fireEvent.change(field(), { target: { value: "Draft the pitch" } });
    fireEvent.click(screen.getByRole("button", { name: labels.nameSubmit }));

    expect(onNameSubmit).toHaveBeenCalledExactlyOnceWith("Draft the pitch");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits a blank name as blank, which the timer files as the default", () => {
    const { onNameSubmit } = renderSheet();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onNameSubmit).toHaveBeenCalledExactlyOnceWith("");
  });

  // The Enter that confirms a Japanese conversion (WebKit: keyCode 229).
  it("ignores the Enter that confirms an IME conversion", () => {
    const { onNameSubmit, onClose } = renderSheet();
    fireEvent.change(field(), { target: { value: "企画書" } });
    fireEvent.keyDown(field(), { key: "Enter", keyCode: 229 });
    expect(onNameSubmit).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("has no name field when the host does not ask for one", () => {
    renderSheet(null);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
