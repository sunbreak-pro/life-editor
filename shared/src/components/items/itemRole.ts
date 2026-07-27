import {
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/*
 * Item-kind display contract (#409). The SSOT for "how does an items_meta row
 * announce which kind of thing it is" on any surface that lists items across
 * roles — the tag editor's per-tag item list (#409) and the item-side tag
 * picker (#412) both render from THIS module, so the two never drift into
 * two different visual languages for the same four kinds.
 *
 * Scope note: `items_meta` carries five roles (task / event / routine / note /
 * daily), but only four are user-facing kinds. Routine is an implementation
 * detail — the UI presents it as "an Event with a repeat setting" and it owns
 * no tag surface (CLAUDE.md §4, 2026-07-11 #185) — so it is deliberately NOT
 * in the designed set. Anything outside the set resolves to `null` and renders
 * through the neutral fallback below rather than being dropped: an assignment
 * we cannot name is still an assignment the user must be able to remove.
 *
 * Redundancy is intentional: every badge carries an icon SHAPE, a text LABEL,
 * and a color tint. Color never carries the distinction alone (a11y).
 */

/** The four user-facing item kinds, in the order lists should group them. */
export const ITEM_ROLE_ORDER = ["task", "event", "note", "daily"] as const;

export type ItemRole = (typeof ITEM_ROLE_ORDER)[number];

/** Narrow a raw `items_meta.role` to a displayable kind, or null if unknown. */
export function resolveItemRole(
  role: string | null | undefined,
): ItemRole | null {
  return ITEM_ROLE_ORDER.includes(role as ItemRole) ? (role as ItemRole) : null;
}

/**
 * Per-kind icon. Each one is the icon that kind ALREADY wears elsewhere in the
 * app, so a badge reads as the same thing the user clicked to get there:
 * task/note/daily match the Materials tab icons (MainScreen MATERIALS_ICON)
 * and the "[[" link suggestions; event matches the Schedule section icon
 * (sections.ts). Unknown gets a question mark, never a kind's icon.
 */
export const ITEM_ROLE_ICON: Record<ItemRole, LucideIcon> = {
  task: CheckSquare,
  event: Clock,
  note: FileText,
  daily: CalendarDays,
};

export const UNKNOWN_ITEM_ROLE_ICON: LucideIcon = HelpCircle;

/**
 * Per-kind icon tint, as a `lumen-*` text class (no hard-coded colors — §6).
 * Only the ICON is tinted: the label stays on the neutral secondary text token
 * so a row of mixed kinds reads as one list instead of a rainbow. There are no
 * `-subtle` background tokens for info/success/warning, so the badge chip
 * itself is neutral by design rather than per-kind tinted.
 */
export const ITEM_ROLE_ICON_CLASS: Record<ItemRole, string> = {
  task: "text-lumen-accent",
  event: "text-lumen-info",
  note: "text-lumen-accent-secondary",
  daily: "text-lumen-warning",
};

export const UNKNOWN_ITEM_ROLE_ICON_CLASS = "text-lumen-text-tertiary";

/**
 * Already-translated kind names, injected by the host (§6.4 — shared parts
 * never call useTranslation). `unknown` covers roles outside the designed set.
 */
export interface ItemRoleLabels {
  task: string;
  event: string;
  note: string;
  daily: string;
  unknown: string;
}

/** The label for a raw role, falling back to `unknown` outside the set. */
export function itemRoleLabel(
  role: string | null | undefined,
  labels: ItemRoleLabels,
): string {
  const resolved = resolveItemRole(role);
  return resolved ? labels[resolved] : labels.unknown;
}

/** Sort key placing designed kinds in ITEM_ROLE_ORDER and unknowns last. */
export function itemRoleSortKey(role: string | null | undefined): number {
  const resolved = resolveItemRole(role);
  return resolved ? ITEM_ROLE_ORDER.indexOf(resolved) : ITEM_ROLE_ORDER.length;
}
