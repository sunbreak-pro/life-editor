/*
 * TaskAddDialog (W-UX) — the "add a task" overlay for the Kanban. Pure
 * presentation (§6.4): the host injects already-translated copy and receives
 * the create intent via onSubmit; no DataService / no useTranslation here.
 *
 * Built on the shared <Modal> so it is a small CENTERED overlay that dims (not
 * covers) the board behind it — the requested "faintly show the background"
 * pattern. Enter submits (IME-guarded so Japanese conversion is never stolen —
 * §frontend gotcha).
 *
 * life-tags S1: folders no longer group tasks, so the task/folder type toggle
 * and the "file under folder" select were retired — this dialog now only
 * captures a task title (organizing is done via tags).
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Modal } from "./Modal";

/** The dialog only creates tasks now (folders retired — life-tags S1). */
export type TaskAddType = "task";

export interface TaskAddDialogLabels {
  /** Dialog title. */
  title: string;
  titleLabel: string;
  titlePlaceholder: string;
  submit: string;
  cancel: string;
}

export interface TaskAddDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: TaskAddType;
    title: string;
    parentId: string | null;
  }) => void;
  labels: TaskAddDialogLabels;
}

export function TaskAddDialog({
  open,
  onClose,
  onSubmit,
  labels,
}: TaskAddDialogProps): React.JSX.Element {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset to a clean form each time the dialog opens, then focus the title.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ type: "task", title: trimmed, parentId: null });
  };

  return (
    <Modal open={open} onClose={onClose} title={labels.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {/* Title */}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-lumen-text-secondary">
            {labels.titleLabel}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={title}
            placeholder={labels.titlePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Never submit mid-IME-composition (§frontend gotcha).
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className={cn(
              "w-full rounded-md border border-lumen-border bg-lumen-bg px-3 py-1.5 text-sm text-lumen-text",
              "placeholder:text-lumen-text-secondary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          />
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-md border border-lumen-border px-3 py-1.5 text-sm text-lumen-text",
              "transition-colors hover:bg-lumen-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "rounded-md bg-lumen-accent px-3 py-1.5 text-sm text-lumen-on-accent",
              "transition-opacity hover:opacity-90 disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            )}
          >
            {labels.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
