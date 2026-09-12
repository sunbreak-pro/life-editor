import type { WikiTag, WikiTagAssignment } from "../types/wikiTagUnified";

/*
 * Which colour a Schedule row is drawn in (#1580), and how to keep its title
 * readable on top of it.
 *
 * Until now a chip or a block said only WHERE it came from — routine, event or
 * todo — in three fixed token pairs. Tags already carry a colour, and the
 * calendar lens already paints its chips with it; the items themselves did not.
 *
 * The colour stays the TAG's property (web/src/wikitag/TagColorControls.tsx).
 * What an item records is only which of its tags gets to speak for it, and even
 * that is usually nothing: `isDisplayColor` is false on every row until someone
 * picks, and the default falls out of the data instead — the tag that was put
 * on first.
 *
 * Pure, and deliberately not a hook: the Schedule host already holds every tag
 * and every assignment in memory (useWikiTagsUnifiedAPI's bulk caches, reaching
 * the grid through useScheduleGridFilters), so this is a lookup over data that
 * is already there rather than a reason to fetch anything.
 */

/** Text colour for a light background — the app's own darkest ink. */
const INK_DARK = "#111827";
/** Text colour for a dark background. */
const INK_LIGHT = "#ffffff";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** `#abc` / `#aabbcc` → [r, g, b] in 0-255, or null if it is neither. */
function parseHex(color: string): [number, number, number] | null {
  const m = HEX_RE.exec(color.trim());
  if (!m) return null;
  const hex =
    m[1].length === 3
      ? m[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : m[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance of a hex colour, or null if it is not one. */
function relativeLuminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two relative luminances. */
function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const LUMINANCE_DARK = relativeLuminance(INK_DARK) ?? 0;
const LUMINANCE_LIGHT = relativeLuminance(INK_LIGHT) ?? 1;

/**
 * Readable ink for `background`: near-black on a light fill, white on a dark
 * one. Null when the colour is not a hex we can reason about — the caller then
 * leaves the row on its variant colours rather than guessing.
 *
 * The two contrast ratios are compared outright rather than split at some
 * luminance threshold, because the obvious threshold is wrong. Half-luminance
 * looks like the midpoint and is not: the ratios cross at about 0.21, since
 * white is at 1.0 and the dark ink is near 0, so the scale either side of it
 * is nothing like symmetric. A 0.5 split put white on `#22c55e`, where white
 * scores 2.3:1 and the dark ink 7.1:1 — the wrong one, and by a lot.
 *
 * A naive `(r+g+b)/3` is wrong in a second way: green weighs 0.7152 of the
 * luminance against blue's 0.0722, so two colours with the same channel
 * average land on opposite sides of readable.
 */
export function readableInkOn(background: string): string | null {
  const luminance = relativeLuminance(background);
  if (luminance === null) return null;
  return contrast(luminance, LUMINANCE_DARK) >=
    contrast(luminance, LUMINANCE_LIGHT)
    ? INK_DARK
    : INK_LIGHT;
}

/**
 * The assignment whose tag colours `itemId`, or null when the item carries no
 * tags at all.
 *
 * The explicit pick wins. Otherwise the earliest `createdAt` does, with the id
 * breaking a tie — two tags added in the same write land on the same timestamp,
 * and an order that depends on which row the server hands back first would
 * repaint the calendar between reloads for no reason the user did anything to
 * cause.
 *
 * Deleted assignments are skipped here rather than upstream so callers can pass
 * the bulk cache straight in.
 */
export function pickDisplayAssignment(
  assignments: readonly WikiTagAssignment[],
  itemId: string,
): WikiTagAssignment | null {
  let explicit: WikiTagAssignment | null = null;
  let earliest: WikiTagAssignment | null = null;
  for (const a of assignments) {
    if (a.itemId !== itemId || a.isDeleted) continue;
    if (a.isDisplayColor) explicit = a;
    if (
      !earliest ||
      a.createdAt < earliest.createdAt ||
      (a.createdAt === earliest.createdAt && a.id < earliest.id)
    ) {
      earliest = a;
    }
  }
  return explicit ?? earliest;
}

/**
 * `itemId` → the hex its tag paints it, for every item that has one.
 *
 * A Map rather than a per-row lookup because every Schedule surface asks the
 * same question about a whole window of rows at once, and the assignment list
 * is the WHOLE user's — walking it once per chip would be quadratic on a busy
 * month.
 *
 * An item is absent from the map — and so keeps its variant colours — when it
 * has no tags, when the tag that speaks for it has no colour, or when that
 * colour is not a hex. That last case is the same "we cannot reason about it"
 * answer `readableInkOn` gives, and both fall back rather than guess.
 */
export function buildItemTagColors(
  assignments: readonly WikiTagAssignment[],
  tags: readonly WikiTag[],
): Map<string, string> {
  const colorByTag = new Map<string, string>();
  for (const tag of tags) {
    if (tag.color && !tag.isDeleted) colorByTag.set(tag.id, tag.color);
  }
  if (colorByTag.size === 0) return new Map();

  // One pass, keeping the winner per item, rather than grouping first: the
  // same comparison pickDisplayAssignment makes, spread over the whole list.
  const best = new Map<string, WikiTagAssignment>();
  for (const a of assignments) {
    if (a.isDeleted) continue;
    const held = best.get(a.itemId);
    if (!held) {
      best.set(a.itemId, a);
      continue;
    }
    if (held.isDisplayColor) continue;
    if (
      a.isDisplayColor ||
      a.createdAt < held.createdAt ||
      (a.createdAt === held.createdAt && a.id < held.id)
    ) {
      best.set(a.itemId, a);
    }
  }

  const out = new Map<string, string>();
  for (const [itemId, a] of best) {
    const color = colorByTag.get(a.tagId);
    if (color && readableInkOn(color)) out.set(itemId, color);
  }
  return out;
}

/** The inline style a chip / block wears when a tag colours it. */
export interface TagFaceStyle {
  backgroundColor: string;
  color: string;
}

/**
 * Inline style for a tag-coloured face, or undefined when there is no colour.
 *
 * Inline rather than a class because the value is user data — the same
 * exception colorPresets.ts already documents for every other surface that
 * paints with a tag's colour.
 */
export function tagFaceStyle(color?: string | null): TagFaceStyle | undefined {
  if (!color) return undefined;
  const ink = readableInkOn(color);
  if (!ink) return undefined;
  return { backgroundColor: color, color: ink };
}
