import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EventCreateFields,
  type EventCreateFieldsLabels,
} from "../src/components";

/*
 * EventCreateFields (#299) — the shared create-event form backing both the
 * Desktop creation overlay and the Mobile QuickCaptureSheet. Pure presentation:
 * labels injected, onSubmit is the only mutation; a blank title never fires it.
 * These tests lock the #299 prefill contract (initialStart / initialEnd) that
 * the empty-slot click depends on.
 */

const LABELS: EventCreateFieldsLabels = {
  title: "Title",
  placeholder: "Event title",
  add: "Add",
  date: "Date",
  startTime: "Start",
  endTime: "End",
};

function renderFields(
  props?: Partial<Parameters<typeof EventCreateFields>[0]>,
) {
  const onSubmit = vi.fn();
  render(<EventCreateFields onSubmit={onSubmit} labels={LABELS} {...props} />);
  return { onSubmit };
}

describe("EventCreateFields", () => {
  it("submits the trimmed title with the default 09:00–10:00 window", () => {
    const { onSubmit } = renderFields();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Dentist  " },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmit).toHaveBeenCalledWith("Dentist", "09:00", "10:00");
  });

  it("seeds the time fields from initialStart / initialEnd (empty-slot prefill)", () => {
    const { onSubmit } = renderFields({
      initialStart: "14:30",
      initialEnd: "15:30",
    });
    expect((screen.getByLabelText("Start") as HTMLInputElement).value).toBe(
      "14:30",
    );
    expect((screen.getByLabelText("End") as HTMLInputElement).value).toBe(
      "15:30",
    );
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Meeting" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmit).toHaveBeenCalledWith("Meeting", "14:30", "15:30");
  });

  it("does nothing on a blank title", () => {
    const { onSubmit } = renderFields();
    fireEvent.click(screen.getByText("Add"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the target day when the host supplies one (#353)", () => {
    // The three create gestures (toolbar / empty slot / month cell) each
    // target a different day, and before #353 only the times were on screen.
    renderFields({ dateLabel: "Mon, July 27, 2026" });
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Mon, July 27, 2026")).toBeInTheDocument();
  });

  it("is read-only: the day is not an editable field", () => {
    // The day comes from the gesture that opened the panel; offering an input
    // here would contradict it.
    renderFields({ dateLabel: "Mon, July 27, 2026" });
    expect(screen.queryByLabelText("Date")).toBeNull();
  });

  it("omits the row entirely when no day is supplied", () => {
    renderFields();
    expect(screen.queryByText("Date")).toBeNull();
  });

  it("submits on Enter but ignores Enter during IME composition", () => {
    const { onSubmit } = renderFields();
    const input = screen.getByPlaceholderText("Event title");
    fireEvent.change(input, { target: { value: "Standup" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Standup", "09:00", "10:00");
  });
});
