import { Sunrise, Sunset, Tag, Target, type LucideIcon } from "lucide-react";

/*
 * The glyph before each section tab (#2631), from the prototype's tab
 * definitions. Materials keeps its own map in useShellChrome.tsx, where the
 * command palette reads it too.
 *
 * Component types, not elements: useShellChrome.tsx turns each into the
 * element the tabs take. A .ts file of its own because the web lint
 * (react-refresh) lets a .tsx
 * module export components only, and connectTabs.test.tsx needs these maps.
 */
export const BRIEFING_TAB_ICON = {
  morning: Sunrise,
  evening: Sunset,
} as const satisfies Record<string, LucideIcon>;

export const CONNECT_TAB_ICON = {
  tags: Tag,
  goals: Target,
} as const satisfies Record<string, LucideIcon>;
