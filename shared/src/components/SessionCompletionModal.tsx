import { useId } from "react";
import { Check, Coffee, Play, Timer } from "lucide-react";
import { Modal } from "./Modal";
import { SessionDots } from "./SessionDots";
import { WorkTargetGlyph, type WorkTargetOption } from "./PomodoroTodoSelector";
import { cn } from "./cn";

/*
 * WORK-session completion modal (target-IA import, design 967-986). Shown by
 * the host (WorkScreen) when a WORK phase finishes (completedSessions ticks up).
 * Pure primitive on top of <Modal>: lumen-* tokens, opaque panel (§5), all copy
 * injected (§6.4). The host resolves the interpolated `title` + `body` strings
 * and passes the session-dots state; this component only lays them out and
 * relays the three action callbacks.
 *
 * `variant="mobile"` is the Mobile Work face's version (#2054, Claude Design
 * plan A): a check mark instead of the timer glyph, "N min logged" on its own
 * line with the linked item as a chip under it (instead of one sentence that
 * carries both), and a break button filled with the colour of the break it
 * starts. The Desktop card keeps the default layout.
 */

export interface SessionCompletionModalLabels {
  /** Already-interpolated, e.g. "セッション 2 が完了しました". */
  title: string;
  /** Already-interpolated body (todo / no-todo variant chosen by the host). */
  body: string;
  startBreak: string;
  oneMore: string;
  close: string;
  /** Mobile only — already-interpolated "25 分を記録しました". */
  logged?: string;
}

export interface SessionCompletionModalProps {
  open: boolean;
  onClose: () => void;
  sessions: { total: number; filled: number };
  labels: SessionCompletionModalLabels;
  onStartBreak: () => void;
  onOneMore: () => void;
  /** Default = the Desktop layout; mobile = plan A's layout (#2054). */
  variant?: "default" | "mobile";
  /** Mobile only: the item the minutes were filed against, shown as a chip. */
  target?: { kind: WorkTargetOption["kind"]; title: string } | null;
  /** Mobile only: which break the button starts — it takes that phase's fill. */
  breakPhase?: "BREAK" | "LONG_BREAK";
}

/*
 * The break button wears the colour of the phase it starts. Mint and amber are
 * mid-tone in both themes, so the ink is the always-dark on-vivid — white on
 * mint is 3.1:1 (the plan's own note) and fails AA.
 */
const BREAK_FILL: Record<"BREAK" | "LONG_BREAK", string> = {
  BREAK: "bg-lumen-accent-secondary text-lumen-on-vivid",
  LONG_BREAK: "bg-lumen-phase-long-break text-lumen-on-vivid",
};

export function SessionCompletionModal({
  open,
  onClose,
  sessions,
  labels,
  onStartBreak,
  onOneMore,
  variant = "default",
  target = null,
  breakPhase = "BREAK",
}: SessionCompletionModalProps) {
  const titleId = useId();

  if (variant === "mobile") {
    return (
      <Modal open={open} onClose={onClose} labelledBy={titleId} size="sm">
        <div className="flex flex-col items-center pt-2">
          <span className="flex h-13 w-13 items-center justify-center rounded-full bg-lumen-accent-subtle text-lumen-accent">
            <Check aria-hidden="true" className="size-lumen-icon-lg" />
          </span>
          <h2
            id={titleId}
            className="mt-4 text-pretty text-center text-lg font-bold text-lumen-text"
          >
            {labels.title}
          </h2>
          {labels.logged ? (
            <p className="mt-2 text-sm text-lumen-text-secondary">
              {labels.logged}
            </p>
          ) : null}
          {target ? (
            <span className="mt-3 inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-lumen-border bg-lumen-bg-secondary pl-1 pr-3">
              <WorkTargetGlyph kind={target.kind} size="sm" />
              <span className="truncate text-xs text-lumen-text-secondary">
                {target.title}
              </span>
            </span>
          ) : null}
          <div className="mt-6 flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={onStartBreak}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-lumen-lg px-4 text-base font-bold hover:opacity-90",
                BREAK_FILL[breakPhase],
              )}
            >
              <Coffee aria-hidden="true" className="size-lumen-icon-md" />
              {labels.startBreak}
            </button>
            <button
              type="button"
              onClick={onOneMore}
              className="flex min-h-12 items-center justify-center rounded-lumen-lg border border-lumen-border-strong bg-lumen-bg px-4 text-base font-semibold text-lumen-text hover:bg-lumen-hover"
            >
              {labels.oneMore}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 items-center justify-center rounded-lumen-md text-sm text-lumen-text-secondary hover:bg-lumen-hover"
            >
              {labels.close}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="sm">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lumen-accent-subtle text-lumen-accent">
          <Timer size={22} aria-hidden="true" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h2 id={titleId} className="text-base font-bold text-lumen-text">
            {labels.title}
          </h2>
          <p className="text-pretty text-center text-sm text-lumen-text-secondary">
            {labels.body}
          </p>
        </div>
        <SessionDots total={sessions.total} filled={sessions.filled} />
        <div className="flex w-full flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onStartBreak}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lumen-md",
              "bg-lumen-accent text-sm font-semibold text-lumen-on-accent hover:opacity-90",
            )}
          >
            <Play size={16} aria-hidden="true" />
            {labels.startBreak}
          </button>
          <button
            type="button"
            onClick={onOneMore}
            className="flex h-11 items-center justify-center rounded-lumen-md border border-lumen-border-strong bg-lumen-bg text-sm font-semibold text-lumen-text hover:bg-lumen-hover"
          >
            {labels.oneMore}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-lumen-md text-sm font-medium text-lumen-text-secondary hover:bg-lumen-hover"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
