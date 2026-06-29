import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { cn } from "./cn";

/*
 * Ambient sound mixer (W3-C). Pure primitive — ink-* tokens, opaque
 * container (§5), all copy injected (§6.4 — never calls useTranslation). The
 * host (which reads useAudioContext) supplies the resolved labels + state and
 * the mutators. Each row is a toggle (enabled) + a 0–100 volume slider.
 *
 * a11y: the toggle is a <button role="switch" aria-pressed> with an
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
    <Card padding="md" className="space-y-3">
      <h3 className="text-sm font-medium text-ink-text">{labels.heading}</h3>
      <ul className="space-y-2">
        {sounds.map((sound) => {
          const state = settings[sound.id] ?? { volume: 0, enabled: false };
          const Icon = sound.icon;
          return (
            <li key={sound.id} className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-pressed={state.enabled}
                aria-label={`${labels.toggle}: ${sound.label}`}
                onClick={() => onToggle(sound.id, !state.enabled)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                  state.enabled
                    ? "border-ink-accent bg-ink-accent text-ink-on-accent"
                    : "border-ink-border bg-ink-bg text-ink-text-secondary hover:bg-ink-hover",
                )}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
              <span className="w-16 shrink-0 truncate text-sm text-ink-text">
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
                className="h-1.5 flex-1 cursor-pointer accent-ink-accent disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-text-secondary">
                {state.volume}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
