import { describe, it, expect, vi, afterEach } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BottomSheet,
  EventEditorPane,
  type EventEditorItem,
  type EventEditorLabels,
} from "../src/components";

/*
 * #628 — closing the event editor with an unsaved draft.
 *
 * Since the save button became the only commit, a dismissal is a DISCARD. The
 * pane cannot ask about it (it does not own the surface it sits in), so it
 * reports `dirty` and the host guards its close.
 *
 * What this file pins is the ASSUMPTION that arrangement rests on: the sheet's
 * close button, its backdrop and Escape all funnel through ONE `onClose`. If
 * any of them ever grew its own exit, a host guarding `onClose` would go on
 * silently eating edits through the other route — and no amount of testing the
 * decision function would notice. (The decision itself —
 * `decideUnsavedClose` — is pinned in web/tests against the module CalendarTab
 * actually calls; the Desktop overlay has the same single-onClose shape.)
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
  save: "Save",
  saved: "Saved",
  unsaved: "Unsaved",
  originRoutine: "Generated from routine",
  originEvent: "Event",
  skipThisDay: "Skip this day",
  delete: "Delete",
};

const item: EventEditorItem = {
  id: "m1",
  title: "Dentist",
  date: "2026-07-30",
  isAllDay: false,
  startTime: "19:00",
  endTime: "20:30",
  completed: false,
  status: "notStarted",
  memo: "",
  isRoutine: false,
};

const CONFIRM_COPY = "You have unsaved changes. Discard them and close?";

/** The host wiring CalendarTab uses, reduced to the parts under test. */
function Harness({ onSave }: { onSave: () => void }) {
  const dirtyRef = useRef(false);
  const [open, setOpen] = useState(true);
  const close = () => {
    if (dirtyRef.current && !window.confirm(CONFIRM_COPY)) return;
    dirtyRef.current = false;
    setOpen(false);
  };
  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Event details"
      closeLabel="Close"
    >
      <EventEditorPane
        item={item}
        labels={LABELS}
        handlers={{
          onSave,
          onToggleComplete: vi.fn(),
          onDirtyChange: (dirty) => {
            dirtyRef.current = dirty;
          },
        }}
      />
    </BottomSheet>
  );
}

const sheetIsOpen = () => screen.queryByRole("dialog") !== null;
const typeInTitle = (value: string) =>
  fireEvent.change(screen.getByLabelText("Title"), { target: { value } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EventEditorPane — unsaved-close guard (#628)", () => {
  it("closes without a word when nothing is pending", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness onSave={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Close"));
    // Confirming a discard when there is nothing to discard is the fastest way
    // to teach the user to dismiss the dialog without reading it.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(sheetIsOpen()).toBe(false);
  });

  it("asks before discarding, and stays open when the answer is no", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness onSave={vi.fn()} />);
    typeInTitle("Dentist checkup");
    fireEvent.click(screen.getByLabelText("Close"));
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_COPY);
    expect(sheetIsOpen()).toBe(true);
    // The draft survives the refusal — otherwise "no" would have thrown away
    // the very thing it was protecting.
    expect(screen.getByLabelText("Title")).toHaveValue("Dentist checkup");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("closes when the discard is confirmed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    typeInTitle("Dentist checkup");
    fireEvent.click(screen.getByLabelText("Close"));
    expect(sheetIsOpen()).toBe(false);
    // Discarded means discarded: no last-second flush on the way out (the date
    // field used to have one, which is exactly what #628 retired).
    expect(onSave).not.toHaveBeenCalled();
  });

  it("guards Escape too", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness onSave={vi.fn()} />);
    typeInTitle("Dentist checkup");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_COPY);
    expect(sheetIsOpen()).toBe(true);
  });

  it("guards a backdrop press too", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness onSave={vi.fn()} />);
    typeInTitle("Dentist checkup");
    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop as HTMLElement);
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_COPY);
    expect(sheetIsOpen()).toBe(true);
  });

  it("stops asking once the draft is saved", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness onSave={vi.fn()} />);
    typeInTitle("Dentist checkup");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // The harness stands in for a host whose write has not come back as new
    // props yet, so the pane is still dirty here — see the pane's own tests for
    // the round trip. What this checks is the reverse case: reverting the field
    // by hand also clears the guard.
    typeInTitle("Dentist");
    fireEvent.click(screen.getByLabelText("Close"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(sheetIsOpen()).toBe(false);
  });
});
