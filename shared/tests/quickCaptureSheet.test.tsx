import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickCaptureSheet, type QuickCaptureLabels } from "../src/components";

/*
 * QuickCaptureSheet (#280, moved from web CalendarTab) — the Mobile FAB's
 * quick-capture form. Pure presentation: labels injected, onAdd is the only
 * mutation; a blank title never fires it.
 */

const LABELS: QuickCaptureLabels = {
  title: "Quick add",
  placeholder: "Event title",
  add: "Add",
  startTime: "Start",
  endTime: "End",
};

function renderSheet(props?: Partial<Parameters<typeof QuickCaptureSheet>[0]>) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickCaptureSheet
      open
      onClose={onClose}
      onAdd={onAdd}
      labels={LABELS}
      {...props}
    />,
  );
  return { onAdd, onClose };
}

describe("QuickCaptureSheet", () => {
  it("submits title + default times and closes", () => {
    const { onAdd, onClose } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "Dentist" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith("Dentist", "09:00", "10:00");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the edited times and trims the title", () => {
    const { onAdd } = renderSheet();
    fireEvent.change(screen.getByPlaceholderText("Event title"), {
      target: { value: "  Gym  " },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "19:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "20:30" },
    });
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).toHaveBeenCalledWith("Gym", "19:00", "20:30");
  });

  it("does nothing on a blank title", () => {
    const { onAdd, onClose } = renderSheet();
    fireEvent.click(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("submits on Enter in the title field", () => {
    const { onAdd } = renderSheet();
    const input = screen.getByPlaceholderText("Event title");
    fireEvent.change(input, { target: { value: "Standup" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Standup", "09:00", "10:00");
  });

  it("ignores Enter during IME composition (§frontend gotcha)", () => {
    const { onAdd } = renderSheet();
    const input = screen.getByPlaceholderText("Event title");
    fireEvent.change(input, { target: { value: "予定" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onAdd).not.toHaveBeenCalled();
  });
});
