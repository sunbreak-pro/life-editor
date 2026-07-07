import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventEditorPane,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * EventEditorPane — the selected-event editor. Enforces Issue 017: a routine
 * item can only be Dismissed (never Deleted); a manual item is the inverse.
 * Title/memo are commit-on-blur drafts.
 */

const LABELS: EventEditorLabels = {
  complete: "Mark complete",
  title: "Title",
  startTime: "Start",
  endTime: "End",
  memo: "Memo",
  originRoutine: "Generated from routine",
  originEvent: "Event",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const routineItem: EventEditorItem = {
  id: "r1",
  title: "Gym",
  startTime: "19:00",
  endTime: "20:30",
  completed: false,
  memo: "",
  isRoutine: true,
};

const manualItem: EventEditorItem = {
  ...routineItem,
  id: "m1",
  title: "Dentist",
  isRoutine: false,
};

function renderPane(
  item: EventEditorItem,
  props?: Partial<Parameters<typeof EventEditorPane>[0]>,
) {
  const fns = {
    onCommitTitle: vi.fn(),
    onChangeStart: vi.fn(),
    onChangeEnd: vi.fn(),
    onToggleComplete: vi.fn(),
    onChangeMemo: vi.fn(),
    onDismiss: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<EventEditorPane item={item} labels={LABELS} {...fns} {...props} />);
  return fns;
}

describe("EventEditorPane — Issue 017 action gating", () => {
  it("shows Dismiss and hides Delete for a routine item", () => {
    renderPane(routineItem);
    expect(screen.getByText("Skip this day")).toBeInTheDocument();
    expect(screen.queryByText("Delete")).toBeNull();
  });

  it("shows Delete and hides Dismiss for a manual item", () => {
    renderPane(manualItem);
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.queryByText("Skip this day")).toBeNull();
  });
});

describe("EventEditorPane — commit-on-blur", () => {
  it("commits the title on blur when it changed", () => {
    const { onCommitTitle } = renderPane(manualItem);
    const input = screen.getByLabelText("Title");
    fireEvent.change(input, { target: { value: "Dentist checkup" } });
    fireEvent.blur(input);
    expect(onCommitTitle).toHaveBeenCalledWith("m1", "Dentist checkup");
  });

  it("does not commit when the title is unchanged", () => {
    const { onCommitTitle } = renderPane(manualItem);
    fireEvent.blur(screen.getByLabelText("Title"));
    expect(onCommitTitle).not.toHaveBeenCalled();
  });
});
