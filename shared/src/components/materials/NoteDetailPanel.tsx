import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileDown, FileStack, MoreHorizontal, Pin, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { Menu, MenuItem } from "../Menu";
import { FOCUS_RING } from "../styleTokens";

/*
 * Note detail panel (Materials mini-plan Step 3). The right-hand pane the
 * Notes tab pushes into the shared rightSidebar (Desktop only) for the
 * selected note. Pure presentation, DataService-free (§3.1): every mutation
 * is a host-injected callback (onTitleCommit / onTogglePin / onDelete), the
 * rich-text editor + tag UI arrive as ReactNode slots (TipTap / WikiTags are
 * web dependencies and must not be pulled into shared), and all
 * copy is already-translated props (§6.4 — no useTranslation here). lumen-*
 * tokens only; the card surface is opaque (§5).
 *
 * The lock / password gate is the host's concern — it wraps the injected
 * `contentEditor` with its own blur-and-unlock overlay before passing it in,
 * so this panel simply renders whatever content node it receives.
 */

/*
 * Title field. Mirrors NoteTitleInput / TodoTitleInput debounce-and-flush
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
  isMain,
}: {
  noteId: string;
  initialTitle: string;
  label: string;
  onCommit: (id: string, title: string) => void;
  /** "main" surface → big borderless heading matching the Daily date title. */
  isMain: boolean;
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
        "min-w-0 flex-1 text-lumen-text",
        // "main" → borderless 28px bold heading (same size/font as the Daily
        // date title, 2026-07-19: the only visual difference between Notes and
        // Daily should be the tag/link affordances). Compact "sidebar" keeps the
        // bordered small input.
        //
        // `[--field-font-size:28px]` opts this one field out of the mobile font
        // floor (#1134 / styles/tokens.css). That floor exists to lift fields
        // ABOVE iOS's 16px auto-zoom trigger, and it resolves to the parent's
        // size when a field has no override — which would quietly flatten this
        // heading to body size on a phone. 28px is already well over the
        // trigger, so the override only has to repeat the size beside it.
        isMain
          ? "border-none bg-transparent px-0 py-0.5 text-[28px] [--field-font-size:28px] font-bold leading-tight tracking-tight placeholder:text-lumen-text-tertiary"
          : "rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium",
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
  /**
   * Already-translated name of the "this note is pinned" marker shown left of
   * the kebab (#885). Omitted → the marker is drawn without an accessible name
   * (decorative), never dropped: the state has to be visible either way.
   */
  pinnedLabel?: string;
  /** Already-translated aria-label for the delete button. */
  deleteLabel: string;
  /** Already-translated aria-label for the kebab (more-actions) trigger. */
  moreActionsLabel: string;
  /**
   * Register THIS note as a template (#1179). Paired with
   * `registerTemplateLabel` — the item is drawn only when both are given, like
   * every other optional row here, so a host cannot ship a menu entry with no
   * name for it.
   *
   * It replaced the entry that opened an empty template workshop (#1047). The
   * template someone wants is nearly always the note already in front of them,
   * and re-typing it into a second surface was the whole cost of the old
   * route; the confirmation panel is where the name gets adjusted afterwards.
   *
   * It lives in the kebab rather than beside the "+" that makes notes because
   * registering is something done TO the open note, not another kind of note
   * to create.
   */
  onRegisterTemplate?: () => void;
  /** Already-translated label for the register-as-template menu entry. */
  registerTemplateLabel?: string;
  /**
   * Pour a saved template into THIS note (#1181) — the other direction from
   * the entry above, and the one that was missing. Paired with
   * `applyTemplateLabel` on the same all-or-nothing rule as every optional row
   * here.
   *
   * It opens a picker + confirm rather than acting on the press: applying
   * replaces the note's body.
   */
  onApplyTemplate?: () => void;
  /** Already-translated label for the apply-a-template menu entry. */
  applyTemplateLabel?: string;
  /** Host-injected tag UI (e.g. the WikiTags TagPicker). Omitted → no tag row. */
  tagsSlot?: ReactNode;
  /**
   * Host-injected item-link UI, shown in the SAME row as `tagsSlot` and to its
   * right (#884). Tags and links are both "what this note is attached to", so
   * they read as one row rather than one header field and one sidebar panel.
   */
  linksSlot?: ReactNode;
  /** Already-translated caption above the content editor. */
  contentLabel: string;
  /** Host-injected rich-text editor (host wires key={noteId} for remount). */
  contentEditor?: ReactNode;
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
  pinnedLabel,
  deleteLabel,
  moreActionsLabel,
  onRegisterTemplate,
  registerTemplateLabel,
  onApplyTemplate,
  applyTemplateLabel,
  tagsSlot,
  linksSlot,
  contentLabel,
  contentEditor,
  variant = "sidebar",
  className,
}: NoteDetailPanelProps) {
  const isMain = variant === "main";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={cn(
        "flex flex-col border border-lumen-border",
        isMain
          ? "gap-4 rounded-lumen-lg bg-lumen-bg-secondary p-5 shadow-lumen-sm"
          : "gap-3 rounded-lumen-md bg-lumen-bg-secondary p-3",
        className,
      )}
    >
      {/* Title row — title input + a single kebab (26px) that opens the actions
          menu (pin / delete) right-anchored just beneath it. Collapsing the
          per-action icons behind one affordance declutters the header (#284). */}
      <div className="flex items-center gap-1.5">
        <NoteTitleInput
          key={noteId}
          noteId={noteId}
          initialTitle={title}
          label={titleLabel}
          onCommit={onTitleCommit}
          isMain={isMain}
        />
        {/* Pinned marker (#885) — immediately left of the kebab, so the state
            reads at a glance instead of only inside the opened menu. Not a
            button: unpinning stays the menu's job, and a second control on the
            same act would be two ways to do one thing. Same place at both
            widths, because both host this panel. */}
        {isPinned && (
          <Pin
            size={14}
            {...(pinnedLabel
              ? { role: "img", "aria-label": pinnedLabel }
              : { "aria-hidden": true })}
            className="shrink-0 fill-current text-lumen-accent"
          />
        )}
        <div className="relative shrink-0">
          <button
            ref={menuTriggerRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={moreActionsLabel}
            className={cn(
              "grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lumen-md text-lumen-text-secondary",
              "hover:bg-lumen-hover hover:text-lumen-text",
              FOCUS_RING,
            )}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
          <Menu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={menuTriggerRef}
            align="end"
            label={moreActionsLabel}
          >
            <MenuItem
              icon={<Pin size={14} aria-hidden />}
              onSelect={() => {
                onTogglePin(noteId);
                setMenuOpen(false);
              }}
            >
              {isPinned ? pinLabel : unpinLabel}
            </MenuItem>
            {/* #1179 — above the delete, below the pin: it files a COPY of
                this note somewhere else rather than changing or destroying it,
                so it does not belong next to the destructive row. */}
            {onRegisterTemplate && registerTemplateLabel && (
              <MenuItem
                icon={<FileStack size={14} aria-hidden />}
                onSelect={() => {
                  onRegisterTemplate();
                  setMenuOpen(false);
                }}
              >
                {registerTemplateLabel}
              </MenuItem>
            )}
            {/* #1181 — directly under the entry that files a template, because
                the two are the same subject read in opposite directions. It
                stays above the delete: applying is destructive to the BODY,
                not to the note, and grouping it with the row that removes the
                note would overstate it. */}
            {onApplyTemplate && applyTemplateLabel && (
              <MenuItem
                icon={<FileDown size={14} aria-hidden />}
                onSelect={() => {
                  onApplyTemplate();
                  setMenuOpen(false);
                }}
              >
                {applyTemplateLabel}
              </MenuItem>
            )}
            <MenuItem
              icon={<Trash2 size={14} aria-hidden />}
              variant="danger"
              onSelect={() => {
                onDelete(noteId);
                setMenuOpen(false);
              }}
            >
              {deleteLabel}
            </MenuItem>
          </Menu>
        </div>
      </div>

      {/* Tag row — host-injected TagPicker (chips + "+ tag" pill), followed by
          the item links (#884): same row, links to the right of the tags. */}
      {(tagsSlot != null || linksSlot != null) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tagsSlot}
          {linksSlot}
        </div>
      )}

      {/* Content — injected editor + a min-height floor via the wrapper. The
          "main" surface (Notes tab body) drops the caption and lets the editor
          sit flush in the card, matching the Daily editor's clean single-card
          look (2026-07-18). The compact "sidebar" variant keeps the "内容"
          caption for orientation. */}
      {contentEditor != null && (
        <div
          className={cn(
            "flex flex-col gap-1",
            isMain
              ? "[&_.note-editor]:min-h-[420px]"
              : "[&_.note-editor]:min-h-[220px]",
          )}
        >
          {!isMain && (
            <span className="text-xs uppercase tracking-wide text-lumen-text-tertiary">
              {contentLabel}
            </span>
          )}
          {contentEditor}
        </div>
      )}
    </div>
  );
}
