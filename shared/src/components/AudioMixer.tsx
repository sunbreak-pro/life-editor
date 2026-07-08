import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "./cn";

/*
 * Ambient sound mixer (target-IA import, design 325-357). Pure primitive —
 * lumen-* tokens, opaque container (§5), all copy injected (§6.4 — never calls
 * useTranslation). The host (which reads useAudioContext) supplies the resolved
 * labels + state and the mutators. Each row is a 36px icon toggle + a name +
 * a 0–100 volume slider + a mono readout. OFF rows dim the name/slider/readout
 * (opacity-45) and disable the slider.
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
}

export interface AudioMixerProps {
  sounds: readonly AudioMixerSound[];
  settings: Record<string, { volume: number; enabled: boolean }>;
  labels: AudioMixerLabels;
  onToggle: (id: string, enabled: boolean) => void;
  onVolumeChange: (id: string, volume: number) => void;
}

export function AudioMixer({
  sounds,
  settings,
  labels,
  onToggle,
  onVolumeChange,
}: AudioMixerProps) {
  return (
    <Card padding="none" className="flex flex-col px-5 pb-3 pt-4">
      <h3 className="pb-1.5 text-[13px] font-semibold text-lumen-text-secondary">
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
                  "w-8 shrink-0 text-right font-mono text-[13px] tabular-nums text-lumen-text-tertiary",
                  !state.enabled && "opacity-45",
                )}
              >
                {state.volume}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
