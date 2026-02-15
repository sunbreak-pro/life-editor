import { STORAGE_KEYS } from "../../constants/storageKeys";

export interface TimeSlotConfig {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
  evening: { start: string; end: string };
}

export const DEFAULT_TIME_SLOT_CONFIG: TimeSlotConfig = {
  morning: { start: "06:00", end: "09:00" },
  afternoon: { start: "12:00", end: "14:00" },
  evening: { start: "21:00", end: "23:00" },
};

export function loadTimeSlotConfig(): TimeSlotConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROUTINE_TIME_SLOTS);
    if (raw) {
      return JSON.parse(raw) as TimeSlotConfig;
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_TIME_SLOT_CONFIG };
}

export function saveTimeSlotConfig(config: TimeSlotConfig): void {
  localStorage.setItem(STORAGE_KEYS.ROUTINE_TIME_SLOTS, JSON.stringify(config));
}
