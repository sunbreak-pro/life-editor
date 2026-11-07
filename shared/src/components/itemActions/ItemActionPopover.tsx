import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { cn } from "../cn";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";
import { clampToViewport, useFloatingDismiss } from "./floating";
import { TimeRangeField } from "../TimeRangeField";
import { isImeComposing } from "../../utils/imeGuard";
import { hasOpenDialogLayer } from "../../hooks/useDialogA11y";

/*
 * ItemActionPopover (Issue #307) — the generic click bubble for an item.
 * A fixed-positioned portal at the click point (viewport-clamped, Escape +
 * outside-mousedown close) showing: a host-rendered `summary` (title + meta),
 * a declarative list of quick `actions`, and a primary "edit detail" button
 * that hands off to the detail overlay.
 *
 * Consumer: Schedule (#299 single-click summary + "詳細を編集"; #551 unified
 * it with the right-click path and retired the separate ItemContextMenu, so
 * the inline-input swap that menu owned lives here now: selecting an action
 * with `inlineInput` (e.g. rename) replaces the action list with a seeded
 * text input — Enter commits, Escape cancels, IME-safe. The edit-detail
 * button hides while the input is up so Enter has exactly one meaning.
 *
 * Pure presentation (§3.1/§6.4): no DataService, no useTranslation; `summary`
 * and every label arrive already translated. lumen-* tokens only; opaque (§5).
 *
 * #2222: a host can make the summary itself editable (`quickEdit`). The
 * summary then answers a double-click — or Enter while it has focus, so the
 * keyboard keeps a way in — by turning into a small form for the title and,
 * when the host passes them, the date and the time. Enter or the save button
 * commits, Escape backs out to the summary. Blur keeps the draft, the same
 * rule the detail editor follows (D-20260810-sched-1). This replaces the
 * schedule bubble's "Rename" / "Edit time" rows: the fields sit where the
 * values are printed instead of behind a row named after them.
 *
 * @example
 * <ItemActionPopover
 *   position={{ x, y }}
 *   summary={<><p className="font-semibold">{item.title}</p><p>{when}</p></>}
 *   actions={[
 *     { id: "rename", label: t("rename"),
 *       inlineInput: { value: title, ariaLabel: t("rename"), onCommit: rename } },
 *     { id: "duplicate", label: t("duplicate"), onSelect: dup },
 *   ]}
 *   onEditDetail={openOverlay}
 *   editDetailLabel={t("editDetail")}
 *   onClose={close}
 * />
 */

const DEFAULT_WIDTH = 248;
const EDGE_GAP = 8;
// First-paint estimates only. The real height is measured right after mount
// and takes over from there (#826): the panel's height is set by however many
// `actions` the host passes, so no constant can be right for every caller —
// the old fixed 220 left an event's "edit detail" button off-screen below
// 19:00 in week view. These just keep the first frame near its final spot.
const EST_HEIGHT = 220;
// The inline input replaces the action list AND the edit-detail button, so
// the panel is much shorter — clamping with the full estimate would push it
// needlessly far up from the bottom edge.
const EST_HEIGHT_INLINE = 120;

/**
 * The values the in-place form edits (#2222). Which keys are present decides
 * which fields show: `date` adds a date field, `start` + `end` a time range,
 * `start` alone a single start time. `title` is always there.
 */
export interface ItemQuickEditValue {
  title: string;
  date?: string;
  start?: string;
  end?: string;
}

export interface ItemQuickEdit {
  value: ItemQuickEditValue;
  /** Already-translated copy. `hint` is shown on hover and read with focus. */
  labels: {
    hint: string;
    title: string;
    date: string;
    start: string;
    end: string;
    save: string;
    cancel: string;
  };
  formatDuration?: (minutes: number) => string;
  /**
   * Called once, on save, and only when something changed. A cleared title
   * comes back as the old one — an empty name is not a rename.
   */
  onCommit: (next: ItemQuickEditValue) => void;
}

export interface ItemActionPopoverProps {
  /** Anchor point in viewport coordinates (from the click event). */
  position: { x: number; y: number };
  /** Host-rendered summary block (title + meta). Already-translated content. */
  summary: ReactNode;
  actions?: ItemAction[];
  /** Primary hand-off to the detail overlay. */
  onEditDetail?: () => void;
  /** Already-translated label for the edit-detail button. */
  editDetailLabel?: string;
  onClose: () => void;
  /** Already-translated a11y label for the popover. */
  label?: string;
  /** Popover width in px (default 248). */
  width?: number;
  /**
   * How the three blocks are arranged (#1625). "stack" (default) puts summary,
   * actions and the edit-detail button in one column — what the tour and every
   * other caller keep. "columns" puts the summary on the left and the actions
   * on the right, with the edit-detail button across both underneath (#2564),
   * so a wide panel spends its width instead of its height. A prop rather
   * than a className override because
   * `cn` is a plain join, not tailwind-merge (rules/frontend.md §Gotchas).
   */
  layout?: "stack" | "columns";
  /**
   * Move focus into the panel when it opens (#2049) — its first action, or the
   * edit-detail button when there are none. For a panel opened from the
   * keyboard: one that opens without it leaves focus on whatever opened it,
   * which may already be gone (the month cell's "他 N 件" panel closes as it
   * hands over). Off by default, so a mouse-opened bubble behaves as before.
   */
  autoFocus?: boolean;
  /** #2222: makes the summary editable in place. See the file comment. */
  quickEdit?: ItemQuickEdit;
  /**
   * The summary opens Modals of its own (#2395: TagIconPicker's panel of every
   * icon, and the host's question before a delete). Two things then have to
   * change, and both are this one fact: the panel sits under the Modal (z-40
   * against the Modal's z-50, where the default z-[60] would draw it on top of
   * its own child), and a press in that Modal is not "outside". The Modal portals
   * to <body>, so without this the press that picks an icon would close the panel
   * and the picker with it.
   */
  hostsDialogs?: boolean;
}

const FIELD =
  "w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-xs text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent";

function sameValue(a: ItemQuickEditValue, b: ItemQuickEditValue): boolean {
  return (
    a.title === b.title &&
    a.date === b.date &&
    a.start === b.start &&
    a.end === b.end
  );
}

export function ItemActionPopover({
  position,
  summary,
  actions,
  onEditDetail,
  editDetailLabel,
  onClose,
  label,
  width = DEFAULT_WIDTH,
  layout = "stack",
  autoFocus = false,
  quickEdit,
  hostsDialogs = false,
}: ItemActionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // #2222: the in-place form's draft; null while the summary is showing.
  const [editDraft, setEditDraft] = useState<ItemQuickEditValue | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  /*
   * Read when the press or the key STARTS, not when it reaches the dismiss
   * listener. A press on a Modal's backdrop closes that Modal from <body>, and
   * the browser commits the close in the microtask before the event goes on to
   * document, so a read there finds no layer and takes this panel down with the
   * Modal it only meant to close.
   */
  const dialogOpenAtEventStart = useRef(false);
  useEffect(() => {
    if (!hostsDialogs) return;
    const note = () => {
      dialogOpenAtEventStart.current = hasOpenDialogLayer();
    };
    document.addEventListener("mousedown", note, true);
    document.addEventListener("keydown", note, true);
    return () => {
      document.removeEventListener("mousedown", note, true);
      document.removeEventListener("keydown", note, true);
    };
  }, [hostsDialogs]);
  const dismiss = useCallback(() => {
    if (hostsDialogs && dialogOpenAtEventStart.current) return;
    onClose();
  }, [hostsDialogs, onClose]);
  useFloatingDismiss(panelRef, dismiss);
  const editing = editDraft != null;

  const inlineAction =
    inlineId != null
      ? (actions?.find(
          (a) => a.id === inlineId && (a.inlineInput || a.inlineTimeRange),
        ) ?? null)
      : null;

  // Focus + select the input when entering inline mode. Keyed on the id, not
  // the action object: hosts rebuild `actions` every render (CalendarTab
  // re-renders on its 1-minute now ticker), and re-selecting the text mid-type
  // would let the next keystroke wipe the draft.
  useLayoutEffect(() => {
    if (inlineId != null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [inlineId]);

  // Same reason as above: keyed on entering the form, not on the draft.
  useLayoutEffect(() => {
    if (editing) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [editing]);

  // #2049: once, on open. Hosts rebuild `actions` every render, so keying this
  // on them would pull focus back to the top mid-navigation. The action rows
  // are looked for first: the summary can hold buttons of its own (#2395's
  // icon picker), and landing on one of those would skip the whole list.
  useLayoutEffect(() => {
    if (!autoFocus) return;
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])') ??
      panel?.querySelector<HTMLElement>("button:not([disabled])")
    )?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-time only
  }, []);

  // Measure the panel we just drew and re-clamp with the real number, before
  // the browser paints. Re-runs on the two things that change the height — the
  // host's `actions` and the inline-input swap — plus its own result, so a
  // measurement that shifts the panel gets checked again. Writing state only
  // on an actual change is what stops this from looping (a capped panel
  // measures its cap, which re-derives the same cap).
  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight;
    if (height != null && height !== measuredHeight) setMeasuredHeight(height);
  }, [measuredHeight, actions, inlineAction, editing]);

  const { top, left, maxHeight } = clampToViewport(
    position,
    width,
    measuredHeight ?? (inlineAction ? EST_HEIGHT_INLINE : EST_HEIGHT),
    EDGE_GAP,
  );

  const commitInline = () => {
    if (!inlineAction?.inlineInput) return;
    const trimmed = draft.trim();
    if (trimmed) inlineAction.inlineInput.onCommit(trimmed);
    onClose();
  };

  const activate = (action: ItemAction) => {
    if (action.inlineInput || action.inlineTimeRange) {
      setDraft(action.inlineInput?.value ?? "");
      setInlineId(action.id);
      return;
    }
    action.onSelect?.();
    onClose();
  };

  const startQuickEdit = () => {
    if (quickEdit) setEditDraft({ ...quickEdit.value });
  };

  const commitQuickEdit = () => {
    if (!quickEdit || !editDraft) return;
    const next = {
      ...editDraft,
      title: editDraft.title.trim() || quickEdit.value.title,
    };
    if (!sameValue(next, quickEdit.value)) quickEdit.onCommit(next);
    onClose();
  };

  // Enter / Escape for the whole form. A field that already handled the key
  // marks it (the time combo does, to close its own list), and that press is
  // left alone so one Enter does not both pick a time and save.
  const handleQuickEditKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isImeComposing(e) || e.defaultPrevented) return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      commitQuickEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Keeps the document-level Escape from closing the whole panel: this
      // press only backs out of the form.
      e.stopPropagation();
      setEditDraft(null);
    }
  };

  const columns = layout === "columns";

  const quickEditForm =
    quickEdit && editDraft ? (
      <div
        data-item-quick-edit=""
        className="flex flex-col gap-1.5 px-3 py-2"
        onKeyDown={handleQuickEditKey}
      >
        <input
          ref={titleRef}
          value={editDraft.title}
          onChange={(e) =>
            setEditDraft({ ...editDraft, title: e.target.value })
          }
          aria-label={quickEdit.labels.title}
          className={FIELD}
        />
        {editDraft.date != null && (
          <input
            type="date"
            value={editDraft.date}
            onChange={(e) => {
              // A cleared native date field reports "" — keep the old day.
              if (e.target.value)
                setEditDraft({ ...editDraft, date: e.target.value });
            }}
            aria-label={quickEdit.labels.date}
            className={FIELD}
          />
        )}
        {editDraft.start != null && editDraft.end != null ? (
          <TimeRangeField
            start={editDraft.start}
            end={editDraft.end}
            labels={{
              start: quickEdit.labels.start,
              end: quickEdit.labels.end,
            }}
            formatDuration={quickEdit.formatDuration}
            onChange={(next) =>
              setEditDraft({ ...editDraft, start: next.start, end: next.end })
            }
          />
        ) : editDraft.start != null ? (
          <input
            type="time"
            value={editDraft.start}
            onChange={(e) => {
              if (e.target.value)
                setEditDraft({ ...editDraft, start: e.target.value });
            }}
            aria-label={quickEdit.labels.start}
            className={cn(FIELD, "tabular-nums")}
          />
        ) : null}
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditDraft(null)}
            className="rounded-lumen-md px-2 py-1 text-xs text-lumen-text-secondary transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {quickEdit.labels.cancel}
          </button>
          <button
            type="button"
            onClick={commitQuickEdit}
            className="rounded-lumen-md bg-lumen-accent px-2.5 py-1 text-xs font-medium text-lumen-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
          >
            {quickEdit.labels.save}
          </button>
        </div>
      </div>
    ) : null;

  // #2222: an editable summary is a focusable target with a hover tint. Not a
  // <button>: the host's summary holds block content, and a double-click is
  // not a press. #2632: the how-to-edit hint is for screen readers only — no
  // visible line and no native tooltip, so the tint, the text cursor and the
  // focus ring are the only visual cues left.
  const summaryBlock =
    quickEditForm ??
    (quickEdit ? (
      <div
        data-item-quick-edit-target=""
        tabIndex={0}
        aria-describedby={hintId}
        onDoubleClick={startQuickEdit}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (e.key === "Enter") {
            e.preventDefault();
            startQuickEdit();
          }
        }}
        className="mx-1 cursor-text rounded-lumen-md px-2 py-2 text-xs text-lumen-text transition-colors hover:bg-lumen-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      >
        {summary}
        <p id={hintId} className="sr-only">
          {quickEdit.labels.hint}
        </p>
      </div>
    ) : (
      <div className="px-3 py-2 text-xs text-lumen-text">{summary}</div>
    ));

  // In columns the blocks sit side by side, so the rule that separates them
  // is the column's left border rather than each block's top border.
  const blockRule = columns ? "" : "border-t border-lumen-border";

  // #1664: the time pair, in the same slot the rename input uses. The field
  // commits both halves in one payload (it owns start < end), so the panel can
  // close on that single commit — and a routine occurrence raises ONE scope
  // dialog rather than one per half.
  const inlineTimeBlock = inlineAction?.inlineTimeRange ? (
    <div className={cn(blockRule, "px-2 py-2")}>
      <TimeRangeField
        start={inlineAction.inlineTimeRange.start}
        end={inlineAction.inlineTimeRange.end}
        labels={inlineAction.inlineTimeRange.labels}
        formatDuration={inlineAction.inlineTimeRange.formatDuration}
        onChange={(next) => {
          inlineAction.inlineTimeRange?.onCommit(next);
          onClose();
        }}
      />
    </div>
  ) : null;

  const inlineBlock = inlineAction?.inlineInput ? (
    <div className={cn(blockRule, "px-2 py-2")}>
      <input
        ref={inputRef}
        value={draft}
        placeholder={inlineAction.inlineInput.placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (isImeComposing(e)) return;
          if (e.key === "Enter") {
            e.preventDefault();
            // Stop the document-level Escape/close listener from also
            // reacting to this same native event.
            e.stopPropagation();
            commitInline();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        aria-label={inlineAction.inlineInput.ariaLabel}
        // bg-secondary, not bg: same-color + thin border reads as no
        // input at all (#552's conclusion on this exact pairing).
        className="w-full rounded-lumen-md border border-lumen-border bg-lumen-bg-secondary px-2 py-1 text-xs text-lumen-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
      />
    </div>
  ) : null;

  const actionsBlock =
    actions && actions.length > 0 ? (
      <div className={cn(blockRule, "py-1")}>
        {actions.map((action) => (
          <ItemActionRow
            key={action.id}
            action={action}
            onActivate={activate}
          />
        ))}
      </div>
    ) : null;

  // Hidden while the inline input is up, so Enter has exactly one meaning.
  // #2564: in columns it is the outlined full-width row under both columns,
  // as the Claude Design proposal draws the schedule bubble. The stacked
  // panel keeps the filled accent button the tour and the other callers use.
  const editDetailBlock =
    onEditDetail && !inlineBlock && !inlineTimeBlock && !editing ? (
      <div
        data-item-panel-edit-detail=""
        className={cn(
          "border-t border-lumen-border",
          columns ? "px-3 py-2" : "p-2",
        )}
      >
        <button
          type="button"
          onClick={() => {
            onEditDetail();
            onClose();
          }}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lumen-md px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent",
            columns
              ? "border border-lumen-border bg-lumen-bg text-lumen-text transition-colors hover:bg-lumen-hover"
              : "bg-lumen-accent text-lumen-on-accent transition-opacity hover:opacity-90",
          )}
        >
          <Pencil aria-hidden className="size-3.5 shrink-0" />
          {editDetailLabel}
        </button>
      </div>
    ) : null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={cn(
        "fixed overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg",
        hostsDialogs ? "z-40" : "z-[60]",
      )}
      // A panel too tall for the viewport is capped and scrolls inside itself
      // rather than running off both edges. `overflowY` overrides the class's
      // `overflow-hidden` on that axis only, so the rounded corners still clip.
      style={{
        top,
        left,
        width,
        maxHeight,
        overflowY: maxHeight != null ? "auto" : undefined,
      }}
    >
      {columns ? (
        // #1625: what the item IS on the left, what you can DO on the right.
        // The panel's height becomes the taller column instead of the sum of
        // all three blocks. #2564: the left column gets the larger share
        // (1.2 : 1, the proposal's split) because the summary carries the
        // title, the tags and the memo, and the hand-off to the detail spans
        // both columns underneath.
        <>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div
              data-item-panel-column="summary"
              className="flex min-w-0 flex-col"
            >
              {summaryBlock}
            </div>
            <div
              data-item-panel-column="actions"
              className="min-w-0 border-l border-lumen-border"
            >
              {inlineBlock ?? inlineTimeBlock ?? actionsBlock}
            </div>
          </div>
          {editDetailBlock}
        </>
      ) : (
        <>
          {summaryBlock}
          {inlineBlock ?? inlineTimeBlock ?? (
            <>
              {actionsBlock}
              {editDetailBlock}
            </>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
