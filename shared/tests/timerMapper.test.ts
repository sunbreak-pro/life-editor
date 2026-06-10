import { describe, it, expect } from "vitest";
import {
  rowToTimerSettings,
  timerSettingsUpdatesToPatch,
  rowToTimerSession,
  newTimerSessionInsert,
  closeTimerSessionPatch,
  rowToPomodoroPreset,
  pomodoroPresetToInsert,
  pomodoroPresetUpdatesToPatch,
  toSessionType,
  type TimerSettingsRow,
  type TimerSessionRow,
  type PomodoroPresetRow,
} from "../src/services/timerMapper";

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-06-10T12:00:00.000Z";

function settingsRow(
  overrides: Partial<TimerSettingsRow> = {},
): TimerSettingsRow {
  return {
    id: 1,
    user_id: USER,
    work_duration: 25,
    break_duration: 5,
    long_break_duration: 15,
    sessions_before_long_break: 4,
    auto_start_breaks: false,
    target_sessions: 4,
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
}

function sessionRow(overrides: Partial<TimerSessionRow> = {}): TimerSessionRow {
  return {
    id: 7,
    user_id: USER,
    task_id: "task-123",
    session_type: "WORK",
    started_at: "2026-06-10T09:00:00.000Z",
    ended_at: "2026-06-10T09:25:00.000Z",
    duration: 1500,
    completed: true,
    label: null,
    created_at: "2026-06-10T09:00:00.000Z",
    updated_at: "2026-06-10T09:25:00.000Z",
    ...overrides,
  };
}

function presetRow(
  overrides: Partial<PomodoroPresetRow> = {},
): PomodoroPresetRow {
  return {
    id: 3,
    user_id: USER,
    name: "Deep Work",
    work_duration: 50,
    break_duration: 10,
    long_break_duration: 30,
    sessions_before_long_break: 3,
    created_at: "2026-06-10T08:00:00.000Z",
    updated_at: "2026-06-10T08:00:00.000Z",
    ...overrides,
  };
}

describe("timerMapper — timer_settings", () => {
  it("maps a row to TimerSettings with a Date updatedAt", () => {
    const s = rowToTimerSettings(settingsRow());
    expect(s.id).toBe(1);
    expect(s.workDuration).toBe(25);
    expect(s.autoStartBreaks).toBe(false);
    expect(s.targetSessions).toBe(4);
    expect(s.updatedAt).toBeInstanceOf(Date);
    expect(s.updatedAt.toISOString()).toBe("2026-06-10T11:00:00.000Z");
  });

  it("update patch always bumps updated_at and only emits present keys", () => {
    const patch = timerSettingsUpdatesToPatch({ workDuration: 30 }, NOW);
    expect(patch.updated_at).toBe(NOW);
    expect(patch.work_duration).toBe(30);
    expect(patch.break_duration).toBeUndefined();
  });

  it("update patch with no fields still bumps updated_at", () => {
    const patch = timerSettingsUpdatesToPatch({}, NOW);
    expect(Object.keys(patch)).toEqual(["updated_at"]);
  });
});

describe("timerMapper — timer_sessions", () => {
  it("maps ended_at to completedAt Date; null stays null", () => {
    const closed = rowToTimerSession(sessionRow());
    expect(closed.completedAt).toBeInstanceOf(Date);
    expect((closed.completedAt as Date).toISOString()).toBe(
      "2026-06-10T09:25:00.000Z",
    );
    expect(closed.startedAt.toISOString()).toBe("2026-06-10T09:00:00.000Z");

    const open = rowToTimerSession(
      sessionRow({ ended_at: null, duration: null, completed: false }),
    );
    expect(open.completedAt).toBeNull();
    expect(open.duration).toBeNull();
  });

  it("newTimerSessionInsert omits user_id and id (DB-derived)", () => {
    const ins = newTimerSessionInsert("FREE", null, NOW);
    expect(ins).toEqual({
      session_type: "FREE",
      task_id: null,
      started_at: NOW,
    });
  });

  it("closeTimerSessionPatch stamps ended_at + bumps updated_at", () => {
    const patch = closeTimerSessionPatch(NOW, 1500, true, "Focus block");
    expect(patch.ended_at).toBe(NOW);
    expect(patch.updated_at).toBe(NOW);
    expect(patch.duration).toBe(1500);
    expect(patch.completed).toBe(true);
    expect(patch.label).toBe("Focus block");
  });

  it("closeTimerSessionPatch omits label when undefined", () => {
    const patch = closeTimerSessionPatch(NOW, 60, false, undefined);
    expect("label" in patch).toBe(false);
  });

  it("toSessionType rejects unknown values", () => {
    expect(toSessionType("WORK")).toBe("WORK");
    expect(() => toSessionType("NOPE")).toThrow(/invalid session_type/);
  });
});

describe("timerMapper — pomodoro_presets", () => {
  it("roundtrips row -> domain -> insert (snake/camel + drop id)", () => {
    const preset = rowToPomodoroPreset(presetRow());
    expect(preset.id).toBe(3);
    expect(preset.workDuration).toBe(50);
    expect(preset.createdAt).toBe("2026-06-10T08:00:00.000Z");

    const ins = pomodoroPresetToInsert(preset);
    expect(ins).toEqual({
      name: "Deep Work",
      work_duration: 50,
      break_duration: 10,
      long_break_duration: 30,
      sessions_before_long_break: 3,
    });
    expect("id" in ins).toBe(false);
    expect("created_at" in ins).toBe(false);
  });

  it("update patch bumps updated_at and maps present keys", () => {
    const patch = pomodoroPresetUpdatesToPatch(
      { name: "Renamed", workDuration: 45 },
      NOW,
    );
    expect(patch.updated_at).toBe(NOW);
    expect(patch.name).toBe("Renamed");
    expect(patch.work_duration).toBe(45);
    expect(patch.break_duration).toBeUndefined();
  });
});
