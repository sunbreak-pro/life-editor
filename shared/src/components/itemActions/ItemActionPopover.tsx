import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pencil } from "lucide-react";
import { cn } from "../cn";
import type { ItemAction } from "./types";
import { ItemActionRow } from "./ItemActionRow";
import { clampToViewport, useFloatingDismiss } from "./floating";
import { isImeComposing } from "../../utils/imeGuard";

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
   * other caller keep. "columns" puts the summary and the edit-detail button
   * on the left and the actions on the right, so a wide panel spends its width
   * instead of its height. A prop rather than a className override because
   * `cn` is a plain join, not tailwind-merge (rules/frontend.md §Gotchas).
   */
  layout?: "stack" | "columns";
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
}: ItemActionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inlineId, setInlineId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  useFloatingDismiss(panelRef, onClose);

  const inlineAction =
    inlineId != null
      ? (actions?.find((a) => a.id === inlineId && a.inlineInput) ?? null)
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

  // Measure the panel we just drew and re-clamp with the real number, before
  // the browser paints. Re-runs on the two things that change the height — the
  // host's `actions` and the inline-input swap — plus its own result, so a
  // measurement that shifts the panel gets checked again. Writing state only
  // on an actual change is what stops this from looping (a capped panel
  // measures its cap, which re-derives the same cap).
  useLayoutEffect(() => {
    const height = panelRef.current?.offsetHeight;
    if (height != null && height !== measuredHeight) setMeasuredHeight(height);
  }, [measuredHeight, actions, inlineAction]);

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
    if (action.inlineInput) {
      setDraft(action.inlineInput.value);
      setInlineId(action.id);
      return;
    }
    action.onSelect?.();
    onClose();
  };

  const columns = layout === "columns";

  const summaryBlock = (
    <div className="px-3 py-2 text-xs text-lumen-text">{summary}</div>
  );

  // In columns the blocks sit side by side, so the rule that separates them
  // is the column's left border rather than each block's top border.
  const blockRule = columns ? "" : "border-t border-lumen-border";

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
          <ItemActionRow key={action.id} action={action} onActivate={activate} />
        ))}
      </div>
    ) : null;

  // Hidden while the inline input is up, so Enter has exactly one meaning.
  const editDetailBlock =
    onEditDetail && !inlineBlock ? (
      <div className={cn(columns ? "mt-auto" : blockRule, "p-2")}>
        <button
          type="button"
          onClick={() => {
            onEditDetail();
            onClose();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lumen-md bg-lumen-accent px-3 py-1.5 text-xs font-medium text-lumen-on-accent transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen-accent"
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
      className="fixed z-[60] overflow-hidden rounded-lumen-md border border-lumen-border bg-lumen-bg py-1 shadow-lumen-lg"
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
        // #1625: what the item IS on the left (summary, then the hand-off to
        // its detail pinned to the bottom), what you can DO on the right. The
        // panel's height becomes the taller column instead of the sum of all
        // three blocks.
        <div className="flex">
          <div
            data-item-panel-column="summary"
            className="flex w-1/2 min-w-0 flex-col"
          >
            {summaryBlock}
            {editDetailBlock}
          </div>
          <div
            data-item-panel-column="actions"
            className="w-1/2 min-w-0 border-l border-lumen-border"
          >
            {inlineBlock ?? actionsBlock}
          </div>
        </div>
      ) : (
        <>
          {summaryBlock}
          {inlineBlock ?? (
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

