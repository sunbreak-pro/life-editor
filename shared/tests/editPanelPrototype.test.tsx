import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  ConfirmDialog,
  EventEditorPane,
  ItemNoteAttach,
  RepeatScopeDialog,
  TodoDetailPanel,
  type EventEditorItem,
  type ItemNoteAttachLabels,
} from "../src/components";

/*
 * #2219 — the event / todo edit panels in the prototype's shape.
 *
 * The two panels open from the same day list, so the rules are pinned on both
 * side by side: no 「保存済み / 未保存」 line (the Save button's own state says
 * it), Delete at the LEFT end of the save row, and — on the todo — a tag row
 * that carries 「ノートを添付」 at its right end and the colour row under it.
 * The frame's corner close is covered in detailKindGlyph.test.tsx.
 */

const ITEM: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-07-30",
  isAllDay: false,
  startTime: "19:00",
  endTime: "20:30",
  memo: "",
  isRoutine: false,
};

describe("EventEditorPane (#2219)", () => {
  it("shows no saved / unsaved line, only Delete and Save in the footer", () => {
    const { container } = render(
      <EventEditorPane
        item={ITEM}
        labels={{
          title: "Title",
          date: "Date",
          allDay: "All-day",
          startTime: "Start",
          endTime: "End",
          memo: "Memo",
          save: "Save",
          originRoutine: "Generated from routine",
          skipThisDay: "Skip this day",
          delete: "Delete",
        }}
        handlers={{ onSave: vi.fn(), onDelete: vi.fn() }}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" });
    const footer = save.parentElement as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Delete" })).toBe(
      footer.firstElementChild,
    );
    expect(footer.querySelector("[aria-live]")).toBeNull();
    expect(container.textContent).not.toMatch(/Saved|Unsaved/);
  });
});

describe("TodoDetailPanel (#2219)", () => {
  function renderPanel(onDelete = vi.fn()) {
    render(
      <TodoDetailPanel
        todoId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onSave={() => {}}
        onToggleStatus={() => {}}
        onDelete={onDelete}
        deleteLabel="Delete"
        titleLabel="Todo title"
        statusLabel="Status"
        statusText="Not started"
        saveLabel="Save"
        tagsLabel="Tags"
        tagsSlot={<span>chip</span>}
        tagsTrailing={<button type="button">Attach note</button>}
        colorSlot={<p>colour row</p>}
      />,
    );
    return { onDelete };
  }

  it("puts Delete at the left end of the save row", () => {
    const { onDelete } = renderPanel();
    const save = screen.getByRole("button", { name: "Save" });
    const footer = save.parentElement as HTMLElement;
    const del = within(footer).getByRole("button", { name: "Delete" });
    expect(footer.firstElementChild).toBe(del);
    expect(footer.lastElementChild).toBe(save);
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("task-a");
  });

  it("shows no saved / unsaved line", () => {
    renderPanel();
    expect(screen.queryByText(/Saved|Unsaved/)).toBeNull();
  });

  it("ends the tag row with the trailing control and puts the colour row under it", () => {
    renderPanel();
    const chip = screen.getByText("chip");
    const row = chip.parentElement!.parentElement as HTMLElement;
    expect(row.lastElementChild).toBe(
      screen.getByRole("button", { name: "Attach note" }),
    );
    expect(row.nextElementSibling).toBe(screen.getByText("colour row"));
  });
});

describe("ItemNoteAttach (#2219)", () => {
  const LABELS: ItemNoteAttachLabels = {
    attachNote: "Attach note",
    noteSourceLabel: "Note source",
    noteSourceNew: "New",
    noteSourceExisting: "Existing",
    noteTitleLabel: "Note title",
    notePlaceholder: "Title",
    searchNotes: "Search notes",
    notePickerEmpty: "No notes",
    notePickerNoMatch: "No match",
    attach: "Attach",
    attachedNote: "Attached",
  };
  const NOTES = [
    { id: "note-1", title: "Minutes" },
    { id: "note-2", title: "Recipe" },
  ];

  it("creates a new note by title on the press", () => {
    const onAttach = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ItemNoteAttach
        notes={NOTES}
        onAttach={onAttach}
        onOpenChange={onOpenChange}
        labels={LABELS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attach note" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Attach" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Note title"), {
      target: { value: " Agenda " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));
    expect(onAttach).toHaveBeenCalledWith({ kind: "new", title: "Agenda" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/Agenda/)).toBeInTheDocument();
  });

  it("links an existing note picked from the list", () => {
    const onAttach = vi.fn();
    render(
      <ItemNoteAttach notes={NOTES} onAttach={onAttach} labels={LABELS} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attach note" }));
    fireEvent.click(screen.getByRole("radio", { name: "Existing" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search notes" }), {
      target: { value: "rec" },
    });
    expect(screen.queryByRole("option", { name: "Minutes" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Recipe" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach" }));
    expect(onAttach).toHaveBeenCalledWith({ kind: "existing", id: "note-2" });
  });
});

describe("the confirm panels' corner close (#2219)", () => {
  it("closes the scope dialog like its Cancel", () => {
    const onClose = vi.fn();
    render(
      <RepeatScopeDialog
        open
        mode="edit"
        labels={{
          title: "Change a repeat",
          thisOnly: "This one",
          thisAndFuture: "This and later",
          all: "All",
          cancel: "Cancel",
        }}
        onChoose={vi.fn()}
        onClose={onClose}
        closeLabel="Close"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cancels the confirm dialog from the corner too", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        message="Discard?"
        confirmLabel="Discard"
        cancelLabel="Cancel"
        onConfirm={vi.fn()}
        onCancel={onCancel}
        closeLabel="Close"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("has no corner close unless asked", () => {
    render(
      <ConfirmDialog
        open
        message="Discard?"
        confirmLabel="Discard"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
