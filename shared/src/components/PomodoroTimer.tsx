import type { ReactNode } from "react";
import { Play, Pause, RotateCcw, SkipForward, Minus, Plus } from "lucide-react";
import { Card } from "./Card";
import { PhaseBadge, type PomodoroPhase } from "./PhaseBadge";
import { SessionDots } from "./SessionDots";
import { cn } from "./cn";

/*
 * Pomodoro timer face (target-IA import). Pure design-system primitive —
 * lumen-* tokens only (§6.4), opaque container (§5), all copy injected via
 * `labels` (no useTranslation). Two variants:
 *
 *  - "card"       — Desktop: a bordered Card, 200px ring, pill main button.
 *  - "fullscreen" — Mobile: no Card chrome, 270px ring, 72px icon-only main
 *                   button, a flex-1 spacer pushing the transport to the base,
 *                   and an optional `taskSlot` (the task chip/picker) between
 *                   the dots and the spacer.
 *
 * The host (WorkScreen) reads useTimerContext and feeds these. The ring arc
 * encodes the REMAINING fraction: dashoffset = C × progress/100 (progress =
 * elapsed %), so a full circle at idle shrinks as time elapses.
 */

export type { PomodoroPhase };

export interface PomodoroTimerLabels {
  /** Phase chip text, keyed by phase. */
  phase: Record<PomodoroPhase, string>;
  start: string;
  pause: string;
  resume: string;
  reset: string;
  skip: string;
  /** Neutral "paused" chip label (shown while paused). */
  paused: string;
  /** −5 min pill label. */
  subtractFive: string;
  /** +5 min pill label. */
  addFive: string;
  /** e.g. "今日 2 / 4 セッション" — already interpolated by the host. */
  sessionsProgress: string;
}

export interface PomodoroTimerProps {
  variant?: "card" | "fullscreen";
  phase: PomodoroPhase;
  isRunning: boolean;
  /** "MM:SS" remaining. */
  formatted: string;
  /** The phase total, e.g. "25:00" — rendered under the readout as "/ 25:00". */
  totalFormatted: string;
  /** 0–100 (elapsed %). */
  progress: number;
  /** Session cadence dots. */
  sessions: { total: number; filled: number };
  labels: PomodoroTimerLabels;
  /** Fullscreen only: the task chip / picker rendered above the transport. */
  taskSlot?: ReactNode;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
  /** Nudge remaining by ±minutes (only wired while paused). */
  onAdjust: (deltaMinutes: number) => void;
}

// Per-phase accent for the ring stroke + main button fill (§6.4 tokens only).
const PHASE_RING: Record<PomodoroPhase, string> = {
  WORK: "text-lumen-accent",
  BREAK: "text-lumen-accent-secondary",
  LONG_BREAK: "text-lumen-phase-long-break",
};
const PHASE_BUTTON: Record<PomodoroPhase, string> = {
  WORK: "bg-lumen-accent text-lumen-on-accent",
  // Mint/amber fills are mid-tone in both themes — white ink fails AA in
  // light mode, so these two use the always-dark on-vivid ink.
  BREAK: "bg-lumen-accent-secondary text-lumen-on-vivid",
  LONG_BREAK: "bg-lumen-phase-long-break text-lumen-on-vivid",
};

export function PomodoroTimer({
  variant = "card",
  phase,
  isRunning,
  formatted,
  totalFormatted,
  progress,
  sessions,
  labels,
  taskSlot,
  onStart,
  onPause,
  onReset,
  onSkip,
  onAdjust,
}: PomodoroTimerProps) {
  const isFull = variant === "fullscreen";
  // Paused = a run in progress but not ticking. Idle = fresh phase (elapsed 0).
  const isPaused = !isRunning && progress > 0;
  const isIdle = !isRunning && !isPaused;

  const ringSize = isFull ? 270 : 200;
  const ringRadius = isFull ? 120 : 86;
  const ringStroke = isFull ? 12 : 10;
  const circumference = 2 * Math.PI * ringRadius;
  const clamped = Math.min(100, Math.max(0, progress));
  const dashOffset = circumference * (clamped / 100);

  const ring = (
    <div
      className="relative grid place-items-center"
      style={{ width: ringSize, height: ringSize }}
    >
      <svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={ringRadius}
          fill="none"
          strokeWidth={ringStroke}
          className="stroke-lumen-surface-sunken"
        />
        <circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={ringRadius}
          fill="none"
          strokeWidth={ringStroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          stroke="currentColor"
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-linear",
            PHASE_RING[phase],
            isPaused && "opacity-50",
          )}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums tracking-tight",
            isFull ? "text-[52px]" : "text-[40px]",
            isPaused ? "text-lumen-text-secondary" : "text-lumen-text",
          )}
          aria-live="polite"
        >
          {formatted}
        </span>
        <span
          className={cn(
            "text-lumen-text-tertiary",
            isFull ? "text-sm" : "text-[13px]",
          )}
        >
          / {totalFormatted}
        </span>
      </div>
    </div>
  );

  const adjustPills = isPaused ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onAdjust(-5)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-lumen-border-strong bg-lumen-bg px-3.5 text-[13px] font-semibold text-lumen-text hover:bg-lumen-hover"
      >
        <Minus size={14} aria-hidden="true" />
        {labels.subtractFive}
      </button>
      <button
        type="button"
        onClick={() => onAdjust(5)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-lumen-border-strong bg-lumen-bg px-3.5 text-[13px] font-semibold text-lumen-text hover:bg-lumen-hover"
      >
        <Plus size={14} aria-hidden="true" />
        {labels.addFive}
      </button>
    </div>
  ) : null;

  // Transport: a round reset, the phase-tinted main button, a round skip.
  const roundSize = isFull ? "h-[52px] w-[52px]" : "h-11 w-11";
  const roundIcon = isFull ? 20 : 18;
  const secondaryBtn = cn(
    "flex items-center justify-center rounded-full border border-lumen-border-strong bg-lumen-bg text-lumen-text-secondary",
    "hover:bg-lumen-hover disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-lumen-bg",
    roundSize,
  );

  const mainLabel = isRunning
    ? labels.pause
    : isPaused
      ? labels.resume
      : labels.start;
  const mainIcon = isRunning ? (
    <Pause size={isFull ? 28 : 16} aria-hidden="true" />
  ) : (
    <Play size={isFull ? 28 : 16} aria-hidden="true" />
  );
  const onMain = isRunning ? onPause : onStart;

  const transport = (
    <div className={cn("flex items-center", isFull ? "gap-6" : "gap-3")}>
      <button
        type="button"
        onClick={onReset}
        disabled={isIdle}
        aria-label={labels.reset}
        className={secondaryBtn}
      >
        <RotateCcw size={roundIcon} aria-hidden="true" />
      </button>
      {isFull ? (
        <button
          type="button"
          onClick={onMain}
          aria-label={mainLabel}
          className={cn(
            "flex h-[72px] w-[72px] items-center justify-center rounded-full shadow-lumen-md",
            PHASE_BUTTON[phase],
          )}
        >
          {mainIcon}
        </button>
      ) : (
        <button
          type="button"
          onClick={onMain}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full px-7 text-[15px] font-semibold",
            PHASE_BUTTON[phase],
          )}
        >
          {mainIcon}
          {mainLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onSkip}
        disabled={isIdle}
        aria-label={labels.skip}
        className={secondaryBtn}
      >
        <SkipForward size={roundIcon} aria-hidden="true" />
      </button>
    </div>
  );

  if (isFull) {
    // The Work body sits in a natural-flow container (not a bounded flex
    // column), so a pure flex-1 spacer has no height to distribute. A soft
    // dynamic-viewport min-height gives the spacer something to grow into,
    // anchoring the transport near the base without hardcoding h-screen
    // (mini-plan Mobile 縦配置 fallback).
    return (
      <div className="flex min-h-[72dvh] flex-1 flex-col items-center">
        <PhaseBadge
          phase={phase}
          label={labels.phase[phase]}
          paused={isPaused}
          pausedLabel={labels.paused}
        />
        <div className="mt-7">{ring}</div>
        <div className="mt-5">
          <SessionDots
            total={sessions.total}
            filled={sessions.filled}
            label={labels.sessionsProgress}
            orientation="stack"
          />
        </div>
        {taskSlot ? <div className="mt-7 max-w-full">{taskSlot}</div> : null}
        <div className="flex-1" />
        {adjustPills ? <div className="mb-4">{adjustPills}</div> : null}
        <div className="mb-7">{transport}</div>
      </div>
    );
  }

  return (
    <Card
      padding="none"
      className={cn(
        "flex flex-col items-center px-6 py-[22px]",
        isPaused ? "gap-3" : "gap-5",
      )}
    >
      <PhaseBadge
        phase={phase}
        label={labels.phase[phase]}
        paused={isPaused}
        pausedLabel={labels.paused}
      />
      {ring}
      <SessionDots
        total={sessions.total}
        filled={sessions.filled}
        label={labels.sessionsProgress}
        orientation="row"
      />
      {adjustPills}
      {transport}
    </Card>
  );
}
