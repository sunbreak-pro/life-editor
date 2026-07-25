import { Undo2, Redo2 } from "lucide-react";
import { cn } from "./cn";

/*
 * UndoRedoButtons (Issue #304) — the header undo/redo control pair. Pure
 * presentation: the host injects reactive can-flags, handlers, and already-
 * translated labels (§3.1/§6.4). Each button disables when its direction has
 * no history. lumen-* tokens only.
 */

export interface UndoRedoButtonsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Already-translated labels (aria-label + title). */
  undoLabel: string;
  redoLabel: string;
  className?: string;
}

const BTN =
  "flex size-8 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-lumen-text-secondary";

export function UndoRedoButtons({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  undoLabel,
  redoLabel,
  className,
}: UndoRedoButtonsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label={undoLabel}
        title={undoLabel}
        className={BTN}
      >
        <Undo2 aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label={redoLabel}
        title={redoLabel}
        className={BTN}
      >
        <Redo2 aria-hidden className="size-4" />
      </button>
    </div>
  );
}
