import { useEffect, useId, useRef, useState } from "react";

/*
 * Note password / edit-lock dialog (S3, required incl. UI). Wires the
 * shared DataService-backed actions exposed on `useNotesUnifiedContext`:
 *   - setNotePassword / removeNotePassword / verifyNotePassword
 *   - toggleEditLock
 *
 * Accessibility (CLAUDE.md §6 / coding-principles):
 *   - role="dialog" + aria-modal + labelled by the heading
 *   - opaque surface (notion-bg, no transparency on the panel — only the
 *     scrim is dimmed) so nothing silently falls transparent
 *   - Escape closes; focus moves to the first field on open and is
 *     restored to the opener on close
 *   - inputs are plain controlled <input>s — no keydown handlers that
 *     could swallow IME composition (`isComposing`); submission is via a
 *     real <form onSubmit> + button so Enter mid-composition is safe
 *   - all visible text is injected via the `labels` prop (i18n stays in
 *     the host shell, never a useTranslation() inside this component)
 *   - Tab-cycle focus trap is intentionally deferred — aria-modal + few
 *     controls make it low-risk for S3
 */

// Shared focus-visible ring (notion tokens only — no hardcoded colors).
// Kept in sync with the identical constant in NotesView.tsx; promoting it
// to a shared export is out of this focused pass's scope.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-notion-accent focus-visible:ring-offset-2 focus-visible:ring-offset-notion-bg";

export type NotePasswordMode = "set" | "remove" | "verify";

export interface NotePasswordDialogLabels {
  setTitle: string;
  removeTitle: string;
  verifyTitle: string;
  passwordLabel: string;
  currentPasswordLabel: string;
  confirmPasswordLabel: string;
  submit: string;
  cancel: string;
  mismatch: string;
  wrongPassword: string;
  required: string;
  saveFailed: string;
}

interface NotePasswordDialogProps {
  mode: NotePasswordMode;
  labels: NotePasswordDialogLabels;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}

export function NotePasswordDialog({
  mode,
  labels,
  onSubmit,
  onClose,
}: NotePasswordDialogProps) {
  const headingId = useId();
  const errId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const title =
    mode === "set"
      ? labels.setTitle
      : mode === "remove"
        ? labels.removeTitle
        : labels.verifyTitle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError(labels.required);
      return;
    }
    if (mode === "set" && password !== confirm) {
      setError(labels.mismatch);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(password);
      onClose();
    } catch {
      // `verify` rejects only on a real password mismatch (NotesView
      // throws "wrong-password"), so that path keeps the mismatch
      // wording. `set`/`remove` reject only when the DataService write
      // itself failed — that is NOT a "password required" / "wrong
      // password" condition, so surface a dedicated save-failure message
      // instead of the misleading `required` text.
      setError(mode === "verify" ? labels.wrongPassword : labels.saveFailed);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="w-full max-w-sm rounded-lg border border-notion-border bg-notion-bg p-5 shadow-xl"
      >
        <h2
          id={headingId}
          className="mb-4 text-base font-semibold text-notion-text"
        >
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm text-notion-text-secondary">
            {mode === "verify" || mode === "remove"
              ? labels.currentPasswordLabel
              : labels.passwordLabel}
            <input
              ref={firstFieldRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "set" ? "new-password" : "current-password"
              }
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errId : undefined}
              className={`mt-1 w-full rounded-md border border-notion-border bg-notion-bg px-2 py-1.5 text-sm text-notion-text ${FOCUS_RING}`}
            />
          </label>

          {mode === "set" && (
            <label className="block text-sm text-notion-text-secondary">
              {labels.confirmPasswordLabel}
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!error || undefined}
                aria-describedby={error ? errId : undefined}
                className={`mt-1 w-full rounded-md border border-notion-border bg-notion-bg px-2 py-1.5 text-sm text-notion-text ${FOCUS_RING}`}
              />
            </label>
          )}

          {error && (
            <p id={errId} role="alert" className="text-sm text-notion-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={`rounded-md border border-notion-border px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover disabled:opacity-40 ${FOCUS_RING}`}
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className={`rounded-md bg-notion-accent px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-40 ${FOCUS_RING}`}
            >
              {labels.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
