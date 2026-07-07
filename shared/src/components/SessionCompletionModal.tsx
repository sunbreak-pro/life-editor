import { useId } from "react";
import { Play, Timer } from "lucide-react";
import { Modal } from "./Modal";
import { SessionDots } from "./SessionDots";
import { cn } from "./cn";

/*
 * WORK-session completion modal (target-IA import, design 967-986). Shown by
 * the host (WorkScreen) when a WORK phase finishes (completedSessions ticks up).
 * Pure primitive on top of <Modal>: lumen-* tokens, opaque panel (§5), all copy
 * injected (§6.4). The host resolves the interpolated `title` + `body` strings
 * and passes the session-dots state; this component only lays them out and
 * relays the three action callbacks.
 */

export interface SessionCompletionModalLabels {
  /** Already-interpolated, e.g. "セッション 2 が完了しました". */
  title: string;
  /** Already-interpolated body (task / no-task variant chosen by the host). */
  body: string;
  startBreak: string;
  oneMore: string;
  close: string;
}

export interface SessionCompletionModalProps {
  open: boolean;
  onClose: () => void;
  sessions: { total: number; filled: number };
  labels: SessionCompletionModalLabels;
  onStartBreak: () => void;
  onOneMore: () => void;
}

export function SessionCompletionModal({
  open,
  onClose,
  sessions,
  labels,
  onStartBreak,
  onOneMore,
}: SessionCompletionModalProps) {
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="max-w-[400px]"
    >
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lumen-accent-subtle text-lumen-accent">
          <Timer size={22} aria-hidden="true" />
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h2 id={titleId} className="text-[17px] font-bold text-lumen-text">
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
              "bg-lumen-accent text-[15px] font-semibold text-lumen-on-accent hover:opacity-90",
            )}
          >
            <Play size={16} aria-hidden="true" />
            {labels.startBreak}
          </button>
          <button
            type="button"
            onClick={onOneMore}
            className="flex h-11 items-center justify-center rounded-lumen-md border border-lumen-border-strong bg-lumen-bg text-[15px] font-semibold text-lumen-text hover:bg-lumen-hover"
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
