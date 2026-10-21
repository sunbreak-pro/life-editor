import {
  CloudRain,
  Wind,
  Waves,
  Bird,
  Flame,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "../i18n/resources";

/*
 * W3-C ambient sound presets (scope-confirmed 2026-06-10): exactly 5 presets
 * — rain / wind / ocean / birds / fire (thunder intentionally excluded).
 * Custom sounds / playlists / sound tags are OUT OF SCOPE (their throw-stubs
 * stay untouched).
 *
 * Each preset's audio asset is served from the public Supabase Storage bucket
 * `sounds` as `<id>-v<N>.mp3` (objectName). The completion chime is
 * `complete.mp3`. The version is in the name so the bucket can serve each
 * object with a year-long cache (#2290): a rebuilt loop goes up under the next
 * number and reaches the app only when this table moves to it, instead of
 * hiding behind a cached copy of the old file.
 * Assets are uploaded by the user separately; the code only builds the URL and
 * plays it, so an un-uploaded asset is just a 404 — no code path depends on
 * file existence.
 *
 * What a replacement asset has to satisfy (#1793, measured 2026-09-21 —
 * .claude/docs/reports/2026-09-21-ambient-sound-asset-measurement.md): encoded
 * ONCE from uncompressed source at CBR 128 kbps (320 kbps until #2290 — one
 * minute of rain was a 5MB download, most of a phone's daily traffic; at
 * 128 kbps LAME drops the quiet content above 16 kHz, which is the price
 * accepted there, so a 16 kHz wall is no longer a sign of re-use), no silence
 * left at either end (`el.loop` plays the tail gap and the head gap back to
 * back — the pre-2026-09-28 files had a 39-139 ms dropout every wrap), and at
 * least 60 s long so the seam comes round rarely.
 *
 * The five loops are built by supabase/scripts/ambient-loops.mjs from the
 * recordings listed in supabase/scripts/ambient-sources.json (source, licence,
 * the stretch used). Rebuild them from there rather than editing a file by
 * hand; the steps and the upload are in supabase/README.md.
 *
 * `-v2`: the 128 kbps build of #2290. The objects must be in the bucket
 * before code naming them ships, or every loop is a 404.
 *
 * `labelKey` is an i18n key (resolved by the host, not the primitive — §6.4
 * i18n props injection). `icon` is a lucide-react component (rendered by the
 * Mixer primitive).
 */

export interface SoundPresetDef {
  /** Stable preset id; also the sound_settings.sound_type value + asset stem. */
  id: string;
  /** i18n key for the display label (host resolves with t()). Typed as the
   *  catalog's key union (#726). */
  labelKey: TranslationKey;
  /** lucide-react icon component. */
  icon: LucideIcon;
  /** Storage object name in the `sounds` bucket (`<id>-v<N>.mp3`). */
  objectName: string;
}

export const SOUND_PRESETS: readonly SoundPresetDef[] = [
  {
    id: "rain",
    labelKey: "audioMixer.sound.rain",
    icon: CloudRain,
    objectName: "rain-v2.mp3",
  },
  {
    id: "wind",
    labelKey: "audioMixer.sound.wind",
    icon: Wind,
    objectName: "wind-v2.mp3",
  },
  {
    id: "ocean",
    labelKey: "audioMixer.sound.ocean",
    icon: Waves,
    objectName: "ocean-v2.mp3",
  },
  {
    id: "birds",
    labelKey: "audioMixer.sound.birds",
    icon: Bird,
    objectName: "birds-v2.mp3",
  },
  {
    id: "fire",
    labelKey: "audioMixer.sound.fire",
    icon: Flame,
    objectName: "fire-v2.mp3",
  },
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
