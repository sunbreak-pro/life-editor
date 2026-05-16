import type { GraphLinkKind, GraphNode, GraphNodeType } from "./graph-types";

// Canvas 2D cannot use Tailwind classes, so graph colors are resolved from
// the live CSS custom properties (the same `--color-*` vars `notion-*`
// tokens reference). This keeps the graph in sync with light/dark and any
// runtime theme change. No hard-coded Catppuccin — see plan §6.4.

export interface GraphPalette {
  bg: string;
  border: string;
  text: string;
  textSecondary: string;
  accent: string;
  success: string;
  danger: string;
  /** per-type node fill */
  node: Record<GraphNodeType, string>;
  /** per-kind link stroke */
  link: Record<GraphLinkKind, string>;
}

const VARS = {
  bg: "--color-bg-primary",
  border: "--color-border",
  text: "--color-text-primary",
  textSecondary: "--color-text-secondary",
  accent: "--color-accent",
  success: "--color-success",
  danger: "--color-danger",
  dailyDot: "--color-chip-routine-dot",
  taskDot: "--color-chip-task-dot",
} as const;

function readVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function resolvePalette(): GraphPalette {
  const bg = readVar(VARS.bg, "#ffffff");
  const border = readVar(VARS.border, "#dbe1ea");
  const text = readVar(VARS.text, "#18181b");
  const textSecondary = readVar(VARS.textSecondary, "#71717a");
  const accent = readVar(VARS.accent, "#2eaadc");
  const success = readVar(VARS.success, "#0f7b6c");
  const danger = readVar(VARS.danger, "#e03e3e");
  const daily = readVar(VARS.dailyDot, "#5b6cdb");

  return {
    bg,
    border,
    text,
    textSecondary,
    accent,
    success,
    danger,
    node: {
      // "project = foreground" mirrors the demo's black project nodes while
      // following the active theme (black on light, white on dark).
      project: text,
      note: accent,
      daily,
      tag: textSecondary,
    },
    link: {
      hierarchy: border,
      wikilink: textSecondary,
      manual: accent,
      tag: textSecondary,
      temporal: daily,
    },
  };
}

/** note.color / tag.color take precedence over the type color. */
export function nodeFill(node: GraphNode, palette: GraphPalette): string {
  if (node.color) return node.color;
  return palette.node[node.type];
}

/**
 * Re-resolve the palette whenever the theme attribute flips. ThemeContext
 * toggles `data-theme` on <html>; observing that covers light/dark + manual
 * theme switches.
 */
export function subscribeThemeChange(onChange: () => void): () => void {
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (
        r.type === "attributes" &&
        (r.attributeName === "data-theme" || r.attributeName === "class")
      ) {
        onChange();
        return;
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  return () => observer.disconnect();
}
