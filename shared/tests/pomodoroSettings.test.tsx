import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroSettings,
  type PomodoroSettingsProps,
  type PomodoroSettingsPatch,
  type PomodoroPresetOption,
} from "../src/components/PomodoroSettings";

/*
 * Work settings + preset editor (rightSidebar / drawer body). Pure primitive —
 * props-injected copy (§6.4). Covers the autoStart switch, the presets empty
 * state, apply/delete wiring and the preset form, plus the #624 blank-field
 * behaviour and the #714 save button (see the second and third describe
 * blocks).
 *
 * The two buttons are told apart by label on purpose: the real catalog gives
 * both "保存", so every query here names "Save settings" or "Save preset"
 * rather than relying on a unique accessible name that production does not
 * have.
 */

const PRESET: PomodoroPresetOption = {
  id: 7,
  name: "Deep focus",
  workDuration: 50,
  breakDuration: 10,
  longBreakDuration: 30,
  sessionsBeforeLongBreak: 2,
};

const LABELS: PomodoroSettingsProps["labels"] = {
  settingsHeading: "Timer settings",
  workDuration: "Work",
  breakDuration: "Break",
  longBreakDuration: "Long break",
  sessionsPerSet: "Per set",
  targetSessions: "Target",
  autoStartBreaks: "Auto-start breaks",
  presets: "Presets",
  presetsEmpty: "No presets yet",
  presetNamePlaceholder: "Preset name",
  saveAsPreset: "Save preset",
  apply: "Apply",
  deletePreset: "Delete preset",
  emptyValueConfirm: "OK",
  save: "Save settings",
  saved: "Saved",
  unsaved: "Unsaved",
};

const formatEmptyValueMessage = (field: string) =>
  `Enter a number for ${field}`;

function baseProps(
  overrides?: Partial<PomodoroSettingsProps>,
): PomodoroSettingsProps {
  return {
    workDurationMinutes: 25,
    breakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    targetSessions: 4,
    presets: [],
    labels: LABELS,
    onSaveSettings: vi.fn(),
    onAutoStartBreaksChange: vi.fn(),
    onApplyPreset: vi.fn(),
    onCreatePreset: vi.fn(),
    onDeletePreset: vi.fn(),
    formatEmptyValueMessage,
    ...overrides,
  };
}

function renderSettings(overrides?: Partial<PomodoroSettingsProps>) {
  const props = baseProps(overrides);
  const view = render(<PomodoroSettings {...props} />);
  return { props, view };
}

const saveButton = () => screen.getByRole("button", { name: "Save settings" });
const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;

describe("PomodoroSettings", () => {
  it("renders the autoStart switch reflecting its checked state", () => {
    renderSettings({ autoStartBreaks: true });
    const sw = screen.getByRole("switch", { name: "Auto-start breaks" });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("toggles autoStart on click (an act, not a drafted field)", () => {
    const { props } = renderSettings({ autoStartBreaks: false });
    fireEvent.click(screen.getByRole("switch", { name: "Auto-start breaks" }));
    expect(props.onAutoStartBreaksChange).toHaveBeenCalledWith(true);
  });

  it("shows the empty box when there are no presets", () => {
    renderSettings({ presets: [] });
    expect(screen.getByText("No presets yet")).toBeInTheDocument();
  });

  it("renders a preset row (with mono notation) and wires apply/delete", () => {
    const { props } = renderSettings({ presets: [PRESET] });
    expect(screen.getByText("Deep focus")).toBeInTheDocument();
    expect(screen.getByText("50·10·30·×2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(props.onApplyPreset).toHaveBeenCalledWith(PRESET);
    fireEvent.click(screen.getByRole("button", { name: "Delete preset" }));
    expect(props.onDeletePreset).toHaveBeenCalledWith(7);
  });

  it("submits a new preset with the numbers on screen", () => {
    const { props } = renderSettings();
    fireEvent.change(screen.getByPlaceholderText("Preset name"), {
      target: { value: "Morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preset" }));
    expect(props.onCreatePreset).toHaveBeenCalledWith("Morning", {
      workDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    });
  });
});

/*
 * #714 — the five numeric fields are a draft; the button is the only commit.
 */
describe("PomodoroSettings — save button (#714)", () => {
  it("writes nothing while the user types", () => {
    const { props } = renderSettings();

    fireEvent.change(field("Work"), { target: { value: "50" } });
    fireEvent.blur(field("Work"));
    fireEvent.change(field("Target"), { target: { value: "6" } });

    // Blur is NOT a commit (D-20260810-sched-1 = A) and neither is a keystroke.
    expect(props.onSaveSettings).not.toHaveBeenCalled();
    expect(field("Work").value).toBe("50");
  });

  it("loses the draft when the panel closes without a save", () => {
    const { props, view } = renderSettings();

    fireEvent.change(field("Work"), { target: { value: "50" } });
    view.unmount();

    // No unmount flush: an unsaved draft dies with the panel rather than
    // sneaking in through a second, invisible write path.
    expect(props.onSaveSettings).not.toHaveBeenCalled();
  });

  it("commits all five fields in ONE call when saved", () => {
    const { props } = renderSettings();

    fireEvent.change(field("Work"), { target: { value: "50" } });
    fireEvent.change(field("Break"), { target: { value: "10" } });
    fireEvent.change(field("Long break"), { target: { value: "30" } });
    fireEvent.change(field("Per set"), { target: { value: "2" } });
    fireEvent.change(field("Target"), { target: { value: "6" } });
    fireEvent.click(saveButton());

    // One call, one patch — five separate writes would ask the host (and the
    // sync bus) five times for one gesture.
    expect(props.onSaveSettings).toHaveBeenCalledExactlyOnceWith({
      workDuration: 50,
      breakDuration: 10,
      longBreakDuration: 30,
      sessionsBeforeLongBreak: 2,
      targetSessions: 6,
    } satisfies PomodoroSettingsPatch);
  });

  it("carries only the fields that moved", () => {
    const { props } = renderSettings();

    fireEvent.change(field("Break"), { target: { value: "7" } });
    fireEvent.click(saveButton());

    expect(props.onSaveSettings).toHaveBeenCalledExactlyOnceWith({
      breakDuration: 7,
    });
  });

  it("names the pending state and disables the button while nothing is pending", () => {
    renderSettings();

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    fireEvent.change(field("Work"), { target: { value: "50" } });
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();

    // Typing the stored value back is not a pending change.
    fireEvent.change(field("Work"), { target: { value: "25" } });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("refuses to save while a field is blank and names it", () => {
    const { props } = renderSettings();

    fireEvent.change(field("Break"), { target: { value: "7" } });
    fireEvent.change(field("Work"), { target: { value: "" } });
    fireEvent.click(saveButton());

    expect(props.onSaveSettings).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a number for Work")).toBeInTheDocument();
  });

  it("drops the draft when a preset is applied", () => {
    const { props } = renderSettings({ presets: [PRESET] });

    fireEvent.change(field("Work"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(props.onApplyPreset).toHaveBeenCalledWith(PRESET);
    // Apply commits all four durations on the host; a surviving overlay would
    // keep painting the number the preset just replaced.
    expect(field("Work").value).toBe("25");
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("saves a preset from the draft, not from the stored settings", () => {
    const { props } = renderSettings();

    fireEvent.change(field("Work"), { target: { value: "50" } });
    fireEvent.change(screen.getByPlaceholderText("Preset name"), {
      target: { value: "Deep" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preset" }));

    expect(props.onCreatePreset).toHaveBeenCalledWith("Deep", {
      workDuration: 50,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsBeforeLongBreak: 4,
    });
  });
});

/*
 * #624 — a cleared numeric field must stay cleared.
 *
 * The original bug needed both halves to show: the field committed
 * Number("") === 0 the moment it was emptied, and the host clamped that back
 * into range. Since #714 the host is no longer in that loop (a keystroke lands
 * in the draft), so the clamp now shows up one step later — on save. This host
 * clamps exactly like TimerContext's saveSettings does.
 */
function ClampingHost() {
  const [work, setWork] = useState(25);
  return (
    <PomodoroSettings
      {...baseProps({
        workDurationMinutes: work,
        onSaveSettings: (patch) => {
          if (patch.workDuration !== undefined)
            setWork(Math.min(240, Math.max(1, patch.workDuration)));
        },
      })}
    />
  );
}

/*
 * Types one character the way a keyboard does — the new value is what is on
 * screen PLUS the keystroke. fireEvent.change replaces the whole value, so
 * appending by hand is what makes this a typing test, and the append is exactly
 * what produced "150" from a resurrected "1".
 */
function typeChar(input: HTMLInputElement, char: string) {
  fireEvent.change(input, { target: { value: input.value + char } });
}

describe("PomodoroSettings — blank numeric fields (#624)", () => {
  it("keeps a cleared field empty and records nothing", () => {
    const { props } = renderSettings();
    const work = field("Work");

    fireEvent.change(work, { target: { value: "" } });

    expect(work.value).toBe("");
    expect(props.onSaveSettings).not.toHaveBeenCalled();
  });

  it("accepts a fresh number after a clear without the old digit coming back", () => {
    render(<ClampingHost />);
    const work = field("Work");

    fireEvent.change(work, { target: { value: "" } });
    typeChar(work, "5");
    typeChar(work, "0");

    // Before the fix this read "150": the clear committed 0, the clamp floored
    // it to 1, and the two keystrokes landed on top of that survivor.
    expect(work.value).toBe("50");
  });

  it("shows the host's clamp once the save drops the draft", () => {
    render(<ClampingHost />);
    const work = field("Work");

    fireEvent.change(work, { target: { value: "500" } });
    // Still 500 on screen: nothing has been through the domain's limits yet.
    expect(work.value).toBe("500");

    fireEvent.click(saveButton());
    expect(work.value).toBe("240");
  });

  it("names the blank field in a dialog on blur and refills it on dismiss", () => {
    renderSettings();
    const work = field("Work");

    fireEvent.change(work, { target: { value: "" } });
    fireEvent.blur(work);
    expect(screen.getByText("Enter a number for Work")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      screen.queryByText("Enter a number for Work"),
    ).not.toBeInTheDocument();
    // Refilled, not left blank — a still-blank field would re-open the dialog
    // on the next blur and the user could never reach the nav.
    expect(work.value).toBe("25");
  });

  it("refuses to save a preset while a field is blank", () => {
    const { props } = renderSettings();
    const work = field("Work");

    fireEvent.change(work, { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Preset name"), {
      target: { value: "Morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preset" }));

    expect(props.onCreatePreset).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a number for Work")).toBeInTheDocument();
  });
});

/*
 * #946 — the two columns must keep their inputs on one line even when the
 * labels wrap to different heights.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the misalignment itself cannot be
 * measured here; what can be pinned is the mechanism that removes it. The
 * fields are grid cells, so each one gets the height of its row: making the
 * field fill that height (`h-full`) and letting the CAPTION absorb the surplus
 * (`grow`) leaves the input at the bottom of every cell. A fixed offset or a
 * min-height on the caption would pass a screenshot in one language and break
 * in the other, so their absence is asserted too.
 */
describe("PomodoroSettings — two-column field alignment (#946)", () => {
  const cellOf = (label: string) =>
    field(label).closest("label") as HTMLLabelElement;

  it("stretches every field to its grid row and bottoms out the input", () => {
    renderSettings();

    // "Long break" and "Per set" share a row and are the pair that drifted.
    for (const label of ["Work", "Break", "Long break", "Per set", "Target"]) {
      const cell = cellOf(label);
      expect(cell.className).toContain("flex-col");
      expect(cell.className).toContain("h-full");

      const caption = cell.querySelector("span") as HTMLSpanElement;
      expect(caption).toHaveTextContent(label);
      expect(caption.className).toContain("grow");
    }
  });

  it("does not lean on a hard-coded height for the wrapped labels", () => {
    renderSettings();

    for (const label of ["Long break", "Per set"]) {
      const caption = cellOf(label).querySelector("span") as HTMLSpanElement;
      // en and ja wrap to different line counts, so any measured constant is
      // wrong in the other catalog.
      expect(caption.className).not.toMatch(/\b(min-)?h-\d/);
      expect(caption.className).not.toMatch(/\[\d+px\]/);
    }
  });
});

describe("PomodoroSettings — save button focus affordance (#880)", () => {
  /*
   * jsdom has no layout, so the bug itself (a pale band drawn between the
   * button and its ring) cannot be SEEN here. What can be pinned is the class
   * that draws it: `ring-offset-*` paints the gap a fixed color — `lumen-bg`,
   * the page background — while this button sits on `lumen-bg-secondary` in
   * the panel and `lumen-bg-subsidebar` in the mobile drawer. Any reappearance
   * of that utility on an accent-FILLED control is the bug coming back.
   */
  it("draws its focus ring with outline, not a colored ring offset", () => {
    renderSettings();
    const classes = saveButton().className;

    expect(classes).not.toMatch(/ring-offset/);
    expect(classes).toContain("focus-visible:outline-offset-2");
    // The outline must contrast with the fill. Repeating `lumen-accent` here
    // would merge the ring into the button and put the gap back inside it.
    expect(classes).toContain("focus-visible:outline-lumen-text");
  });
});

describe("PomodoroSettings — disabled save button (#1474)", () => {
  /*
   * The button this issue was reported against, and it does NOT go through the
   * shared <Button> — so the variant map alone would have left this screen
   * unchanged. Same reasoning as the #880 block above: the look is not
   * observable in jsdom, the class that produces it is. `disabled:opacity-*`
   * on an accent fill keeps the hue and only fades it; the fix changes the hue.
   */
  it("drops to a surface fill rather than fading the accent", () => {
    renderSettings();
    const classes = saveButton().className;

    expect(classes).not.toMatch(/disabled:opacity-\d/);
    expect(classes).toContain("disabled:bg-lumen-surface-sunken");
    expect(classes).toContain("disabled:text-lumen-text-tertiary");
    // :hover matches disabled buttons and ties on specificity, so without this
    // the accent comes back the moment the pointer lands on the dead button.
    expect(classes).toContain("disabled:hover:bg-lumen-surface-sunken");
  });
});
