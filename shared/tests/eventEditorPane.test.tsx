import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventEditorPane,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * EventEditorPane — the selected-event editor. Issue 017 / #279 action
 * gating: a routine item offers Dismiss AND Delete (the host routes Delete
 * into the this/future/all scope dialog, whose "this only" performs a
 * revival-safe Dismiss); a manual item offers plain Delete only, no Dismiss.
 * Title/memo are commit-on-blur drafts.
 */

const LABELS: EventEditorLabels = {
  complete: "Mark complete",
  statusLabels: {
    notStarted: "Not started",
    inProgress: "In progress",
    done: "Done",
  },
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
  status: "notStarted",
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

describe("EventEditorPane — Issue 017 / #279 action gating", () => {
  it("shows Dismiss and Delete for a routine item (#279 scope dialog entry)", () => {
    const { onDelete } = renderPane(routineItem);
    expect(screen.getByText("Skip this day")).toBeInTheDocument();
    const del = screen.getByText("Delete");
    expect(del).toBeInTheDocument();
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("r1");
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

  it("commits start/end times on blur, not per keystroke (#279 scope dialog spam)", () => {
    const { onChangeStart, onChangeEnd } = renderPane(manualItem);
    const start = screen.getByLabelText("Start");
    fireEvent.change(start, { target: { value: "20:00" } });
    expect(onChangeStart).not.toHaveBeenCalled();
    fireEvent.blur(start);
    expect(onChangeStart).toHaveBeenCalledWith("m1", "20:00");

    const end = screen.getByLabelText("End");
    fireEvent.change(end, { target: { value: "21:00" } });
    fireEvent.blur(end);
    expect(onChangeEnd).toHaveBeenCalledWith("m1", "21:00");
  });

  it("does not commit an unchanged time on blur", () => {
    const { onChangeStart } = renderPane(manualItem);
    fireEvent.blur(screen.getByLabelText("Start"));
    expect(onChangeStart).not.toHaveBeenCalled();
  });
});
