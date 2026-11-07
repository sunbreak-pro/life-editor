import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  SquareCheckBig,
  Sunrise,
  Sunset,
  Tag,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { AnalyticsTab } from "@life-editor/shared";

/*
 * The glyph before each section tab (#2631), from the prototype's tab
 * definitions. Materials keeps its own map in useShellChrome.tsx, where the
 * command palette reads it too. 記録 is not among the prototype's four
 * Analytics tabs, so it takes the nearest meaning.
 *
 * Component types, not elements: useShellChrome.tsx turns each into the
 * element the tabs take. A .ts file of its own because the web lint
 * (react-refresh) lets a .tsx
 * module export components only, and connectTabs.test.tsx needs these maps.
 */
export const ANALYTICS_TAB_ICON: Record<AnalyticsTab, LucideIcon> = {
  overview: LayoutDashboard,
  todos: SquareCheckBig,
  work: Timer,
  schedule: Calendar,
  records: ClipboardList,
};

export const BRIEFING_TAB_ICON = {
  morning: Sunrise,
  evening: Sunset,
} as const satisfies Record<string, LucideIcon>;

export const CONNECT_TAB_ICON = {
  tags: Tag,
  goals: Target,
} as const satisfies Record<string, LucideIcon>;
