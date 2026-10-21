import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  FileDown,
  FileStack,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pin,
  Trash2,
} from "lucide-react";
import { cn } from "../cn";
import { Menu, MenuItem } from "../Menu";
import { FOCUS_RING } from "../styleTokens";
import { isImeComposing } from "../../utils/imeGuard";

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
 * #1560 — the 44px touch floor for THIS menu's rows below `md`, where the
 * audit read them at 36.
 *
 * It rides on the four call sites rather than on `MenuItem`'s own recipe
 * because that part is also the Daily view's row menu, the "[[" item picker,
 * the "/" block menu and the Pomodoro todo picker — four surfaces in three
 * other lanes, and #1512 is being closed one section at a time.
 *
 * `min-h-*` rather than a taller `py-*`: the padding is what the Desktop rows
 * are measured by, and `cn` is a plain string join, so a second `py-*` would
 * be settled by Tailwind's emit order instead of by call order (#830). A
 * min-height collides with nothing.
 */
const MENU_ITEM_TAP_FLOOR = "max-md:min-h-11";

/*
 * #2058 — the CSS custom property the panel publishes on its root while the
 * header is sticky: the header's current height in px.
 *
 * Anything else in the body that sticks to the same scroller has to stop
 * BELOW the header instead of sliding under it. The table toolbar
 * (web/src/notes/TableControls.tsx) is that case: it was `top-0`, and with a
 * sticky header above it a stuck table toolbar would sit behind the title.
 * It reads `var(--note-sticky-header-h, 0px)`, so a host without the sticky
 * header (or any other RichTextEditor host) keeps the old 0.
 */
export const NOTE_STICKY_HEADER_HEIGHT_VAR = "--note-sticky-header-h";

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
  autoFocus = false,
  onAutoFocused,
}: {
  noteId: string;
  initialTitle: string;
  label: string;
  onCommit: (id: string, title: string) => void;
  /** "main" surface → big borderless heading matching the Daily date title. */
  isMain: boolean;
  /** Take the focus and select the whole name on mount (#1842). */
  autoFocus?: boolean;
  /** Fired once the focus has been taken, so the host can stop asking. */
  onAutoFocused?: () => void;
}) {
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
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

  /*
   * #1760 — re-seed the draft when the title changes from OUTSIDE this field.
   * The draft used to be seeded once per mount, so an undo of a rename rolled
   * the name back in the DB and in the sidebar while this input still showed
   * the name that had just been undone.
   *
   * Guarded on `pendingRef` rather than on a remount: a `key` that included
   * the title would steal focus mid-typing (see the note above this
   * component). While a local edit is waiting for its 300ms debounce the ref
   * holds it and the prop is still the pre-edit title, so re-seeding there
   * would delete what the user is typing. The ref is back to null the moment
   * the edit flushes — which is the state an undo arrives in, since the
   * rename has to have committed for there to be anything to undo.
   */
  useEffect(() => {
    if (pendingRef.current === null) setDraft(initialTitle);
  }, [initialTitle]);

  /*
   * #1842 — a note that has just been created opens with its name selected,
   * so the first keystroke replaces the placeholder title instead of appending to it.
   *
   * Mount only, and the empty dependency list is load-bearing twice over.
   * Re-running it on a later render would select the text under someone who
   * is typing, and the next keystroke would delete what they had written
   * (ItemActionPopover carries the same warning). And it must be a passive
   * effect, not a layout one: on narrow widths the create also closes the
   * drawer, whose own cleanup hands the focus back to the button that opened
   * it — a layout effect would run first and lose.
   */
  useEffect(() => {
    if (!autoFocus) return;
    const field = inputRef.current ?? areaRef.current;
    field?.focus();
    field?.select();
    onAutoFocused?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * #2291 — the compact field ("sidebar", which is what narrow renders) is a
   * textarea that grows to two lines. As a one-line input at 254px a long
   * title was cut off with no way to read the rest. A title is still one
   * line of text: Enter does not add a break (an Enter that commits an IME
   * conversion is left alone), and a pasted break becomes a space. Past two
   * lines the field scrolls inside its own box.
   *
   * The height follows the text: reset to `auto` so the field can shrink,
   * then set from scrollHeight plus the border, which scrollHeight leaves
   * out (border-box sizing). The max-height in the class caps it.
   */
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [draft]);

  const onChange = (value: string) => {
    setDraft(value);
    pendingRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, 300);
  };

  if (!isMain) {
    return (
      <textarea
        ref={areaRef}
        rows={1}
        value={draft}
        onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isImeComposing(e)) e.preventDefault();
        }}
        onBlur={flush}
        aria-label={label}
        className={cn(
          // #2227: the tags share this row, so the title keeps a floor of its
          // own and the tags wrap under it once both no longer fit.
          "min-w-40 flex-1 text-lumen-text",
          "block resize-none overflow-y-auto leading-snug",
          "max-h-[calc(2lh+0.75rem+2px)]",
          "rounded-lumen-md border border-lumen-border bg-lumen-bg px-2 py-1.5 text-sm font-medium",
          FOCUS_RING,
        )}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => onChange(e.target.value)}
      onBlur={flush}
      aria-label={label}
      className={cn(
        // #2227: the tags share this row, so the title keeps a floor of its
        // own and the tags wrap under it once both no longer fit.
        "min-w-40 flex-1 text-lumen-text",
        // "main" → borderless 28px bold heading (same size/font as the Daily
        // date title, 2026-07-19: the only visual difference between Notes and
        // Daily should be the tag/link affordances). The compact "sidebar"
        // field is the textarea above.
        //
        // `[--field-font-size:28px]` opts this one field out of the mobile font
        // floor (#1134 / styles/tokens.css). That floor exists to lift fields
        // ABOVE iOS's 16px auto-zoom trigger, and it resolves to the parent's
        // size when a field has no override — which would quietly flatten this
        // heading to body size on a phone. 28px is already well over the
        // trigger, so the override only has to repeat the size beside it.
        "border-none bg-transparent px-0 py-0.5 text-[28px] [--field-font-size:28px] font-bold leading-tight tracking-tight placeholder:text-lumen-text-tertiary",
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
  /** Open with the title focused and selected (#1842 — a fresh note). */
  autoFocusTitle?: boolean;
  /** Fired once that focus has been taken. */
  onTitleAutoFocused?: () => void;
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
  /**
   * Put a password on THIS note (#1843). Paired with `setPasswordLabel` on the
   * same all-or-nothing rule as the rows above. The host passes it only while
   * the note has no password, and `onRemovePassword` only while it has one, so
   * the menu never offers both.
   *
   * It opens the host's password dialog rather than acting on the press: the
   * dialog is where the "the body leaves the screen, and a forgotten password
   * cannot be recovered" warning is read before anything is written.
   */
  onSetPassword?: () => void;
  /** Already-translated label for the set-password menu entry. */
  setPasswordLabel?: string;
  /** Take the password off THIS note (#1843). Asks for the current one. */
  onRemovePassword?: () => void;
  /** Already-translated label for the remove-password menu entry. */
  removePasswordLabel?: string;
  /** Host-injected tag UI (e.g. the WikiTags TagPicker). Omitted → no tag row. */
  tagsSlot?: ReactNode;
  /**
   * Host-injected item-link UI, shown in the SAME row as `tagsSlot` and to its
   * right (#884). Tags and links are both "what this note is attached to", so
   * they read as one row rather than one header field and one sidebar panel.
   */
  linksSlot?: ReactNode;
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
  /**
   * Keep the header — title row, tag / link row and the rule under them —
   * pinned to the top of whatever scrolls this panel while the body scrolls
   * under it (#2058). Opt-in and independent of `variant`: the Notes host
   * asks for it at both widths (narrow renders the "sidebar" variant), while
   * any host that leaves it off gets the header exactly as before.
   */
  stickyHeader?: boolean;
  className?: string;
}

/*
 * #2058 — the sticky header's own box, per variant.
 *
 * The negative side margins + matching padding stretch the header's opaque
 * background across the card's padding, so a stuck header covers the body
 * edge to edge instead of leaving a strip of scrolled text visible beside it.
 * The small negative top margin + matching padding does the same upward: once
 * stuck, the title gets a few px of breathing room from the scroller's edge.
 * It is kept below the card's corner radius (main: 20px padding, -8px → 12px
 * from the inner edge vs a 12px radius; sidebar: 12px, -4px → 8px vs 8px), so
 * the square header never paints over the card's rounded top corners. Each
 * pair nets to zero, so at rest the layout is the pre-#2058 one.
 *
 * The background is the card's own opaque token (§5 — no transparency), so at
 * rest the header is indistinguishable from the card, and z-20 sits above the
 * body's own sticky table toolbar (z-10).
 */
const STICKY_HEADER_BOX = {
  main: "sticky top-0 z-20 -mx-5 -mt-2 bg-lumen-bg-secondary px-5 pt-2",
  sidebar: "sticky top-0 z-20 -mx-3 -mt-1 bg-lumen-bg-secondary px-3 pt-1",
} as const;

/** The nearest ancestor that scrolls vertically; null → the viewport. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

export function NoteDetailPanel({
  noteId,
  title,
  isPinned,
  onTitleCommit,
  onTogglePin,
  onDelete,
  titleLabel,
  autoFocusTitle = false,
  onTitleAutoFocused,
  pinLabel,
  unpinLabel,
  pinnedLabel,
  deleteLabel,
  moreActionsLabel,
  onRegisterTemplate,
  registerTemplateLabel,
  onApplyTemplate,
  applyTemplateLabel,
  onSetPassword,
  setPasswordLabel,
  onRemovePassword,
  removePasswordLabel,
  tagsSlot,
  linksSlot,
  contentEditor,
  variant = "sidebar",
  stickyHeader = false,
  className,
}: NoteDetailPanelProps) {
  const isMain = variant === "main";
  const hasTagRow = tagsSlot != null || linksSlot != null;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  /*
   * #2058 — publish the sticky header's height for the body's own sticky
   * parts (see NOTE_STICKY_HEADER_HEIGHT_VAR). Measured, not computed: the
   * header's height depends on how many lines the tag / link row wraps to.
   * Absent ResizeObserver (jsdom) the variable simply stays unset and the
   * readers fall back to 0.
   */
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);
  useEffect(() => {
    if (!stickyHeader) return;
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stickyHeader]);

  /*
   * #2291 — whether the header is stuck right now, so it can show where it
   * ends: at rest it is the card's own colour with a 1.13:1 rule under it, and
   * once the body slides beneath it the two read as one surface. A 1px
   * sentinel at the card's top is watched against whatever scrolls the panel;
   * once it has gone past that box's top edge, the header is pinned. Absent
   * IntersectionObserver (jsdom) the header simply never reports stuck.
   */
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (!stickyHeader) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = scrollParentOf(el);
    const observer = new IntersectionObserver(
      ([entry]) => {
        const top = entry.rootBounds?.top ?? 0;
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top);
      },
      { root },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stickyHeader]);

  const rootStyle =
    stickyHeader && headerHeight != null
      ? ({
          [NOTE_STICKY_HEADER_HEIGHT_VAR]: `${headerHeight}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        "flex flex-col border border-lumen-border",
        // The stuck-header sentinel below is positioned against the card.
        stickyHeader && "relative",
        isMain
          ? "gap-4 rounded-lumen-lg bg-lumen-bg-secondary p-5 shadow-lumen-sm"
          : "gap-3 rounded-lumen-md bg-lumen-bg-secondary p-3",
        className,
      )}
      style={rootStyle}
    >
      {stickyHeader && (
        <span
          ref={sentinelRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
        />
      )}
      {/* Header — the title and tag row and the rule under it, as one block so
          it can stick (#2058). Its gap repeats the card's, so with
          `stickyHeader` off the rows sit exactly where they did before the
          block existed. */}
      <div
        ref={headerRef}
        data-testid="note-detail-header"
        data-stuck={stuck ? "" : undefined}
        className={cn(
          "flex flex-col",
          isMain ? "gap-4" : "gap-3",
          stickyHeader && STICKY_HEADER_BOX[variant],
          // #2291: stuck, the header casts a shadow onto the body under it.
          stuck && "shadow-lumen-sm",
        )}
      >
        {/* Title row — title input, then the tags and item links (#884) on the
          same line (#2227: one row, so the stuck header takes less of the
          screen), then a single kebab (26px) that opens the actions menu (pin /
          delete) right-anchored just beneath it. Collapsing the per-action
          icons behind one affordance declutters the header (#284). The title
          and the tags wrap inside their own box, so many tags drop under the
          title while the kebab stays at the row's end. */}
        <div className="flex items-center gap-1.5">
          <div
            data-testid="note-detail-title-row"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5"
          >
            <NoteTitleInput
              key={noteId}
              noteId={noteId}
              initialTitle={title}
              label={titleLabel}
              onCommit={onTitleCommit}
              isMain={isMain}
              autoFocus={autoFocusTitle}
              onAutoFocused={onTitleAutoFocused}
            />
            {hasTagRow && (
              // #2291: below the breakpoint the tag / link row is one line of
              // its own under the title and does not wrap — the tag picker
              // scrolls its chips sideways instead (TagPicker `singleRow`),
              // which keeps the stuck header from growing a line per tag.
              <div className="flex flex-wrap items-center gap-1.5 max-md:w-full max-md:min-w-0 max-md:flex-nowrap">
                {tagsSlot}
                {linksSlot}
              </div>
            )}
          </div>
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
                // #1840: 26px draws at 32 with the icon-only floor, which is a
                // mouse target. The drawn box stays as it is and the HIT box
                // grows, so the header does not change shape on Desktop.
                "max-md:min-h-11 max-md:min-w-11",
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
                className={MENU_ITEM_TAP_FLOOR}
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
                  className={MENU_ITEM_TAP_FLOOR}
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
                  className={MENU_ITEM_TAP_FLOOR}
                  icon={<FileDown size={14} aria-hidden />}
                  onSelect={() => {
                    onApplyTemplate();
                    setMenuOpen(false);
                  }}
                >
                  {applyTemplateLabel}
                </MenuItem>
              )}
              {/* #1843 — the lock sits just above the delete: it changes who can
                read the body, which is heavier than the template rows and
                lighter than removing the note. Only one of the pair is ever
                passed, so the row reads as the one thing that can be done. */}
              {onSetPassword && setPasswordLabel && (
                <MenuItem
                  className={MENU_ITEM_TAP_FLOOR}
                  icon={<Lock size={14} aria-hidden />}
                  onSelect={() => {
                    onSetPassword();
                    setMenuOpen(false);
                  }}
                >
                  {setPasswordLabel}
                </MenuItem>
              )}
              {onRemovePassword && removePasswordLabel && (
                <MenuItem
                  className={MENU_ITEM_TAP_FLOOR}
                  icon={<LockOpen size={14} aria-hidden />}
                  onSelect={() => {
                    onRemovePassword();
                    setMenuOpen(false);
                  }}
                >
                  {removePasswordLabel}
                </MenuItem>
              )}
              <MenuItem
                className={MENU_ITEM_TAP_FLOOR}
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

        {/* One full-width rule between the header and the body (#2033), the
          same at both widths — it replaced the "内容" caption the mobile sheet
          used to show while Desktop had no break at all. Drawn only when the
          row carries tags or links: without them, the rule would hang under
          the bare title. Inside the header block, so a stuck header ends on this
          line and the body visibly slides under it (#2058). */}
        {contentEditor != null && hasTagRow && (
          <hr
            data-testid="note-detail-divider"
            className={cn(
              "m-0 border-0 border-t",
              // #2291: the stronger line while the body slides under it.
              stuck ? "border-lumen-border-strong" : "border-lumen-border",
            )}
          />
        )}
      </div>

      {/* Content — injected editor + a min-height floor via the wrapper. */}
      {contentEditor != null && (
        <div
          className={cn(
            "flex flex-col",
            isMain
              ? "[&_.note-editor]:min-h-[420px]"
              : "[&_.note-editor]:min-h-[220px]",
          )}
        >
          {contentEditor}
        </div>
      )}
    </div>
  );
}
