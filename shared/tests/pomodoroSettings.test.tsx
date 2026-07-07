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
 * state, apply/delete wiring and the save form.
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
};

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
