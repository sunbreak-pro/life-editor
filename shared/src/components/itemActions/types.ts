import type { ReactNode } from "react";

/*
 * Item action primitives (Issue #307) — the shared vocabulary for the item
 * operation panels (ItemActionPopover / ItemDetailOverlay; the separate
 * ItemContextMenu was folded into the popover by #551).
 *
 * An action is DECLARATIVE: a host describes what a row does and how it looks,
 * and the panels render + wire it. Pure data — no DataService, no i18n; `label`
 * (and any inline-input copy) arrives already translated (CLAUDE.md §3.1/§6.4).
 */

/**
 * Inline-input behaviour for an action (e.g. in-place rename). When present on
 * an action, selecting it swaps the action list for a text input seeded with
 * `value`; Enter commits via `onCommit` (trimmed, non-empty), Escape cancels.
 * Takes precedence over `onSelect`. ItemActionPopover renders the inline swap.
 */
export interface ItemActionInlineInput {
  /** Seeds the input when it opens (e.g. the current title). */
  value: string;
  /** Already-translated aria-label / placeholder for the input. */
  ariaLabel: string;
  placeholder?: string;
  /** Commit a new value (already trimmed + non-empty by the panel). */
  onCommit: (value: string) => void;
}

/**
 * Inline TIME-RANGE behaviour for an action (#1664). Selecting it swaps the
 * action list for the shared <TimeRangeField>, seeded with the item's span;
 * the field commits both halves at once (it owns the start < end invariant),
 * and the panel closes on that commit the way the rename input does.
 *
 * Separate from `inlineInput` rather than a mode of it: the two seed different
 * shapes, and a union would leave every caller narrowing a field it does not
 * use.
 */
export interface ItemActionInlineTimeRange {
  start: string;
  end: string;
  /** Already-translated labels for the two combo fields. */
  labels: { start: string; end: string };
  /** Formats the duration suffix on the end options. */
  formatDuration?: (minutes: number) => string;
  onCommit: (next: { start: string; end: string }) => void;
}

/** One declarative row in an item operation panel. */
export interface ItemAction {
  /** Stable identity (also the React key). */
  id: string;
  /** Already-translated row label (§6.4). */
  label: string;
  /** Optional leading icon — any node; sized to 3.5 by the row. */
  icon?: ReactNode;
  /** Fired on select (unless `inlineInput` is set). */
  onSelect?: () => void;
  /** Greys the row out and blocks selection. */
  disabled?: boolean;
  /** Danger styling (e.g. delete). */
  danger?: boolean;
  /**
   * In-place inline input (e.g. rename). Takes precedence over `onSelect`.
   * ItemActionPopover honours it (#551); other panels treat the action as a
   * plain select.
   */
  inlineInput?: ItemActionInlineInput;
  /**
   * In-place time-range editor (#1664). Same precedence as `inlineInput` —
   * only ItemActionPopover honours it; other panels treat the action as a
   * plain select.
   */
  inlineTimeRange?: ItemActionInlineTimeRange;
}
