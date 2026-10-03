import { Coffee, Timer } from "lucide-react";
import { cn } from "./cn";

/*
 * Phase chip for the Work / Pomodoro timer face (target-IA import). Pure
 * design-system primitive — lumen-* tokens only (§6.4), copy injected via
 * props (no useTranslation). Renders a pill (radius-full, 13px semibold, a
 * 6px leading dot) tinted per phase. When `paused` is set it appends a second
 * neutral "paused" chip to its right (design 601-604 / 1676-1679).
 *
 * `icon` swaps the dot for a phase glyph (#2054, Claude Design plan A for the
 * Mobile face): a timer for WORK, a cup for both breaks. The Desktop card does
 * not pass it and keeps the dot. The tint changes over 240ms with the ring and
 * the main button, so a phase switch reads as one change rather than three.
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
  /** Lead with the phase glyph instead of the dot (Mobile face, #2054). */
  icon?: boolean;
}

/**
 * The phase-switch transition plan A asks for (#2054): colour only, 240ms on
 * the standard curve. Shared with the ring and the main button so the three
 * move together. Reduced motion is handled app-wide in tokens.css.
 */
export const PHASE_COLOR_TRANSITION =
  "transition-colors duration-[240ms] ease-[cubic-bezier(.4,0,.2,1)]";

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
  icon = false,
}: PhaseBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
          PHASE_CHIP[phase],
          icon && PHASE_COLOR_TRANSITION,
        )}
      >
        {icon ? (
          phase === "WORK" ? (
            <Timer size={16} aria-hidden="true" />
          ) : (
            <Coffee size={16} aria-hidden="true" />
          )
        ) : (
          <span
            className="h-1.5 w-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
        )}
        {label}
      </span>
      {paused ? (
        <span className="inline-flex items-center rounded-full bg-lumen-surface-sunken px-3 py-1 text-sm font-semibold text-lumen-text-secondary">
          {pausedLabel}
        </span>
      ) : null}
    </div>
  );
}
