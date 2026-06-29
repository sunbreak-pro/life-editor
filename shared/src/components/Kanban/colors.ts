/*
 * Kanban color presets (K2). A curated palette for folder / tag colors,
 * shown in the column-header color picker. These are user-data colors
 * (they tint folder/tag chrome), so they are applied via inline styles /
 * CSS vars — the §6 "no hardcoded color" rule targets THEME chrome
 * (ink-* tokens), not user-chosen data colors (mirrors the existing
 * KanbanColumn accent + KanbanCard folder-dot inline styles).
 *
 * 12 hues, laid out as 2 rows of 6 in the picker. Tuned to read on both
 * light and dark themes.
 */
export const KANBAN_COLOR_PRESETS: readonly string[] = [
  "#2563eb", // blue
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#16a34a", // green
  "#eab308", // amber
  "#f59e0b", // orange
  "#e03e3e", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#6366f1", // indigo
  "#0f766e", // deep teal
  "#6b7280", // gray
];
