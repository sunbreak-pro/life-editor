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

/*
 * `max-md:min-h-11 max-md:min-w-11` — the 44px touch floor, below the app's
 * single breakpoint only (#1512).
 *
 * Conditional because this ONE component draws both pairs: the Desktop header
 * row (web/src/HeaderUndoRedo.tsx) and the narrow header row, where the audit
 * measured 36×36. A 2rem mouse target is right on Desktop and too small for a
 * thumb, so the floor has to be the narrow branch's alone.
 *
 * Growing the BOX, not hanging a pseudo-element over it the way
 * TAP_TARGET_TALL does: these two sit `gap-0.5` apart, so a hit area wide
 * enough to matter would reach across onto its neighbour — and Undo landing on
 * Redo is worse than either being small. That is the surrounding-check the
 * TAP_TARGET_TALL doc-comment asks for, coming out the other way.
 *
 * min-* rather than max-md:size-11 because `cn`/plain strings do not resolve
 * two utilities of one property by call order (#830); min-height/min-width are
 * separate properties and beat `size-8` in the used-value calculation.
 *
 * `max-md:` is the same lever ItemLinkMenu and SlashMenu already use for this
 * exact floor, so it is what this follows. Its one known cost, stated plainly
 * because tokens.css:604 warns about it: the variant is REM-based (48rem =
 * 864px at the default 18px root) while the shell switches layouts on a literal
 * 768px, so between those two widths a Desktop window draws the wide header
 * with the mobile-sized pair. Nothing breaks — the wide header is 3.75rem, so
 * they still fit — and pinning it instead would mean inventing a second
 * breakpoint convention for one button pair.
 */
const BTN =
  "flex size-8 max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-lumen-md text-lumen-text-secondary transition-colors hover:bg-lumen-hover hover:text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-lumen-text-secondary";

/*
 * Press without taking focus (#1690).
 *
 * These are a text editor's toolbar buttons in everything but placement: the
 * header pair now drives the FOCUSED body editor's own history, and a plain
 * button steals focus on mousedown — so the editor would blur, withdraw its
 * history, and the click that arrived a moment later would land on the app
 * stack instead. Preventing the default on mousedown is the standard answer
 * and costs nothing when no editor is focused. Tab still reaches the buttons,
 * so keyboard users are unaffected.
 */
const keepFocus = (e: { preventDefault: () => void }): void => {
  e.preventDefault();
};

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
        onMouseDown={keepFocus}
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
        onMouseDown={keepFocus}
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
