import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { DISABLED_FILLED_BTN, FOCUS_RING_ON_ACCENT } from "./styleTokens";
import { cn } from "./cn";

/*
 * Ambient sound mixer (target-IA import, design 325-357). Pure primitive —
 * lumen-* tokens, opaque container (§5), all copy injected (§6.4 — never calls
 * useTranslation). The host (which reads useAudioContext) supplies the resolved
 * labels + state and the mutators. Each row is a 36px icon toggle + a name +
 * a 0–100 volume slider + a mono readout. OFF rows dim the name/slider/readout
 * (opacity-45) and disable the slider.
 *
 * SAVE BUTTON (#714, Epic #627 — the D-20260810-sched-1 model). Volume is the
 * one control here that is split in TWO: dragging a slider must be audible
 * immediately (a mixer whose sound waits for a button is not a mixer), so
 * `onVolumeChange` still fires per drag and the host still moves the live gain
 * — what waits for `onSave` is the PERSISTED value. `dirty` is the host's
 * report that some slider has moved since the last write; the footer states it
 * in words next to the button.
 *
 * The on/off toggle is NOT drafted: it is an act, not a half-typed field, and
 * a switch that stayed on screen without taking effect would be a lie about
 * what is currently playing.
 *
 * a11y: the toggle is a <button role="switch" aria-checked> with an
 * aria-label; the slider is a native range input with an aria-label. Both are
 * keyboard-operable by default (button = Space/Enter, range = arrows). No
 * keydown handling → no IME guard needed.
 */
export interface AudioMixerSound {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AudioMixerLabels {
  heading: string;
  /** aria-label template part for the per-row toggle (e.g. "Toggle"). */
  toggle: string;
  /** aria-label template part for the per-row slider (e.g. "Volume"). */
  volume: string;
  /** Primary action — "保存" (#714). */
  save: string;
  /** Shown beside the button while nothing is pending — "保存済み" (#714). */
  saved: string;
  /** Shown beside the button while a volume is pending — "未保存" (#714). */
  unsaved: string;
}

export interface AudioMixerProps {
  sounds: readonly AudioMixerSound[];
  settings: Record<string, { volume: number; enabled: boolean }>;
  labels: AudioMixerLabels;
  onToggle: (id: string, enabled: boolean) => void;
  /**
   * A slider moved. Audible at once (#714) — the host applies it to the live
   * gain; only the write waits for `onSave`.
   */
  onVolumeChange: (id: string, volume: number) => void;
  /** Some slider has moved since the last write (#714). */
  dirty: boolean;
  /** Persist every pending slider position (#714). */
  onSave: () => void;
}

export function AudioMixer({
  sounds,
  settings,
  labels,
  onToggle,
  onVolumeChange,
  dirty,
  onSave,
}: AudioMixerProps) {
  return (
    <Card padding="none" className="flex flex-col px-5 pb-3 pt-4">
      <h3 className="pb-1.5 text-sm font-semibold text-lumen-text-secondary">
        {labels.heading}
      </h3>
      <ul>
        {sounds.map((sound) => {
          const state = settings[sound.id] ?? { volume: 0, enabled: false };
          const Icon = sound.icon;
          return (
            <li key={sound.id} className="flex items-center gap-3 py-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={state.enabled}
                aria-label={`${labels.toggle}: ${sound.label}`}
                onClick={() => onToggle(sound.id, !state.enabled)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lumen-md border transition-colors",
                  state.enabled
                    ? "border-lumen-accent bg-lumen-accent text-lumen-on-accent"
                    : "border-lumen-border-strong bg-lumen-bg text-lumen-text-secondary hover:bg-lumen-hover",
                )}
              >
                <Icon size={18} aria-hidden="true" />
              </button>
              <span
                className={cn(
                  "w-14 shrink-0 truncate text-sm text-lumen-text",
                  !state.enabled && "opacity-45",
                )}
              >
                {sound.label}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={state.volume}
                aria-label={`${labels.volume}: ${sound.label}`}
                disabled={!state.enabled}
                onChange={(e) =>
                  onVolumeChange(sound.id, Number(e.target.value))
                }
                className={cn(
                  "h-1 flex-1 cursor-pointer accent-lumen-accent",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                )}
              />
              <span
                className={cn(
                  "w-8 shrink-0 text-right font-mono text-sm tabular-nums text-lumen-text-tertiary",
                  !state.enabled && "opacity-45",
                )}
              >
                {state.volume}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Save footer (#714) — the only write. The sliders above are already
          audible, so what this button changes is whether the mix survives a
          reload. Disabled while nothing is pending, with the state named
          beside it rather than left to the button's opacity. */}
      <div className="mt-1.5 flex items-center justify-end gap-3 border-t border-lumen-border pt-3">
        <span
          aria-live="polite"
          className={cn(
            "text-xs",
            dirty ? "text-lumen-accent" : "text-lumen-text-secondary",
          )}
        >
          {dirty ? labels.unsaved : labels.saved}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty}
          className={cn(
            "shrink-0 rounded-lumen-md bg-lumen-accent px-3.5 py-2 text-sm font-semibold text-lumen-on-accent transition-colors hover:bg-lumen-accent-hover",
            FOCUS_RING_ON_ACCENT,
            // The 環境音 half of the #1474 report — same hand-rolled markup as
            // PomodoroSettings' save button, same treatment.
            DISABLED_FILLED_BTN,
          )}
        >
          {labels.save}
        </button>
      </div>
    </Card>
  );
}
