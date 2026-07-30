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
  date: "Date",
  allDay: "All-day",
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
  date: "2026-07-30",
  isAllDay: false,
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

describe("EventEditorPane — date + all-day (#469)", () => {
  it("commits the date once on blur, not per segment step", () => {
    const onChangeDate = vi.fn();
    renderPane(manualItem, { onChangeDate });
    const date = screen.getByLabelText("Date");
    // A date input steps its value once per arrow press on a segment, each a
    // complete value. Committing those wrote a row (and an undo entry) per
    // press, and walked the anchor through the years 2 / 20 / 202 on the way to
    // a typed 2026.
    fireEvent.change(date, { target: { value: "0002-08-03" } });
    fireEvent.change(date, { target: { value: "0020-08-03" } });
    fireEvent.change(date, { target: { value: "2026-08-03" } });
    expect(onChangeDate).not.toHaveBeenCalled();
    fireEvent.blur(date);
    expect(onChangeDate).toHaveBeenCalledTimes(1);
    expect(onChangeDate).toHaveBeenCalledWith("m1", "2026-08-03");
  });

  it("does not commit a cleared or unchanged date", () => {
    const onChangeDate = vi.fn();
    renderPane(manualItem, { onChangeDate });
    const date = screen.getByLabelText("Date");
    // A cleared input reports "" — never commit that as a day.
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.blur(date);
    expect(onChangeDate).not.toHaveBeenCalled();
    fireEvent.blur(date);
    expect(onChangeDate).not.toHaveBeenCalled();
  });

  it("flushes a pending date on unmount (Esc fires no blur)", () => {
    const onChangeDate = vi.fn();
    const { unmount } = render(
      <EventEditorPane
        item={manualItem}
        labels={LABELS}
        onCommitTitle={vi.fn()}
        onChangeStart={vi.fn()}
        onChangeEnd={vi.fn()}
        onToggleComplete={vi.fn()}
        onChangeMemo={vi.fn()}
        onChangeDate={onChangeDate}
      />,
    );
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-08-03" },
    });
    expect(onChangeDate).not.toHaveBeenCalled();
    // Dismissing the overlay/sheet unmounts without blurring the input; without
    // the flush the chosen day would be dropped on the floor.
    unmount();
    expect(onChangeDate).toHaveBeenCalledWith("m1", "2026-08-03");
  });

  it("reseeds the time drafts when all-day flips (host rewrites the times)", () => {
    // An all-day row can carry no times at all. The drafts are seeded from
    // props, so without the remount they would stay empty while the grid draws
    // the row at the host's fallback span.
    const { rerender } = render(
      <EventEditorPane
        item={{ ...manualItem, isAllDay: true, startTime: "", endTime: "" }}
        labels={LABELS}
        onCommitTitle={vi.fn()}
        onChangeStart={vi.fn()}
        onChangeEnd={vi.fn()}
        onToggleComplete={vi.fn()}
        onChangeMemo={vi.fn()}
        onToggleAllDay={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Start")).toBeNull();
    rerender(
      <EventEditorPane
        item={{
          ...manualItem,
          isAllDay: false,
          startTime: "09:00",
          endTime: "10:00",
        }}
        labels={LABELS}
        onCommitTitle={vi.fn()}
        onChangeStart={vi.fn()}
        onChangeEnd={vi.fn()}
        onToggleComplete={vi.fn()}
        onChangeMemo={vi.fn()}
        onToggleAllDay={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Start")).toHaveValue("09:00");
    expect(screen.getByLabelText("End")).toHaveValue("10:00");
  });

  it("renders the date read-only and hides the switch when unwired", () => {
    renderPane(manualItem);
    expect(screen.getByLabelText("Date")).toHaveAttribute("readonly");
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("reports the all-day state and asks for the flip", () => {
    const onToggleAllDay = vi.fn();
    renderPane(manualItem, { onToggleAllDay });
    const sw = screen.getByRole("switch", { name: "All-day" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onToggleAllDay).toHaveBeenCalledWith("m1", true);
  });

  it("hides the time inputs while all-day is on", () => {
    const onToggleAllDay = vi.fn();
    renderPane({ ...manualItem, isAllDay: true }, { onToggleAllDay });
    // Hidden, not disabled: the switch keeps the focus, and locked inputs would
    // leave the times looking authoritative on a row that ignores them.
    expect(screen.queryByLabelText("Start")).toBeNull();
    expect(screen.queryByLabelText("End")).toBeNull();
    expect(screen.getByRole("switch", { name: "All-day" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("switch", { name: "All-day" }));
    expect(onToggleAllDay).toHaveBeenCalledWith("m1", false);
  });
});

describe("EventEditorPane — series hint (#469 小粒)", () => {
  const hint = "Title and time edits ask about the series.";

  it("shows the hint on a routine occurrence when the host supplies it", () => {
    renderPane(routineItem, { labels: { ...LABELS, seriesHint: hint } });
    expect(screen.getByText(hint)).toBeInTheDocument();
  });

  it("never shows it on a manual item, or when the label is omitted", () => {
    renderPane(manualItem, { labels: { ...LABELS, seriesHint: hint } });
    expect(screen.queryByText(hint)).toBeNull();
    renderPane(routineItem);
    expect(screen.queryByText(hint)).toBeNull();
  });
});
