/*
 * Shared tag-icon resolution helper (#310 part 2).
 *
 * A wiki_tag may carry an optional `icon` string = a lucide-react icon name
 * (PascalCase, e.g. "Tag" / "Star"). This module turns that stored name into
 * a renderable component and exposes the curated picker choices.
 *
 * WHY a shared helper: the Tag edit modal (#310) picks an icon, and #311 (tag
 * headings) renders it — both must resolve the SAME name→component mapping.
 * Keeping it here (not inside a component) lets both import one source.
 *
 * BUNDLE NOTE: `lucide-react`'s `icons` map is tree-shaken per named import at
 * build time, but referencing the whole `icons` object opts the full set in.
 * That is acceptable here (the picker needs dynamic name→component lookup and
 * lucide ships as lightweight SVG components), and the choice list is
 * deliberately curated — we do NOT surface all ~1600 icons in the picker.
 */

import { icons, type LucideIcon } from "lucide-react";

/**
 * Resolve a stored icon name to its lucide component, or null when the name is
 * absent / unknown (caller falls back to a default icon).
 */
export function resolveTagIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  const icon = (icons as Record<string, LucideIcon>)[name];
  return icon ?? null;
}

/**
 * Curated general-purpose icon names offered in the tag icon picker. Kept
 * small on purpose (readable grid, no bundle blow-up). Every entry is a valid
 * key of lucide's `icons` map.
 */
export const TAG_ICON_CHOICES: readonly string[] = [
  "Tag",
  "Hash",
  "Star",
  "Heart",
  "Flag",
  "Bookmark",
  "Circle",
  "Folder",
  "File",
  "Home",
  "Briefcase",
  "Book",
  "Calendar",
  "Clock",
  "Coffee",
  "Music",
  "Zap",
  "Sun",
  "Moon",
  "Cloud",
  "Leaf",
  "Code",
  "Lightbulb",
  "Sparkles",
  "Target",
  "Pin",
];
