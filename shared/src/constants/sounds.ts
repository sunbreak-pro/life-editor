import { CloudRain, Wind, Waves, Bird, Flame, type LucideIcon } from "lucide-react";

/*
 * W3-C ambient sound presets (scope-confirmed 2026-06-10): exactly 5 presets
 * — rain / wind / ocean / birds / fire (thunder intentionally excluded).
 * Custom sounds / playlists / sound tags are OUT OF SCOPE (their throw-stubs
 * stay untouched).
 *
 * Each preset's audio asset is served from the public Supabase Storage bucket
 * `sounds` as `<id>.mp3` (objectName). The completion chime is `complete.mp3`.
 * Assets are uploaded by the user separately; the code only builds the URL and
 * plays it, so an un-uploaded asset is just a 404 — no code path depends on
 * file existence.
 *
 * `labelKey` is an i18n key (resolved by the host, not the primitive — §6.4
 * i18n props injection). `icon` is a lucide-react component (rendered by the
 * Mixer primitive).
 */

export interface SoundPresetDef {
  /** Stable preset id; also the sound_settings.sound_type value + asset stem. */
  id: string;
  /** i18n key for the display label (host resolves with t()). */
  labelKey: string;
  /** lucide-react icon component. */
  icon: LucideIcon;
  /** Storage object name in the `sounds` bucket (`<id>.mp3`). */
  objectName: string;
}

export const SOUND_PRESETS: readonly SoundPresetDef[] = [
  { id: "rain", labelKey: "audioMixer.sound.rain", icon: CloudRain, objectName: "rain.mp3" },
  { id: "wind", labelKey: "audioMixer.sound.wind", icon: Wind, objectName: "wind.mp3" },
  { id: "ocean", labelKey: "audioMixer.sound.ocean", icon: Waves, objectName: "ocean.mp3" },
  { id: "birds", labelKey: "audioMixer.sound.birds", icon: Bird, objectName: "birds.mp3" },
  { id: "fire", labelKey: "audioMixer.sound.fire", icon: Flame, objectName: "fire.mp3" },
] as const;

/** Storage object name of the phase-completion chime. */
export const COMPLETION_SOUND_OBJECT = "complete.mp3";

/** Default per-preset state when no sound_settings row exists yet. */
export const DEFAULT_SOUND_VOLUME = 50;
export const DEFAULT_SOUND_ENABLED = false;

/** Min/max volume bounds (percent). */
export const SOUND_VOLUME_MIN = 0;
export const SOUND_VOLUME_MAX = 100;

/** Clamp a volume to the [0, 100] integer percent range. */
export function clampSoundVolume(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_SOUND_VOLUME;
  return Math.max(SOUND_VOLUME_MIN, Math.min(SOUND_VOLUME_MAX, Math.round(v)));
}

/**
 * Merge persisted sound_settings rows over the 5 preset defaults. Rows for
 * unknown sound_types are ignored; presets with no row fall back to the
 * default volume/enabled. The result always has exactly the 5 preset ids.
 */
export function mergeSoundSettings(
  rows: ReadonlyArray<{ soundType: string; volume: number; enabled: boolean }>,
): Record<string, { volume: number; enabled: boolean }> {
  const byType = new Map(rows.map((r) => [r.soundType, r]));
  const out: Record<string, { volume: number; enabled: boolean }> = {};
  for (const preset of SOUND_PRESETS) {
    const row = byType.get(preset.id);
    out[preset.id] = {
      volume: row ? clampSoundVolume(row.volume) : DEFAULT_SOUND_VOLUME,
      enabled: row ? row.enabled : DEFAULT_SOUND_ENABLED,
    };
  }
  return out;
}
