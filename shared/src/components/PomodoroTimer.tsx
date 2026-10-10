import type { ReactNode } from "react";
import { Play, Pause, RotateCcw, SkipForward, Minus, Plus } from "lucide-react";
import { Card } from "./Card";
import {
  PhaseBadge,
  PHASE_COLOR_TRANSITION,
  type PomodoroPhase,
} from "./PhaseBadge";
import { SessionDots } from "./SessionDots";
import { cn } from "./cn";

/*
 * Pomodoro timer face (target-IA import). Pure design-system primitive —
 * lumen-* tokens only (§6.4), opaque container (§5), all copy injected via
 * `labels` (no useTranslation). Two variants:
 *
 *  - "card"       — Desktop: a bordered Card, 200px ring, pill main button.
 *  - "fullscreen" — Mobile (#2054, Claude Design plan A): no Card chrome, a
 *                   232px ring, labelled transport buttons (64px main, 52px
 *                   reset / skip), and an optional `todoSlot` (the link row
 *                   and the tag row) between a flex-1 spacer and the
 *                   transport. See FullscreenFace below.
 *
 * The Card transport's round buttons are 44px (#881). The fullscreen face
 * bought the room for its larger, labelled buttons back by shrinking the ring
 * from 270px to 232px.
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
  /** Fullscreen only: the todo chip / picker rendered above the transport. */
  todoSlot?: ReactNode;
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
  todoSlot,
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

  // The Card's ring. The fullscreen face draws its own (FullscreenFace).
  const ringSize = 200;
  const ringRadius = 86;
  const ringStroke = 10;
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
            "font-mono font-semibold tabular-nums tracking-tight text-[40px]",
            isPaused ? "text-lumen-text-secondary" : "text-lumen-text",
          )}
          aria-live="polite"
        >
          {formatted}
        </span>
        <span className="text-sm text-lumen-text-tertiary">
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
        className="inline-flex h-8 items-center gap-1 rounded-full border border-lumen-border-strong bg-lumen-bg px-3.5 text-sm font-semibold text-lumen-text hover:bg-lumen-hover"
      >
        <Minus size={14} aria-hidden="true" />
        {labels.subtractFive}
      </button>
      <button
        type="button"
        onClick={() => onAdjust(5)}
        className="inline-flex h-8 items-center gap-1 rounded-full border border-lumen-border-strong bg-lumen-bg px-3.5 text-sm font-semibold text-lumen-text hover:bg-lumen-hover"
      >
        <Plus size={14} aria-hidden="true" />
        {labels.addFive}
      </button>
    </div>
  ) : null;

  // Transport: a round reset, the phase-tinted main button, a round skip.
  // Both variants sit at 44px — the minimum comfortable touch target. The
  // fullscreen face used to run 52px, which stacked with the 72px main button
  // pushed the transport into the rows above and below it on a short phone
  // (#881); coming back to the Card variant's size buys that height back
  // without dropping under the touch minimum.
  const roundSize = "h-11 w-11";
  const roundIcon = 18;
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
    <Pause size={16} aria-hidden="true" />
  ) : (
    <Play size={16} aria-hidden="true" />
  );
  const onMain = isRunning ? onPause : onStart;

  const transport = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onReset}
        disabled={isIdle}
        aria-label={labels.reset}
        className={secondaryBtn}
      >
        <RotateCcw size={roundIcon} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onMain}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full px-7 text-sm font-semibold",
          PHASE_BUTTON[phase],
        )}
      >
        {mainIcon}
        {mainLabel}
      </button>
      {/*
        Skip stays live while idle (#1854). After a completed WORK phase the
        timer lands on an idle BREAK, and with Skip disabled the only way back
        to WORK was to start the break and skip it a moment later, which left
        a seconds-long BREAK row in the log. Skipping an idle phase writes
        nothing: the Provider only closes a row when one is open. Reset is a
        different matter and stays disabled, since an idle phase has nothing to
        reset.
      */}
      <button
        type="button"
        onClick={onSkip}
        aria-label={labels.skip}
        className={secondaryBtn}
      >
        <SkipForward size={roundIcon} aria-hidden="true" />
      </button>
    </div>
  );

  if (isFull) {
    return (
      <FullscreenFace
        phase={phase}
        isRunning={isRunning}
        isPaused={isPaused}
        isIdle={isIdle}
        formatted={formatted}
        totalFormatted={totalFormatted}
        progress={clamped}
        sessions={sessions}
        labels={labels}
        todoSlot={todoSlot}
        onMain={onMain}
        mainLabel={mainLabel}
        onReset={onReset}
        onSkip={onSkip}
        onAdjust={onAdjust}
      />
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

/*
 * The Mobile face (#2054 — Claude Design plan A, 390×844). Same parts as the
 * Card, re-weighted for a phone held in one hand:
 *
 *  - a 232px ring with an 8px stroke, the countdown at 60px monospace, and
 *    under it either "/ 25:00" or — while paused — a pause glyph + "paused".
 *    The paused state lives on the readout rather than as a second chip beside
 *    the badge, because the readout is what the eye is already on;
 *  - the session dots and "today 2 / 4" on ONE line;
 *  - the host's slot (link row + tag row) and the transport pushed into the
 *    lower half, where a thumb reaches;
 *  - every transport button carries its label underneath, always: three
 *    unlabelled circles made "which one is skip" a guess on first use.
 *
 * Motion is the plan's three and no more: the arc shrinks over 1000ms linear
 * per tick, a changed digit fades in on the fast motion step (tokens.css,
 * #2036 — the plan's 120ms snapped to it), and a phase switch recolours
 * the badge, the arc and the main button together on the normal step (the
 * plan's 240ms, snapped the same way). All three are plain CSS, so the
 * app-wide reduced-motion block in tokens.css lands them immediately. The
 * arc's 1000ms is not a motion step: it is one tick of the countdown.
 *
 * Icons sit on the icon steps (sm / md / lg, rem) so they follow the
 * font-size setting with the buttons around them. The one exception is the
 * main button's 28px play / pause: it is larger than lg, and — like the px
 * ring — it is the face's fixed centrepiece rather than a glyph in a row.
 *
 * The phase colours are the existing tokens (accent / mint / long-break
 * amber). The plan proposes three new tokens; #2036 landed without them, and
 * the existing ones cover each need (the #2054 follow-up PR records why).
 */
const FULL_RING_SIZE = 232;
const FULL_RING_STROKE = 8;
const FULL_RING_RADIUS = (FULL_RING_SIZE - FULL_RING_STROKE) / 2;
const FULL_RING_CIRCUMFERENCE = 2 * Math.PI * FULL_RING_RADIUS;

/** The arc's own two transitions: the tick (1000ms linear) and the phase recolour. */
const FULL_ARC_TRANSITION =
  "stroke-dashoffset 1000ms linear, color var(--duration-lumen-normal) var(--ease-lumen-out)";

function FullscreenFace({
  phase,
  isRunning,
  isPaused,
  isIdle,
  formatted,
  totalFormatted,
  progress,
  sessions,
  labels,
  todoSlot,
  onMain,
  mainLabel,
  onReset,
  onSkip,
  onAdjust,
}: {
  phase: PomodoroPhase;
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  formatted: string;
  totalFormatted: string;
  /** Already clamped to 0–100. */
  progress: number;
  sessions: { total: number; filled: number };
  labels: PomodoroTimerLabels;
  todoSlot?: ReactNode;
  onMain: () => void;
  mainLabel: string;
  onReset: () => void;
  onSkip: () => void;
  onAdjust: (deltaMinutes: number) => void;
}) {
  const dashOffset = FULL_RING_CIRCUMFERENCE * (progress / 100);

  const ring = (
    <div
      className="relative grid place-items-center"
      style={{ width: FULL_RING_SIZE, height: FULL_RING_SIZE }}
    >
      <svg
        width={FULL_RING_SIZE}
        height={FULL_RING_SIZE}
        viewBox={`0 0 ${FULL_RING_SIZE} ${FULL_RING_SIZE}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={FULL_RING_SIZE / 2}
          cy={FULL_RING_SIZE / 2}
          r={FULL_RING_RADIUS}
          fill="none"
          strokeWidth={FULL_RING_STROKE}
          className="stroke-lumen-border"
        />
        <circle
          cx={FULL_RING_SIZE / 2}
          cy={FULL_RING_SIZE / 2}
          r={FULL_RING_RADIUS}
          fill="none"
          strokeWidth={FULL_RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={FULL_RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          stroke="currentColor"
          style={{ transition: FULL_ARC_TRANSITION }}
          className={cn(PHASE_RING[phase], isPaused && "opacity-50")}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-2">
        {/* The digits are drawn one span per character, keyed by value, so a
            tick remounts — and fades in — only the digits that changed. The
            row is hidden from assistive tech and the whole readout is spoken
            from the sr-only copy beside it instead of character by character. */}
        <span
          aria-hidden="true"
          data-testid="pomodoro-readout"
          className={cn(
            "flex font-mono text-[60px] font-normal leading-none tracking-[-2px] tabular-nums",
            isPaused ? "text-lumen-text-secondary" : "text-lumen-text",
          )}
        >
          {Array.from(formatted).map((ch, i) => (
            <span key={`${i}-${ch}`} className="lumen-digit-in">
              {ch}
            </span>
          ))}
        </span>
        <span className="sr-only" aria-live="polite">
          {formatted}
        </span>
        {isPaused ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-lumen-text-secondary">
            <Pause aria-hidden="true" className="size-lumen-icon-sm" />
            {labels.paused}
          </span>
        ) : (
          <span className="text-sm tabular-nums text-lumen-text-tertiary">
            / {totalFormatted}
          </span>
        )}
      </div>
    </div>
  );

  const pill =
    "inline-flex min-h-11 items-center gap-1 rounded-full border border-lumen-border-strong bg-lumen-bg px-4 text-sm font-semibold text-lumen-text hover:bg-lumen-hover";

  // One column per control: the circle and its label are ONE button, so the
  // label is part of the target and the column — not just the circle — is
  // what a thumb has to land on.
  const column =
    "group flex flex-col items-center gap-2 rounded-lumen-md disabled:cursor-not-allowed";
  const secondaryCircle = cn(
    "flex h-13 w-13 items-center justify-center rounded-full border border-lumen-border-strong bg-lumen-bg text-lumen-text-secondary",
    "group-enabled:group-hover:bg-lumen-hover group-disabled:opacity-45",
  );
  const secondaryLabel =
    "text-xs text-lumen-text-secondary group-disabled:opacity-45";

  return (
    // The Work body sits in a natural-flow container (not a bounded flex
    // column), so a pure flex-1 spacer has no height to distribute. A soft
    // dynamic-viewport min-height gives the spacer something to grow into,
    // anchoring the controls near the base without hardcoding h-screen.
    <div className="flex min-h-[72dvh] flex-1 flex-col items-center pb-4 pt-2">
      <PhaseBadge phase={phase} label={labels.phase[phase]} icon />
      <div className="mt-4">{ring}</div>
      <div className="mt-4">
        <SessionDots
          total={sessions.total}
          filled={sessions.filled}
          label={labels.sessionsProgress}
          orientation="inline"
        />
      </div>
      {isPaused ? (
        // Text only: the labels already carry their sign ("−5 min"), so a
        // Minus / Plus glyph in front read as "− −5 min" (#2054 follow-up).
        // The Card variant keeps its glyphs — Desktop is out of scope.
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => onAdjust(-5)} className={pill}>
            {labels.subtractFive}
          </button>
          <button type="button" onClick={() => onAdjust(5)} className={pill}>
            {labels.addFive}
          </button>
        </div>
      ) : null}
      <div className="flex-1" />
      {todoSlot ? (
        <div className="flex w-full flex-col gap-2">{todoSlot}</div>
      ) : null}
      <div className="mt-6 grid w-full grid-cols-3 items-start">
        <button
          type="button"
          onClick={onReset}
          disabled={isIdle}
          aria-label={labels.reset}
          className={cn(column, "pt-1.5")}
        >
          <span className={secondaryCircle}>
            <RotateCcw aria-hidden="true" className="size-lumen-icon-md" />
          </span>
          <span className={secondaryLabel}>{labels.reset}</span>
        </button>
        <button
          type="button"
          onClick={onMain}
          aria-label={mainLabel}
          className={column}
        >
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full shadow-lumen-md",
              PHASE_BUTTON[phase],
              PHASE_COLOR_TRANSITION,
            )}
          >
            {isRunning ? (
              <Pause size={28} aria-hidden="true" />
            ) : (
              <Play size={28} aria-hidden="true" />
            )}
          </span>
          <span className="text-xs font-bold text-lumen-text">{mainLabel}</span>
        </button>
        {/* Skip stays live while idle — see the Card transport's note (#1854). */}
        <button
          type="button"
          onClick={onSkip}
          aria-label={labels.skip}
          className={cn(column, "pt-1.5")}
        >
          <span className={secondaryCircle}>
            <SkipForward aria-hidden="true" className="size-lumen-icon-md" />
          </span>
          <span className={secondaryLabel}>{labels.skip}</span>
        </button>
      </div>
    </div>
  );
}
