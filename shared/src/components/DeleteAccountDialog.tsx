import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

export interface DeleteAccountDialogProps {
  open: boolean;
  /** The signed-in address. Typing it back is what arms the button. */
  email: string;
  /** What the user has typed so far (controlled by the host). */
  value: string;
  onValueChange: (value: string) => void;
  /** Fires only when the typed address matches — the dialog checks first. */
  onConfirm: () => void;
  onCancel: () => void;
  /** Locks the whole dialog while the deletion is in flight. */
  busy?: boolean;
  /** Already-translated failure line, or null. */
  error?: string | null;
  /** Already-translated copy (CLAUDE.md §6.4: no useTranslation here). */
  labels: {
    title: string;
    /** One-line statement of what is about to happen. */
    body: string;
    /** Bullets naming what goes, e.g. todos / notes / schedule. */
    consequences: string[];
    /** "Type {{email}} to confirm" — already interpolated by the host. */
    typePrompt: string;
    inputLabel: string;
    confirm: string;
    busyLabel: string;
    cancel: string;
  };
}

/*
 * Account-deletion confirmation (#1200).
 *
 * Every other destructive action in the app answers to <ConfirmDialog>, and
 * this one deliberately does not: Trash restores a deleted item, and "reset
 * preferences" only clears this device. Deleting the account has nothing
 * behind it — the rows are gone from the database and the login stops
 * existing — so a single well-aimed tap must not be able to do it.
 *
 * The gate is typing the account's own address back. It is a better gate than
 * a second "are you sure" because it cannot be answered by reflex, and it
 * names the thing being destroyed while you type it. The confirm button is
 * disabled until the two match exactly (trimmed, case-insensitive — the
 * address is not case-sensitive and a phone keyboard will capitalise the
 * first letter on its own).
 *
 * Pure presentation: the host owns the typed value, the call and every
 * message. `busy` locks the dialog rather than closing it, so the user is
 * never left looking at Settings wondering whether it went through.
 */
export function DeleteAccountDialog({
  open,
  email,
  value,
  onValueChange,
  onConfirm,
  onCancel,
  busy = false,
  error = null,
  labels,
}: DeleteAccountDialogProps) {
  const matches =
    value.trim().toLowerCase() === email.trim().toLowerCase() &&
    email.trim() !== "";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={labels.title}
      titleIcon={
        <AlertTriangle size={18} className="shrink-0 text-lumen-danger" />
      }
      size="sm"
      // A stray click outside must not be the thing that dismisses a dialog
      // this deliberate — and while the delete is running there is nothing to
      // go back to anyway.
      closeOnBackdrop={false}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-lumen-text">{labels.body}</p>

        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-lumen-text-secondary">
          {labels.consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-lumen-text">
            {labels.typePrompt}
          </span>
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            disabled={busy}
            aria-label={labels.inputLabel}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-lumen-danger">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={!matches || busy}
          >
            {busy ? labels.busyLabel : labels.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
