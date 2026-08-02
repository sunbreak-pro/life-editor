import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TimeRangeField,
  parseTimeInput,
} from "../src/components/TimeRangeField";

/*
 * TimeRangeField (#553) — the app-original start–end editor. The invariant
 * under test: no commit can produce end ≤ start, whichever path (typing,
 * option pick, arrow stepping) the value arrives by.
 */

function renderField(props?: { start?: string; end?: string }) {
  const onChange = vi.fn();
  render(
    <TimeRangeField
      start={props?.start ?? "09:00"}
      end={props?.end ?? "10:00"}
      onChange={onChange}
      labels={{ start: "Start", end: "End" }}
      formatDuration={(min) => `${min}m`}
    />,
  );
  return {
    onChange,
    startInput: screen.getByRole("combobox", { name: "Start" }),
    endInput: screen.getByRole("combobox", { name: "End" }),
  };
}

describe("parseTimeInput", () => {
  it("accepts the common shapes", () => {
    expect(parseTimeInput("9")).toBe(540);
    expect(parseTimeInput("09:30")).toBe(570);
    expect(parseTimeInput("9:5")).toBe(545);
    expect(parseTimeInput("930")).toBe(570);
    expect(parseTimeInput("0930")).toBe(570);
  });

  it("normalises full-width digits and colon (IME leftovers)", () => {
    expect(parseTimeInput("１４：３０")).toBe(870);
    expect(parseTimeInput("１４３０")).toBe(870);
  });

  it("rejects out-of-range and non-time text", () => {
    expect(parseTimeInput("24:00")).toBeNull();
    expect(parseTimeInput("12:60")).toBeNull();
    expect(parseTimeInput("abc")).toBeNull();
    expect(parseTimeInput("")).toBeNull();
  });
});

describe("TimeRangeField", () => {
  it("renders both committed values", () => {
    const { startInput, endInput } = renderField();
    expect(startInput).toHaveValue("09:00");
    expect(endInput).toHaveValue("10:00");
  });

  it("commits a typed start on Enter, dragging the end to keep the duration", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "1430" } });
    fireEvent.keyDown(startInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ start: "14:30", end: "15:30" });
  });

  it("keeps the end still when the new start stays before it", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "9:30" } });
    fireEvent.keyDown(startInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ start: "09:30", end: "10:00" });
  });

  it("lands an end typed at-or-before the start one step after it", () => {
    const { onChange, endInput } = renderField();
    fireEvent.change(endInput, { target: { value: "0830" } });
    fireEvent.keyDown(endInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ start: "09:00", end: "09:15" });
  });

  it("caps the dragged end at 23:59", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "23:30" } });
    fireEvent.keyDown(startInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ start: "23:30", end: "23:59" });
  });

  it("rejects a start so late no same-day end fits (23:59)", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "23:59" } });
    fireEvent.keyDown(startInput, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(startInput).toHaveValue("09:00");
  });

  it("reverts an unparsable draft on blur without committing", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "abc" } });
    fireEvent.blur(startInput);
    expect(onChange).not.toHaveBeenCalled();
    expect(startInput).toHaveValue("09:00");
  });

  it("does not commit while an IME composition is active", () => {
    const { onChange, startInput } = renderField();
    fireEvent.change(startInput, { target: { value: "1000" } });
    fireEvent.keyDown(startInput, { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps the start along the grid with ArrowUp", () => {
    const { onChange, startInput } = renderField();
    fireEvent.keyDown(startInput, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith({ start: "09:15", end: "10:00" });
  });

  it("ignores an ArrowDown that would push the end onto the start", () => {
    const { onChange, endInput } = renderField({
      start: "09:00",
      end: "09:15",
    });
    fireEvent.keyDown(endInput, { key: "ArrowDown" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores an ArrowUp against the top of the grid (no snap-back)", () => {
    // step() clamps to 23:45, so ↑ from a 23:59 end used to move BACKWARDS.
    const { onChange, endInput } = renderField({
      start: "23:30",
      end: "23:59",
    });
    fireEvent.keyDown(endInput, { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens a snapped option list on focus and commits a pick", () => {
    const { onChange, startInput } = renderField();
    fireEvent.focus(startInput);
    const list = screen.getByRole("listbox", { name: "Start" });
    fireEvent.click(within(list).getByText("10:00"));
    // 10:00 is not before the 10:00 end, so the end rides along (60m kept).
    expect(onChange).toHaveBeenCalledWith({ start: "10:00", end: "11:00" });
  });

  it("offers end options only after the start, annotated with the duration", () => {
    const { endInput } = renderField();
    fireEvent.focus(endInput);
    const list = screen.getByRole("listbox", { name: "End" });
    const options = within(list).getAllByRole("option");
    expect(options[0]).toHaveTextContent("09:15 (15m)");
    expect(within(list).queryByText(/^09:00/)).toBeNull();
  });
});
