import type { ReactNode } from "react";

/*
 * Item action primitives (Issue #307) — the shared vocabulary for the item
 * operation panels (ItemContextMenu / ItemActionPopover / ItemDetailOverlay).
 *
 * An action is DECLARATIVE: a host describes what a row does and how it looks,
 * and the panels render + wire it. Pure data — no DataService, no i18n; `label`
 * (and any inline-input copy) arrives already translated (CLAUDE.md §3.1/§6.4).
 */

/**
 * Inline-input behaviour for an action (e.g. in-place rename). When present on
 * an action, selecting it swaps the row for a text input seeded with `value`;
 * Enter commits via `onCommit` (trimmed, non-empty), Escape cancels. Takes
 * precedence over `onSelect`. Only ItemContextMenu renders the inline swap.
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
  /**
   * Marks the action as a not-yet-implemented placeholder: rendered disabled
   * with a trailing "soon" badge (badge copy injected via the panel's
   * `stubBadge` prop). Lets a surface advertise a standard action before its
   * behaviour exists (Issue #307 standard action candidates).
   */
  stub?: boolean;
  /** Danger styling (e.g. delete). */
  danger?: boolean;
  /**
   * In-place inline input (e.g. rename). Takes precedence over `onSelect`.
   * Only ItemContextMenu honours it; other panels treat the action as a
   * plain select.
   */
  inlineInput?: ItemActionInlineInput;
}
