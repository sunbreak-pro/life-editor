import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { cn } from "./cn";

/*
 * Pomodoro timer face (W3-B). Pure design-system primitive — notion-* tokens
 * only, opaque container (§5), all copy injected via `labels` (no
 * useTranslation, §6.4). It renders the phase chip, an SVG ring driven by
 * `progress`, the MM:SS readout, the session counter, and the transport
 * controls. The host (WorkScreen) reads useTimerContext and feeds these.
 */

export type PomodoroPhase = "WORK" | "BREAK" | "LONG_BREAK";

export interface PomodoroTimerLabels {
  /** Phase chip text, keyed by phase. */
  phase: Record<PomodoroPhase, string>;
  start: string;
  pause: string;
  reset: string;
  skip: string;
  /** e.g. "{completed} / {target} sessions" already interpolated by host. */
  sessionsProgress: string;
}

export interface PomodoroTimerProps {
  phase: PomodoroPhase;
  isRunning: boolean;
  /** "MM:SS". */
  formatted: string;
  /** 0–100. */
  progress: number;
  labels: PomodoroTimerLabels;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

const RING_RADIUS = 86;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Phase → accent class for the ring + chip. WORK uses the accent; breaks use a
// calmer success tone. All notion-* tokens (no hardcoded colour, §6.4).
const PHASE_RING: Record<PomodoroPhase, string> = {
  WORK: "text-notion-accent",
  BREAK: "text-notion-success",
  LONG_BREAK: "text-notion-success",
};

export function PomodoroTimer({
  phase,
  isRunning,
  formatted,
  progress,
  labels,
  onStart,
  onPause,
  onReset,
  onSkip,
}: PomodoroTimerProps) {
  const dashOffset =
    RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress / 100)));

  return (
    <Card padding="lg" className="flex flex-col items-center gap-5">
      <span
        className={cn(
          "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
          "bg-notion-bg-secondary",
          PHASE_RING[phase],
        )}
      >
        {labels.phase[phase]}
      </span>

      <div className="relative grid place-items-center">
        <svg
          width={200}
          height={200}
          viewBox="0 0 200 200"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={100}
            cy={100}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={10}
            className="stroke-notion-border"
          />
          <circle
            cx={100}
            cy={100}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear",
              PHASE_RING[phase],
            )}
            stroke="currentColor"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="font-mono text-4xl font-semibold tabular-nums text-notion-text"
            aria-live="polite"
          >
            {formatted}
          </span>
          <span className="mt-1 text-xs text-notion-text-secondary">
            {labels.sessionsProgress}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            variant="secondary"
            size="lg"
            leadingIcon={<Pause size={18} />}
            onClick={onPause}
          >
            {labels.pause}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<Play size={18} />}
            onClick={onStart}
          >
            {labels.start}
          </Button>
        )}
        <Button
          variant="ghost"
          size="lg"
          leadingIcon={<RotateCcw size={18} />}
          onClick={onReset}
          aria-label={labels.reset}
        >
          {labels.reset}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          leadingIcon={<SkipForward size={18} />}
          onClick={onSkip}
          aria-label={labels.skip}
        >
          {labels.skip}
        </Button>
      </div>
    </Card>
  );
}
