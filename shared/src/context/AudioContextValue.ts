import { createContext } from "react";

/*
 * Audio context value (W3-C). Pattern A (CLAUDE.md §6.3). Audio is a Mobile
 * 省略 Provider (CLAUDE.md §2) — it is NOT mounted on iOS/Android, so this is
 * an OPTIONAL context (default null + null-returning hook); consumers read it
 * via useAudioContext and `if (!ctx) return null`.
 *
 * The Provider owns the 5 ambient-sound HTMLAudioElements (loop=true) plus a
 * one-shot completion-chime element, the persisted per-preset volume/enabled
 * state (sound_settings, 0018), and the AudioContext resume dance the browser
 * autoplay policy requires (CLAUDE.md §3.3 — AudioContext starts suspended;
 * the first user gesture resumes it before any play()).
 */
export interface AudioPresetState {
  /** Volume 0–100 (percent). */
  volume: number;
  enabled: boolean;
}

export interface AudioContextValue {
  /**
   * Per-preset volume/enabled, keyed by preset id (always the 5 presets) —
   * the LIVE mix, i.e. persisted state with any unsaved slider position laid
   * over it (#714). This is what the elements play and what the UI shows.
   */
  settings: Record<string, AudioPresetState>;
  /** Resolved public URLs per preset id (empty until assets resolve). */
  urls: Record<string, string>;
  /**
   * Move a preset's volume (0–100, clamped). Audible AT ONCE, written only by
   * `saveVolumes` (#714) — a mixer whose sound waits for a save button cannot
   * be mixed by ear, and a slider that writes per drag stores every value it
   * passed through on the way.
   */
  setVolume: (id: string, volume: number) => void;
  /** True while a slider sits somewhere other than its persisted value. */
  volumeDirty: boolean;
  /** Persist every pending slider position — the mixer's save button (#714). */
  saveVolumes: () => void;
  /**
   * Toggle a preset on/off. Optimistic + persisted immediately (it is an act,
   * not a half-typed field); resumes AudioContext. The write carries the
   * PERSISTED volume, never a pending slider position — flipping a switch must
   * not smuggle an unsaved volume into the row.
   */
  toggleEnabled: (id: string, enabled: boolean) => void;
  /** Play the one-shot completion chime from the start (host-fired). */
  playCompletionChime: () => void;
  /**
   * Resume the suspended AudioContext (call on the first user gesture). Safe
   * to call repeatedly; a no-op once running.
   */
  resumeAudio: () => void;
}

export const AudioContext = createContext<AudioContextValue | null>(null);
