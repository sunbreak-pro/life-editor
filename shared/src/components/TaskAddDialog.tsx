/*
 * TaskAddDialog (W-UX) — the "add a task / folder" overlay for the Kanban.
 * Pure presentation (§6.4): the host injects the folder options + already-
 * translated copy and receives the create intent via onSubmit; no DataService
 * / no useTranslation here.
 *
 * Built on the shared <Modal> so it is a small CENTERED overlay that dims (not
 * covers) the board behind it — the requested "faintly show the background"
 * pattern. A type toggle picks task vs folder; tasks may target a folder
 * (folders are created at the root). Enter submits (IME-guarded so Japanese
 * conversion is never stolen — §frontend gotcha).
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";
import { Modal } from "./Modal";

export type TaskAddType = "task" | "folder";

export interface TaskAddFolderOption {
  id: string;
  name: string;
}

export interface TaskAddDialogLabels {
  /** Dialog title. */
  title: string;
  typeTask: string;
  typeFolder: string;
  titleLabel: string;
  titlePlaceholder: string;
  folderLabel: string;
  /** "No folder / root" option in the folder select. */
  rootOption: string;
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
  /** Folders the new task can be filed under (root is always offered). */
  folders: TaskAddFolderOption[];
  labels: TaskAddDialogLabels;
}

export function TaskAddDialog({
  open,
  onClose,
  onSubmit,
  folders,
  labels,
}: TaskAddDialogProps): React.JSX.Element {
  const [type, setType] = useState<TaskAddType>("task");
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset to a clean form each time the dialog opens, then focus the title.
  useEffect(() => {
    if (!open) return;
    setType("task");
    setTitle("");
    setParentId(null);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      type,
      title: trimmed,
      // Folders live at the root; only tasks honor the folder target.
      parentId: type === "task" ? parentId : null,
    });
  };

  const TYPES: TaskAddType[] = ["task", "folder"];
  const typeLabel = (t: TaskAddType) =>
    t === "task" ? labels.typeTask : labels.typeFolder;

  return (
    <Modal open={open} onClose={onClose} title={labels.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        {/* Type toggle — task vs folder */}
        <div
          role="radiogroup"
          aria-label={labels.title}
          className="inline-flex gap-0.5 rounded-lg border border-ink-border bg-ink-bg-secondary p-0.5"
        >
          {TYPES.map((t) => {
            const selected = t === type;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
                  selected
                    ? "bg-ink-bg text-ink-text shadow-ink-sm"
                    : "text-ink-text-secondary hover:text-ink-text",
                )}
              >
                {typeLabel(t)}
              </button>
            );
          })}
        </div>

        {/* Title */}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-text-secondary">
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
              "w-full rounded-md border border-ink-border bg-ink-bg px-3 py-1.5 text-sm text-ink-text",
              "placeholder:text-ink-text-secondary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
            )}
          />
        </label>

        {/* Folder target — tasks only */}
        {type === "task" && (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-text-secondary">
              {labels.folderLabel}
            </span>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className={cn(
                "w-full rounded-md border border-ink-border bg-ink-bg px-3 py-1.5 text-sm text-ink-text",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
              )}
            >
              <option value="">{labels.rootOption}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-md border border-ink-border px-3 py-1.5 text-sm text-ink-text",
              "transition-colors hover:bg-ink-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
            )}
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "rounded-md bg-ink-accent px-3 py-1.5 text-sm text-ink-on-accent",
              "transition-opacity hover:opacity-90 disabled:opacity-40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-accent",
            )}
          >
            {labels.submit}
          </button>
        </div>
      </form>
    </Modal>
  );
}
