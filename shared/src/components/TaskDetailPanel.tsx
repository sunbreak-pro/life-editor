import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TaskStatus } from "../types/taskTree";
import { cn } from "./cn";

/*
 * Task detail panel (W7). The right-hand pane the Tasks MasterDetail shows
 * for the selected task. Pure presentation, DataService-free (§3.1): every
 * mutation is a callback the host injects (onTitleCommit / onToggleStatus),
 * the rich-text editor is injected as `contentEditor` (TipTap is a web
 * dependency and must not be pulled into shared), and all copy arrives as
 * already-translated props (§6.4 — no useTranslation here). lumen-* tokens
 * only; the panel container is opaque (§5).
 *
 * Minimal scope (W7): title edit, status toggle, content edit. Heavier task
 * fields (priority / schedule / reminders / tags) are out of scope.
 */

// Status cue glyph — symbols, not copy, so they stay in the component
// (mirrors web TaskTreeView's STATUS_GLYPH). The textual label is injected.
const STATUS_GLYPH: Record<TaskStatus, string> = {
  NOT_STARTED: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";

/*
 * Title field. Mirrors NotesView's NoteTitleInput debounce-and-flush
 * exactly: a local draft, a 300ms debounced persist, an immediate flush on
 * blur, and a final flush on unmount. The parent remounts this via
 * `key={taskId}` so a task switch re-seeds the draft cleanly. The key
 * intentionally excludes the title text: keying on it would remount
 * mid-typing (the debounced persist mutates the task's title) and steal
 * focus — single-user app, no external-rename re-seed needed.
 */
function TaskTitleInput({
  taskId,
  initialTitle,
  label,
  onCommit,
}: {
  taskId: string;
  initialTitle: string;
  label: string;
  onCommit: (id: string, title: string) => void;
}) {
  const [draft, setDraft] = useState(initialTitle);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<string | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      onCommitRef.current(taskId, pendingRef.current);
      pendingRef.current = null;
    }
  };

  useEffect(() => {
    // flush only touches refs (stable for this component lifetime), so an
    // empty dep array is correct — same as NoteTitleInput / RichTextEditor.
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      value={draft}
      onChange={(e) => {
        const value = e.target.value;
        setDraft(value);
        pendingRef.current = value;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, 300);
      }}
      onBlur={flush}
      aria-label={label}
      className={cn(
        "w-full rounded-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium text-lumen-text",
        FOCUS_RING,
      )}
    />
  );
}

export interface TaskDetailPanelProps {
  /** Selected node id — also keys the internal title field for remount. */
  taskId: string;
  /** Current title (seed for the debounced draft). */
  title: string;
  /** Current status. */
  status?: TaskStatus;
  /** Persist a title edit (host injects DataService write — §3.1). */
  onTitleCommit: (id: string, title: string) => void;
  /** Cycle the task status (host injects the toggle). */
  onToggleStatus?: (id: string) => void;
  /** Injected rich-text editor (host wires key={taskId} for remount). */
  contentEditor?: ReactNode;
  /** Already-translated aria-label for the title input (§6.4). */
  titleLabel: string;
  /** Already-translated caption preceding the status control. */
  statusLabel: string;
  /** Already-translated label for the current status value. */
  statusText?: string;
  /** Already-translated caption above the content editor. */
  contentLabel?: string;
  /** Already-translated caption preceding the tag row (§6.4). Paired with
   *  `tagsSlot`; when either is absent the tag row is omitted. */
  tagsLabel?: string;
  /** Host-injected tag chips (e.g. the task's assigned WikiTags). Additive —
   *  existing callers that omit it keep the original title/status/content
   *  layout unchanged. Rendered between the status row and the content editor. */
  tagsSlot?: ReactNode;
  className?: string;
}

export function TaskDetailPanel({
  taskId,
  title,
  status,
  onTitleCommit,
  onToggleStatus,
  contentEditor,
  titleLabel,
  statusLabel,
  statusText,
  contentLabel,
  tagsLabel,
  tagsSlot,
  className,
}: TaskDetailPanelProps) {
  const resolvedStatus = status ?? "NOT_STARTED";
  return (
    <div
      className={cn(
        "space-y-3 rounded-md border border-lumen-border bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      <TaskTitleInput
        key={taskId}
        taskId={taskId}
        initialTitle={title}
        label={titleLabel}
        onCommit={onTitleCommit}
      />

      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
          {statusLabel}
        </span>
        <button
          type="button"
          onClick={() => onToggleStatus?.(taskId)}
          aria-label={statusLabel}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-lumen-border px-2 py-1 text-sm text-lumen-text hover:bg-lumen-hover",
            FOCUS_RING,
          )}
        >
          <span aria-hidden className="text-lumen-text-secondary">
            {STATUS_GLYPH[resolvedStatus]}
          </span>
          <span>{statusText}</span>
        </button>
      </div>

      {tagsSlot != null && (
        <div className="flex items-center gap-2">
          {tagsLabel && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
              {tagsLabel}
            </span>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tagsSlot}
          </div>
        </div>
      )}

      {contentEditor && (
        <div className="space-y-1">
          {contentLabel && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-secondary">
              {contentLabel}
            </span>
          )}
          {contentEditor}
        </div>
      )}
    </div>
  );
}
