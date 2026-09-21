import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsSchedule } from "../src/components";

/*
 * The holiday row on the Schedule settings card (#1802).
 *
 * The card used to say, in a comment and in its own copy, that only the COLOUR
 * was a setting and that drawing them was the calendar's own toggle. That is
 * no longer true, and a switch whose state does not come back after a reload
 * is worse than no switch — so the row is pinned here rather than left to the
 * screenshot.
 */

const LABELS = {
  heading: "Schedule",
  description: "How the calendar opens.",
  initialViewLabel: "Opens on",
  week: "Week",
  month: "Month",
  hint: "Desktop only.",
  reminderLabel: "Reminders",
  reminderDescription: "Notify before an event starts.",
  reminderDefaultLabel: "Default lead time",
  reminderDefaultHint: "Applies to new events.",
  reminderDesktopHint: "Desktop only.",
  holidayHeading: "Holidays",
  holidayDescription: "Japanese public holidays are drawn as all-day items.",
  holidayColorLabel: "Holiday colour",
  holidayColorClear: "Default colour",
  holidayColorCustom: "Custom colour",
  holidayVisibleLabel: "Show holidays on the calendar",
};

function renderCard(props?: Partial<Parameters<typeof SettingsSchedule>[0]>) {
  const onHolidaysShownChange = vi.fn();
  render(
    <SettingsSchedule
      initialView="week"
      onInitialViewChange={vi.fn()}
      remindersEnabled={false}
      onRemindersEnabledChange={vi.fn()}
      defaultLeadMinutes={10}
      onDefaultLeadMinutesChange={vi.fn()}
      leadOptions={[{ value: 10, label: "10 min" }]}
      holidayColor="#e03e3e"
      onHolidayColorChange={vi.fn()}
      defaultHolidayColor="#e03e3e"
      holidaysShown
      onHolidaysShownChange={onHolidaysShownChange}
      labels={LABELS}
      {...props}
    />,
  );
  return { onHolidaysShownChange };
}

/** The switch, found the way a screen reader finds it. */
function holidaySwitch() {
  return screen.getByRole("switch", {
    name: LABELS.holidayVisibleLabel,
  });
}

describe("SettingsSchedule — the holiday visibility row (#1802)", () => {
  it("reads as on when holidays are shown", () => {
    renderCard();
    expect(holidaySwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("reads as off when they are hidden", () => {
    renderCard({ holidaysShown: false });
    expect(holidaySwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("asks the host for the OPPOSITE of what it currently shows", () => {
    // The host owns the pref; the card only reports the press. Sending the
    // current value back would make the switch inert in exactly the way a
    // stale prop hides.
    const { onHolidaysShownChange } = renderCard({ holidaysShown: true });
    fireEvent.click(holidaySwitch());
    expect(onHolidaysShownChange).toHaveBeenCalledWith(false);
  });

  it("turns them back on from the off state", () => {
    const { onHolidaysShownChange } = renderCard({ holidaysShown: false });
    fireEvent.click(holidaySwitch());
    expect(onHolidaysShownChange).toHaveBeenCalledWith(true);
  });

  it("keeps the colour picker beside it", () => {
    // The two are one section: hiding holidays and colouring them are the same
    // question asked twice, and splitting them across cards would read as two
    // unrelated settings.
    renderCard();
    expect(screen.getByText(LABELS.holidayHeading)).toBeInTheDocument();
    expect(holidaySwitch()).toBeInTheDocument();
    expect(screen.getByText(LABELS.holidayColorLabel)).toBeInTheDocument();
  });
});
