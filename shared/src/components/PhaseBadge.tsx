import { cn } from "./cn";

/*
 * Phase chip for the Work / Pomodoro timer face (target-IA import). Pure
 * design-system primitive — lumen-* tokens only (§6.4), copy injected via
 * props (no useTranslation). Renders a pill (radius-full, 13px semibold, a
 * 6px leading dot) tinted per phase. When `paused` is set it appends a second
 * neutral "paused" chip to its right (design 601-604 / 1676-1679).
 */

export type PomodoroPhase = "WORK" | "BREAK" | "LONG_BREAK";

export interface PhaseBadgeProps {
  phase: PomodoroPhase;
  /** Already-translated phase label. */
  label: string;
  /** When true, show the neutral "paused" chip beside the phase chip. */
  paused?: boolean;
  /** Already-translated "paused" label (required when `paused`). */
  pausedLabel?: string;
}

// Per-phase chip face. The dot uses `bg-current` so it inherits the chip's
// text tone (WORK=accent, BREAK=mint-fg, LONG_BREAK=progress-fg) — no
// per-phase dot class + no hardcoded colour (§6.4).
const PHASE_CHIP: Record<PomodoroPhase, string> = {
  WORK: "bg-lumen-accent-subtle text-lumen-accent",
  BREAK: "bg-lumen-chip-mint-bg text-lumen-chip-mint-fg",
  LONG_BREAK: "bg-lumen-chip-progress-bg text-lumen-chip-progress-fg",
};

export function PhaseBadge({
  phase,
  label,
  paused = false,
  pausedLabel,
}: PhaseBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
          PHASE_CHIP[phase],
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {label}
      </span>
      {paused ? (
        <span className="inline-flex items-center rounded-full bg-lumen-surface-sunken px-3 py-1 text-[13px] font-semibold text-lumen-text-secondary">
          {pausedLabel}
        </span>
      ) : null}
    </div>
  );
}
