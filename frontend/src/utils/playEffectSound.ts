import { STORAGE_KEYS } from "../constants/storageKeys";

export type SoundEffectKey =
  | "taskComplete"
  | "sessionStart"
  | "sessionComplete"
  | "pomodoroComplete";

export interface SoundEffectSetting {
  enabled: boolean;
  volume: number; // 0-100
}

export type SoundEffectSettings = Record<SoundEffectKey, SoundEffectSetting>;

const DEFAULT_SETTINGS: SoundEffectSettings = {
  taskComplete: { enabled: true, volume: 70 },
  sessionStart: { enabled: true, volume: 70 },
  sessionComplete: { enabled: true, volume: 70 },
  pomodoroComplete: { enabled: true, volume: 70 },
};

export function loadSoundEffectSettings(): SoundEffectSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SOUND_EFFECT_SETTINGS);
    if (!stored) {
      // Migrate from old global volume
      const oldVolume = localStorage.getItem(STORAGE_KEYS.EFFECT_VOLUME);
      if (oldVolume !== null) {
        const vol = Number(oldVolume);
        const migrated: SoundEffectSettings = {
          taskComplete: { enabled: true, volume: vol },
          sessionStart: { enabled: true, volume: vol },
          sessionComplete: { enabled: true, volume: vol },
          pomodoroComplete: { enabled: true, volume: vol },
        };
        return migrated;
      }
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(stored) as Partial<SoundEffectSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSoundEffectSettings(settings: SoundEffectSettings): void {
  localStorage.setItem(
    STORAGE_KEYS.SOUND_EFFECT_SETTINGS,
    JSON.stringify(settings),
  );
}

export function playEffectSound(src: string, key?: SoundEffectKey): void {
  try {
    const settings = loadSoundEffectSettings();

    if (key) {
      const setting = settings[key];
      if (!setting.enabled) return;

      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, setting.volume / 100));
      audio.addEventListener("ended", () => {
        audio.remove();
      });
      audio.play().catch(() => {});
      return;
    }

    // Fallback: use old global volume
    const audio = new Audio(src);
    const stored = localStorage.getItem(STORAGE_KEYS.EFFECT_VOLUME);
    const raw = stored !== null ? Number(stored) : NaN;
    const volume = Number.isNaN(raw) ? 0.7 : raw / 100;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.addEventListener("ended", () => {
      audio.remove();
    });
    audio.play().catch(() => {});
  } catch {
    // Silently ignore audio errors
  }
}
