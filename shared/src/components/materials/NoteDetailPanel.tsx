import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pin, Trash2 } from "lucide-react";
import { cn } from "../cn";

/*
 * Note detail panel (Materials mini-plan Step 3). The right-hand pane the
 * Notes tab pushes into the shared rightSidebar (Desktop only) for the
 * selected note. Pure presentation, DataService-free (§3.1): every mutation
 * is a host-injected callback (onTitleCommit / onTogglePin / onDelete), the
 * rich-text editor + tag UI + link list arrive as ReactNode slots (TipTap /
 * WikiTags are web dependencies and must not be pulled into shared), and all
 * copy is already-translated props (§6.4 — no useTranslation here). lumen-*
 * tokens only; the card surface is opaque (§5).
 *
 * The lock / password gate is the host's concern — it wraps the injected
 * `contentEditor` with its own blur-and-unlock overlay before passing it in,
 * so this panel simply renders whatever content node it receives.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent focus-visible:ring-offset-2 focus-visible:ring-offset-lumen-bg";

/*
 * Title field. Mirrors NoteTitleInput / TaskTitleInput debounce-and-flush
 * exactly: a local draft, a 300ms debounced persist, an immediate flush on
 * blur, and a final flush on unmount. The parent remounts this via
 * `key={noteId}` so a note switch re-seeds the draft cleanly. The key
 * intentionally excludes the title text: keying on it would remount
 * mid-typing (the debounced persist mutates the note's title) and steal
 * focus — single-user app, no external-rename re-seed needed.
 */
function NoteTitleInput({
  noteId,
  initialTitle,
  label,
  onCommit,
}: {
  noteId: string;
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
      onCommitRef.current(noteId, pendingRef.current);
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
        "min-w-0 flex-1 rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium text-lumen-text",
        FOCUS_RING,
      )}
    />
  );
}

export interface NoteDetailPanelProps {
  /** Selected note id — also keys the internal title field for remount. */
  noteId: string;
  /** Current title (seed for the debounced draft). */
  title: string;
  /** Pin state — drives the pin toggle's aria-pressed + accent fill. */
  isPinned: boolean;
  /** Persist a title edit (host injects the DataService write — §3.1). */
  onTitleCommit: (id: string, title: string) => void;
  /** Toggle the note's pin (host injects the mutation). */
  onTogglePin: (id: string) => void;
  /** Soft-delete the note (host injects the mutation). */
  onDelete: (id: string) => void;
  /** Already-translated aria-label for the title input (§6.4). */
  titleLabel: string;
  /** Already-translated aria-label for the pin toggle when pinned. */
  pinLabel: string;
  /** Already-translated aria-label for the pin toggle when unpinned. */
  unpinLabel: string;
  /** Already-translated aria-label for the delete button. */
  deleteLabel: string;
  /** Host-injected tag UI (e.g. the WikiTags TagPicker). Omitted → no tag row. */
  tagsSlot?: ReactNode;
  /** Already-translated caption above the content editor. */
  contentLabel: string;
  /** Host-injected rich-text editor (host wires key={noteId} for remount). */
  contentEditor?: ReactNode;
  /** Already-translated caption above the links list. */
  linksLabel: string;
  /** Host-injected link list. Omitted → the links section is hidden. */
  linksSlot?: ReactNode;
  /**
   * Surface treatment. "sidebar" (default) is the compact card the Notes tab
   * pushes into the rightSidebar. "main" is the larger centered editor surface
   * (opaque lumen-surface, roomier padding, taller content floor) used when the
   * detail is the tab's main content. Additive — omitting it keeps the original
   * sidebar look, so existing callers are unaffected.
   */
  variant?: "sidebar" | "main";
  className?: string;
}

export function NoteDetailPanel({
  noteId,
  title,
  isPinned,
  onTitleCommit,
  onTogglePin,
  onDelete,
  titleLabel,
  pinLabel,
  unpinLabel,
  deleteLabel,
  tagsSlot,
  contentLabel,
  contentEditor,
  linksLabel,
  linksSlot,
  variant = "sidebar",
  className,
}: NoteDetailPanelProps) {
  const isMain = variant === "main";
  return (
    <div
      className={cn(
        "flex flex-col border border-lumen-border",
        isMain
          ? "gap-4 rounded-lumen-lg bg-lumen-surface p-5 shadow-lumen-sm"
          : "gap-3 rounded-lumen-md bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      {/* Title row — title input + pin toggle (26px, accent-subtle when
          pinned) + delete. */}
      <div className="flex items-center gap-1.5">
        <NoteTitleInput
          key={noteId}
          noteId={noteId}
          initialTitle={title}
          label={titleLabel}
          onCommit={onTitleCommit}
        />
        <button
          type="button"
          onClick={() => onTogglePin(noteId)}
          aria-pressed={isPinned}
          aria-label={isPinned ? pinLabel : unpinLabel}
          className={cn(
            "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lumen-md",
            isPinned
              ? "bg-lumen-accent-subtle text-lumen-accent"
              : "text-lumen-text-secondary hover:bg-lumen-hover hover:text-lumen-text",
            FOCUS_RING,
          )}
        >
          <Pin size={13} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(noteId)}
          aria-label={deleteLabel}
          className={cn(
            "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lumen-md text-lumen-text-secondary",
            "hover:bg-lumen-hover hover:text-lumen-danger",
            FOCUS_RING,
          )}
        >
          <Trash2 size={13} aria-hidden />
        </button>
      </div>

      {/* Tag row — host-injected TagPicker (chips + "+ tag" pill). */}
      {tagsSlot != null && (
        <div className="flex flex-wrap items-center gap-1.5">{tagsSlot}</div>
      )}

      {/* Content — "内容" caption + injected editor. The editor supplies its
          own bordered box (§: NotesView RichTextEditor), so this section adds
          only the caption + a min-height floor via the wrapper — no competing
          border/surface (avoids a double frame). */}
      {contentEditor != null && (
        <div
          className={cn(
            "flex flex-col gap-1",
            isMain
              ? "[&_.note-editor]:min-h-[420px]"
              : "[&_.note-editor]:min-h-[220px]",
          )}
        >
          <span className="text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
            {contentLabel}
          </span>
          {contentEditor}
        </div>
      )}

      {/* Links — "リンク" caption + injected link list. */}
      {linksSlot != null && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-lumen-text-tertiary">
            {linksLabel}
          </span>
          {linksSlot}
        </div>
      )}
    </div>
  );
}
