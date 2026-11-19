// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  rowToSoundSettings,
  soundSettingsToUpsert,
  type SoundSettingsRow,
} from "../src/services/audioMapper";

const USER = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-06-10T12:00:00.000Z";

function soundRow(overrides: Partial<SoundSettingsRow> = {}): SoundSettingsRow {
  return {
    id: 2,
    user_id: USER,
    sound_type: "rain",
    volume: 70,
    enabled: true,
    created_at: "2026-06-10T10:00:00.000Z",
    updated_at: "2026-06-10T11:00:00.000Z",
    ...overrides,
  };
}

describe("audioMapper — sound_settings", () => {
  it("maps a row to SoundSettings with a Date updatedAt", () => {
    const s = rowToSoundSettings(soundRow());
    expect(s.id).toBe(2);
    expect(s.soundType).toBe("rain");
    expect(s.volume).toBe(70);
    expect(s.enabled).toBe(true);
    expect(s.updatedAt).toBeInstanceOf(Date);
    expect(s.updatedAt.toISOString()).toBe("2026-06-10T11:00:00.000Z");
  });

  it("upsert row carries updated_at and the conflict key fields", () => {
    const row = soundSettingsToUpsert("waves", 40, false, NOW);
    expect(row).toEqual({
      sound_type: "waves",
      volume: 40,
      enabled: false,
      updated_at: NOW,
    });
  });
});
