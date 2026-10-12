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

/*
 * #2229 — the name field also offers to make the typed name a new Todo or a
 * new Event. Pressing either hands the trimmed name and the kind to the host
 * and closes the sheet; the target itself is the host's to set, so the sheet
 * does not call onSelect.
 */
function renderCreatable() {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const onCreate = vi.fn();
  const onNameSubmit = vi.fn();
  render(
    <PomodoroTodoSheet
      open
      onClose={onClose}
      items={[
        { id: "task-1", title: "Write the spec", kind: "todo" },
        { id: "event-1", title: "Piano lesson", kind: "event" },
      ]}
      selectedId={null}
      labels={{ ...labels, addAsTodo: "As a Todo", addAsEvent: "As an event" }}
      onSelect={onSelect}
      freeSessionName=""
      onNameSubmit={onNameSubmit}
      onCreate={onCreate}
    />,
  );
  return { onSelect, onClose, onCreate, onNameSubmit };
}

describe("PomodoroTodoSheet — adding a new Todo or Event (#2229)", () => {
  it("shows the two buttons only once a name is typed", () => {
    renderCreatable();
    expect(screen.queryByRole("button", { name: "As a Todo" })).toBeNull();
    fireEvent.change(field(), { target: { value: "   " } });
    expect(screen.queryByRole("button", { name: "As a Todo" })).toBeNull();
    fireEvent.change(field(), { target: { value: "Draft the pitch" } });
    screen.getByRole("button", { name: "As a Todo" });
    screen.getByRole("button", { name: "As an event" });
  });

  it("makes a Todo from the trimmed name and closes", () => {
    const { onCreate, onClose, onSelect, onNameSubmit } = renderCreatable();
    fireEvent.change(field(), { target: { value: "  Draft the pitch " } });
    fireEvent.click(screen.getByRole("button", { name: "As a Todo" }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Draft the pitch", "todo");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onNameSubmit).not.toHaveBeenCalled();
  });

  it("makes an Event the same way", () => {
    const { onCreate, onClose } = renderCreatable();
    fireEvent.change(field(), { target: { value: "Draft the pitch" } });
    fireEvent.click(screen.getByRole("button", { name: "As an event" }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      "Draft the pitch",
      "event",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides them while a candidate already carries the name", () => {
    renderCreatable();
    fireEvent.change(field(), { target: { value: " Piano lesson" } });
    expect(screen.queryByRole("button", { name: "As a Todo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "As an event" })).toBeNull();
  });

  it("keeps the submit that names a free session", () => {
    const { onNameSubmit } = renderCreatable();
    fireEvent.change(field(), { target: { value: "Draft the pitch" } });
    fireEvent.click(screen.getByRole("button", { name: labels.nameSubmit }));
    expect(onNameSubmit).toHaveBeenCalledExactlyOnceWith("Draft the pitch");
  });

  it("has no add buttons when the host does not ask for them", () => {
    renderSheet("");
    fireEvent.change(field(), { target: { value: "Draft the pitch" } });
    expect(screen.queryByRole("button", { name: /As a/ })).toBeNull();
  });
});
