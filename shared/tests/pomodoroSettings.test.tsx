import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroSettings,
  type PomodoroSettingsProps,
  type PomodoroPresetOption,
} from "../src/components/PomodoroSettings";

/*
 * Work settings + preset editor (rightSidebar / drawer body). Pure primitive —
 * props-injected copy (§6.4). Covers the autoStart switch, the presets empty
 * state, apply/delete wiring and the save form, plus the #624 blank-field
 * behaviour (see the second describe block).
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
  saveAsPreset: "Save",
  apply: "Apply",
  deletePreset: "Delete preset",
  emptyValueConfirm: "OK",
};

const formatEmptyValueMessage = (field: string) =>
  `Enter a number for ${field}`;

function renderSettings(overrides?: Partial<PomodoroSettingsProps>) {
  const props: PomodoroSettingsProps = {
    workDurationMinutes: 25,
    breakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    targetSessions: 4,
    presets: [],
    labels: LABELS,
    onWorkDurationChange: vi.fn(),
    onBreakDurationChange: vi.fn(),
    onLongBreakDurationChange: vi.fn(),
    onSessionsBeforeLongBreakChange: vi.fn(),
    onAutoStartBreaksChange: vi.fn(),
    onTargetSessionsChange: vi.fn(),
    onApplyPreset: vi.fn(),
    onCreatePreset: vi.fn(),
    onDeletePreset: vi.fn(),
    formatEmptyValueMessage,
    ...overrides,
  };
  render(<PomodoroSettings {...props} />);
  return props;
}

describe("PomodoroSettings", () => {
  it("renders the autoStart switch reflecting its checked state", () => {
    renderSettings({ autoStartBreaks: true });
    const sw = screen.getByRole("switch", { name: "Auto-start breaks" });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("toggles autoStart on click", () => {
    const props = renderSettings({ autoStartBreaks: false });
    fireEvent.click(screen.getByRole("switch", { name: "Auto-start breaks" }));
    expect(props.onAutoStartBreaksChange).toHaveBeenCalledWith(true);
  });

  it("shows the empty box when there are no presets", () => {
    renderSettings({ presets: [] });
    expect(screen.getByText("No presets yet")).toBeInTheDocument();
  });

  it("renders a preset row (with mono notation) and wires apply/delete", () => {
    const props = renderSettings({ presets: [PRESET] });
    expect(screen.getByText("Deep focus")).toBeInTheDocument();
    expect(screen.getByText("50·10·30·×2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(props.onApplyPreset).toHaveBeenCalledWith(PRESET);
    fireEvent.click(screen.getByRole("button", { name: "Delete preset" }));
    expect(props.onDeletePreset).toHaveBeenCalledWith(7);
  });

  it("submits a new preset name via the Save button", () => {
    const props = renderSettings();
    fireEvent.change(screen.getByPlaceholderText("Preset name"), {
      target: { value: "Morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onCreatePreset).toHaveBeenCalledWith("Morning");
  });
});

/*
 * #624 — a cleared numeric field must stay cleared.
 *
 * The bug needed BOTH halves to show: the field committed Number("") === 0 the
 * moment it was emptied, and the host clamped that into range. So the host here
 * clamps exactly like TimerContext's clampMinutes (TimerContext.tsx:276) —
 * without it the "150" never appears and the test proves nothing.
 */
function ClampingHost({ onCommit }: { onCommit: (v: number) => void }) {
  const [work, setWork] = useState(25);
  const props: PomodoroSettingsProps = {
    workDurationMinutes: work,
    breakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStartBreaks: false,
    targetSessions: 4,
    presets: [],
    labels: LABELS,
    onWorkDurationChange: (v) => {
      onCommit(v);
      setWork(Math.min(240, Math.max(1, v)));
    },
    onBreakDurationChange: () => {},
    onLongBreakDurationChange: () => {},
    onSessionsBeforeLongBreakChange: () => {},
    onAutoStartBreaksChange: () => {},
    onTargetSessionsChange: () => {},
    onApplyPreset: () => {},
    onCreatePreset: () => {},
    onDeletePreset: () => {},
    formatEmptyValueMessage,
  };
  return <PomodoroSettings {...props} />;
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
  it("keeps a cleared field empty and commits nothing", () => {
    const props = renderSettings();
    const work = screen.getByLabelText("Work") as HTMLInputElement;

    fireEvent.change(work, { target: { value: "" } });

    expect(work.value).toBe("");
    expect(props.onWorkDurationChange).not.toHaveBeenCalled();
  });

  it("accepts a fresh number after a clear without the old digit coming back", () => {
    const onCommit = vi.fn();
    render(<ClampingHost onCommit={onCommit} />);
    const work = screen.getByLabelText("Work") as HTMLInputElement;

    fireEvent.change(work, { target: { value: "" } });
    typeChar(work, "5");
    typeChar(work, "0");

    // Before the fix this read "150": the clear committed 0, the clamp floored
    // it to 1, and the two keystrokes landed on top of that survivor.
    expect(work.value).toBe("50");
    expect(onCommit).toHaveBeenLastCalledWith(50);
  });

  it("names the blank field in a dialog on blur and restores its stored value on dismiss", () => {
    renderSettings();
    const work = screen.getByLabelText("Work") as HTMLInputElement;

    fireEvent.change(work, { target: { value: "" } });
    fireEvent.blur(work);
    expect(screen.getByText("Enter a number for Work")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(
      screen.queryByText("Enter a number for Work"),
    ).not.toBeInTheDocument();
    // Restored, not left blank — a still-blank field would re-open the dialog on
    // the next blur and the user could never reach the nav.
    expect(work.value).toBe("25");
  });

  it("refuses to save a preset while a field is blank", () => {
    const props = renderSettings();
    const work = screen.getByLabelText("Work") as HTMLInputElement;

    fireEvent.change(work, { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText("Preset name"), {
      target: { value: "Morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onCreatePreset).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a number for Work")).toBeInTheDocument();
  });
});
