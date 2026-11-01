import {
  Calendar,
  CalendarDays,
  CheckSquare,
  FileText,
  Link2,
  type LucideIcon,
} from "lucide-react";

/*
 * How a LINK announces what it points at (#2391) — the one table the note
 * header's chips read, and the one the body's "[[" chips (#2394) are to read.
 *
 * This is not `itemRole.ts`, on purpose. That module keeps the icon and the
 * tint a kind wears in a labelled list (its badge carries the kind's name, so
 * the color only has to be a hint). A link chip has NO label: the glyph and the
 * color are all it has, and a chip sits right beside the tag pills. So the
 * design gives links their own pairing, and it differs from the badge's: an
 * event is `Calendar` here against the badge's `Clock`, and the tints are the
 * schedule chip dots rather than the semantic info / warning tokens.
 *
 * Daily and event share a calendar shape, so they stay apart by their color and
 * by the day grid `CalendarDays` draws. Anything outside the four (a goal, a
 * table, a routine, or a target the pool has not named yet) falls back to the
 * neutral `Link2`: a link that cannot say its kind is still a link.
 */

export const ITEM_LINK_KINDS = ["note", "daily", "event", "task"] as const;

export type ItemLinkKind = (typeof ITEM_LINK_KINDS)[number];

export interface ItemLinkVisual {
  Icon: LucideIcon;
  /** A `lumen-*` text class, so the glyph follows the theme (no hex here). */
  iconClass: string;
}

export const ITEM_LINK_VISUAL: Record<ItemLinkKind, ItemLinkVisual> = {
  note: { Icon: FileText, iconClass: "text-lumen-accent" },
  daily: { Icon: CalendarDays, iconClass: "text-lumen-chip-routine-dot" },
  event: { Icon: Calendar, iconClass: "text-lumen-chip-event-dot" },
  task: { Icon: CheckSquare, iconClass: "text-lumen-chip-task-dot" },
};

export const UNKNOWN_ITEM_LINK_VISUAL: ItemLinkVisual = {
  Icon: Link2,
  iconClass: "text-lumen-text-secondary",
};

/** The glyph and tint for a raw `items_meta.role`, neutral outside the four. */
export function itemLinkVisual(
  role: string | null | undefined,
): ItemLinkVisual {
  return ITEM_LINK_KINDS.includes(role as ItemLinkKind)
    ? ITEM_LINK_VISUAL[role as ItemLinkKind]
    : UNKNOWN_ITEM_LINK_VISUAL;
}
