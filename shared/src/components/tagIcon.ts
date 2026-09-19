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
 * GROWING THE SET (#1366, then #1700): the curated set is meant to grow, and
 * the only way to grow it is by ADDING a named import per icon. Because each
 * name is its own module, the cost is linear and tiny — 26 → 56 moved the
 * eager chunk +7.42 KB raw / +2.84 KB gzip, and 56 → 146 below moved it
 * 1,079.41 KB → 1,105.24 KB raw and 297.71 KB → 307.62 KB gzip, i.e. +9.91 KB
 * gzip for 90 icons (0.110 KB each) against the +15 KB budget #1366 set. That
 * leaves about 45 more icons of headroom before the budget needs re-deciding.
 * Reaching for the registry object instead costs 466.5 KB flat, whether the
 * picker offers 26 icons or 146; `tagIconExplicitImports.test.ts` is the guard
 * that keeps it out, because nothing else notices.
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
  Activity,
  Apple,
  Archive,
  Award,
  Baby,
  Banknote,
  Bath,
  Bed,
  Beer,
  Bell,
  Bike,
  Bird,
  Book,
  Bookmark,
  BookOpen,
  Brain,
  Briefcase,
  Building,
  Building2,
  Bus,
  Cake,
  Calculator,
  Calendar,
  Camera,
  Car,
  Castle,
  Cat,
  ChartColumn,
  Church,
  Circle,
  ClipboardList,
  Clock,
  Cloud,
  CloudRain,
  CloudSnow,
  Code,
  Coffee,
  Coins,
  CreditCard,
  Crown,
  Diamond,
  Dices,
  Dog,
  Drill,
  Dumbbell,
  File,
  Film,
  Flag,
  FlaskConical,
  Flower,
  Folder,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Guitar,
  Hammer,
  Handshake,
  Hash,
  Headphones,
  Heart,
  HeartPulse,
  Highlighter,
  Home,
  Hotel,
  IceCreamCone,
  Inbox,
  JapaneseYen,
  Landmark,
  Laptop,
  Layers,
  Leaf,
  Library,
  Lightbulb,
  Luggage,
  Mail,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  Microscope,
  Moon,
  Mountain,
  Music,
  Navigation,
  NotebookPen,
  Paintbrush,
  Palette,
  PawPrint,
  Pencil,
  Phone,
  PiggyBank,
  Pill,
  Pin,
  Pizza,
  Plane,
  Plug,
  Presentation,
  Printer,
  Rainbow,
  Receipt,
  Ruler,
  Salad,
  Sandwich,
  School,
  Scissors,
  Send,
  Shapes,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Snowflake,
  Sofa,
  Soup,
  Sparkles,
  Sprout,
  Square,
  Star,
  Stethoscope,
  Store,
  Sun,
  Syringe,
  Tag,
  Target,
  Tent,
  Thermometer,
  TrainFront,
  TreePine,
  Trees,
  TrendingUp,
  Triangle,
  Umbrella,
  Users,
  Utensils,
  Wallet,
  WashingMachine,
  Wifi,
  Wind,
  Wine,
  Wrench,
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
 * #1700 grew this 56 → 146 by thickening every existing run and adding six
 * areas the old set had nothing for (nature / weather / tools / comms /
 * places / symbols). At that size the runs still decide the order, but they
 * stop being enough to FIND a glyph by eye — which is what #1701 (a search
 * field on the panel) is for.
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
  Bell,
  Inbox,
  Archive,
  Layers,
  Award,
  Gift,
  // Life
  Bed,
  ShoppingCart,
  Shirt,
  PawPrint,
  Bath,
  Sofa,
  Baby,
  Dog,
  Cat,
  WashingMachine,
  // Work
  Building2,
  Mail,
  Users,
  Handshake,
  Presentation,
  ChartColumn,
  ClipboardList,
  Printer,
  Laptop,
  // Study
  GraduationCap,
  Pencil,
  Library,
  FlaskConical,
  BookOpen,
  NotebookPen,
  Highlighter,
  Ruler,
  Calculator,
  Microscope,
  // Health
  Dumbbell,
  HeartPulse,
  Pill,
  Stethoscope,
  Activity,
  Bike,
  Footprints,
  Syringe,
  Thermometer,
  Brain,
  // Money
  Wallet,
  PiggyBank,
  CreditCard,
  Coins,
  Banknote,
  JapaneseYen,
  Receipt,
  Landmark,
  TrendingUp,
  ShoppingBag,
  // Travel
  Plane,
  Car,
  TrainFront,
  MapPin,
  Bus,
  Ship,
  Map,
  Navigation,
  Luggage,
  Globe,
  // Food
  Utensils,
  Pizza,
  Apple,
  Wine,
  Beer,
  Cake,
  IceCreamCone,
  Sandwich,
  Soup,
  Salad,
  // Hobby
  Camera,
  Gamepad2,
  Palette,
  Film,
  Guitar,
  Headphones,
  Mic,
  Dices,
  Tent,
  // Nature
  Trees,
  TreePine,
  Flower,
  Sprout,
  Mountain,
  Bird,
  // Weather
  CloudRain,
  CloudSnow,
  Snowflake,
  Umbrella,
  Wind,
  Rainbow,
  // Tools
  Wrench,
  Hammer,
  Drill,
  Scissors,
  Paintbrush,
  Plug,
  // Communication
  Phone,
  MessageCircle,
  Send,
  Megaphone,
  Wifi,
  Smartphone,
  // Places
  Store,
  Building,
  School,
  Church,
  Castle,
  Hotel,
  // Symbols
  Square,
  Triangle,
  Diamond,
  Shapes,
  Crown,
  Gem,
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
