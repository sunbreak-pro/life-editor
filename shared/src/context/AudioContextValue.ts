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
  /** Per-preset volume/enabled, keyed by preset id (always the 5 presets). */
  settings: Record<string, AudioPresetState>;
  /** Resolved public URLs per preset id (empty until assets resolve). */
  urls: Record<string, string>;
  /** Set a preset's volume (0–100, clamped). Optimistic + persisted. */
  setVolume: (id: string, volume: number) => void;
  /** Toggle a preset on/off. Optimistic + persisted; resumes AudioContext. */
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
