import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/*
 * ConfirmDialog (#707) — the in-app replacement for `window.confirm` /
 * `window.alert`.
 *
 * A native dialog is drawn by the browser, so it lands outside the theme, the
 * fonts and the lumen-* tokens: on the same screen the repeat-delete guard
 * asks in-app and the conversion guard asked through the OS, which made one of
 * the two look like it came from somewhere else. It also freezes the page,
 * which is why Playwright cannot get past one.
 *
 * Two shapes, told apart by `cancelLabel` alone rather than by a `variant`
 * flag — one source of truth for "can this be refused", with no second boolean
 * to fall out of step:
 *   with cancelLabel    — a question (the `confirm`)
 *   without cancelLabel — a statement to acknowledge (the `alert`)
 *
 * Pure presentation (§3.1 / §6.4): copy arrives already translated, both
 * answers are callbacks. lumen-* tokens only, opaque panel via <Modal>.
 */

export interface ConfirmRequest {
  /**
   * Already-translated question or statement. It also NAMES the dialog
   * (aria-labelledby), so a screen reader announces the actual question
   * instead of a generic "Confirm".
   */
  message: string;
  /** Affirmative label, already translated. */
  confirmLabel: string;
  /**
   * Leave off for an acknowledge-only dialog: a refusal that reports WHY has
   * nothing for the user to decide, so offering a second button would invent a
   * choice that does not exist.
   */
  cancelLabel?: string;
  /** Paint the affirmative as destructive. */
  danger?: boolean;
}

export interface ConfirmDialogProps extends ConfirmRequest {
  open: boolean;
  onConfirm: () => void;
  /** Cancel, Escape and the backdrop all land here. */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messageId = useId();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy={messageId}
      className="max-w-sm"
    >
      <p
        id={messageId}
        className="whitespace-pre-line text-sm leading-relaxed text-lumen-text"
      >
        {message}
      </p>
      {/* Cancel is DOM-first so the Modal's initial focus lands on the safe
          answer — never on a destructive one (same arrangement as
          RepeatScopeDialog). Visual order still reads cancel → confirm. */}
      <div className="mt-4 flex justify-end gap-2">
        {cancelLabel != null && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button
          variant={danger ? "danger" : "primary"}
          size="sm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export interface ConfirmDialogController {
  /** The question on screen, or null when nothing is being asked. */
  request: ConfirmRequest | null;
  /**
   * Ask, and await the answer. `true` = the affirmative was pressed; Escape,
   * the backdrop and Cancel all resolve `false`.
   */
  ask: (request: ConfirmRequest) => Promise<boolean>;
  /** Answer the pending question (wire to the dialog's two callbacks). */
  resolve: (answer: boolean) => void;
}

/**
 * Drives one <ConfirmDialog> for a host that has several questions to ask.
 *
 * `window.confirm` returned its answer inline, so callers were written as
 * straight-line code; this returns a promise instead, and every call site that
 * used to branch on the return value now continues in a `.then`. The write
 * must still be claimed synchronously once the answer arrives (#434) — the
 * dialog covers the page while it is open, but nothing else does.
 *
 * A second question asked while one is on screen is REFUSED (resolves `false`)
 * rather than queued or allowed to replace the pending one: replacing it would
 * leave the first caller waiting forever, and `false` is the safe answer
 * everywhere here — it declines a conversion, a delete, and a discard alike.
 * The realistic way to reach it is a double Escape on the editor, before the
 * first dialog has painted.
 *
 * If the host unmounts with a question pending the promise never settles, so
 * the continuation — and its write — simply never runs. That is the intended
 * outcome: the surface that asked is gone.
 */
export function useConfirmDialog(): ConfirmDialogController {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // The resolver is a ref, not state: `ask` has to see a pending question in
  // the same tick it was opened (two Escapes can land before a render).
  const resolverRef = useRef<((answer: boolean) => void) | null>(null);

  const ask = useCallback((next: ConfirmRequest) => {
    if (resolverRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const resolve = useCallback((answer: boolean) => {
    const pending = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    pending?.(answer);
  }, []);

  return useMemo(() => ({ request, ask, resolve }), [request, ask, resolve]);
}
