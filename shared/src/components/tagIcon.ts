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
 * BUNDLE NOTE (#1114, measured in #994 / PR #1112 §8.6): this file used to do
 * `import { icons } from "lucide-react"` and index that map by name. Touching
 * the registry OBJECT is what defeats tree-shaking — the bundler cannot know
 * which keys are read, so every icon ships. The measurement: lucide accounted
 * for 466.5 KB raw across 1,704 icon modules in the eager `index-*` chunk =
 * 30.7% of it, to serve the 26 names curated at the time. Replacing it with
 * the explicit imports here took the eager chunk from 1,557.90 KB → 1,103.76
 * KB raw and 417.52 KB → 300.64 KB gzip (−28.0%).
 *
 * GROWING THE SET (#1366): the curated set is meant to grow, and the only way
 * to grow it is by ADDING a named import per icon. Because each name is its
 * own module, the cost is linear and tiny — expanding 26 → 56 below moved the
 * eager chunk 955.12 KB → 962.54 KB raw and 264.48 KB → 267.32 KB gzip, i.e.
 * +2.84 KB gzip against the +15 KB budget #1366 set. Reaching for the registry
 * object instead costs 466.5 KB flat, whether the picker offers 26 icons or
 * 56; `tagIconExplicitImports.test.ts` is the guard that keeps it out, because
 * nothing else notices.
 *
 * The trade-off this makes, and why it is safe: `resolveTagIcon` no longer
 * resolves an ARBITRARY lucide name, only the curated set — anything else now
 * returns null and the caller draws its default glyph. Checked against the
 * live DB before switching (`select distinct icon from wiki_tags where icon is
 * not null`): the only stored names are "Clock" and "File", both curated then
 * and still curated now. The picker is the only writer and it can only emit
 * these names, so no stored value can fall outside the map. If a future
 * feature needs free-form names, add them to TAG_ICONS rather than reaching
 * for the registry object again.
 */

import {
  Apple,
  Bed,
  Book,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Car,
  Circle,
  Clock,
  Cloud,
  Code,
  Coffee,
  Coins,
  CreditCard,
  Dumbbell,
  File,
  Flag,
  FlaskConical,
  Folder,
  Gamepad2,
  GraduationCap,
  Hash,
  Heart,
  HeartPulse,
  Home,
  Leaf,
  Library,
  Lightbulb,
  Mail,
  MapPin,
  Moon,
  Music,
  Palette,
  PawPrint,
  Pencil,
  PiggyBank,
  Pill,
  Pin,
  Pizza,
  Plane,
  Shirt,
  ShoppingCart,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Tag,
  Target,
  TrainFront,
  Users,
  Utensils,
  Wallet,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icons offered in the tag icon picker, and the only names
 * `resolveTagIcon` can resolve.
 *
 * Declaration order IS the picker's grid order (TAG_ICON_CHOICES below is
 * derived from it), so the groups are laid out to read left-to-right: the
 * original general-purpose block first, then one run per life area. The
 * comments are the only thing marking a group — the picker draws a single
 * flat grid, so the runs are what make a category findable by eye.
 *
 * To add an icon: add its named import above and one line here. Never swap in
 * `import { icons }` to shorten this — see BUNDLE NOTE.
 */
const TAG_ICONS = {
  // General (the original set — kept first so the common picks stay on top)
  Tag,
  Hash,
  Star,
  Heart,
  Flag,
  Bookmark,
  Circle,
  Folder,
  File,
  Home,
  Briefcase,
  Book,
  Calendar,
  Clock,
  Coffee,
  Music,
  Zap,
  Sun,
  Moon,
  Cloud,
  Leaf,
  Code,
  Lightbulb,
  Sparkles,
  Target,
  Pin,
  // Life
  Bed,
  ShoppingCart,
  Shirt,
  PawPrint,
  // Work
  Building2,
  Mail,
  Users,
  // Study
  GraduationCap,
  Pencil,
  Library,
  FlaskConical,
  // Health
  Dumbbell,
  HeartPulse,
  Pill,
  Stethoscope,
  // Money
  Wallet,
  PiggyBank,
  CreditCard,
  Coins,
  // Travel
  Plane,
  Car,
  TrainFront,
  MapPin,
  // Food
  Utensils,
  Pizza,
  Apple,
  Wine,
  // Hobby
  Camera,
  Gamepad2,
  Palette,
} satisfies Record<string, LucideIcon>;

/**
 * Resolve a stored icon name to its lucide component, or null when the name is
 * absent / not one of the curated set (caller falls back to a default icon).
 *
 * The `hasOwn` guard is load-bearing, not defensive noise: TAG_ICONS is an
 * object literal, so a stored name of "toString" / "constructor" reaches
 * Object.prototype and a bare lookup would hand that function to createElement
 * instead of returning null. The old registry-based lookup had the same hole.
 */
export function resolveTagIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  if (!Object.hasOwn(TAG_ICONS, name)) return null;
  return TAG_ICONS[name as keyof typeof TAG_ICONS];
}

/**
 * Curated icon names offered in the tag icon picker. Derived from TAG_ICONS so
 * the list and the map cannot drift apart — every choice is guaranteed to
 * resolve.
 */
export const TAG_ICON_CHOICES: readonly string[] = Object.keys(TAG_ICONS);
