import type { GraphLinkKind, GraphNode, GraphNodeType } from "./graph-types";

// Canvas 2D cannot use Tailwind classes, so graph colors are resolved from
// the live CSS custom properties (the same `--color-*` vars `notion-*`
// tokens reference). This keeps the graph in sync with light/dark and any
// runtime theme change. No hard-coded colors — CLAUDE.md §6.4.

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
} as const;

function readVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function resolvePalette(): GraphPalette {
  const bg = readVar(VARS.bg, "#fafafa");
  const border = readVar(VARS.border, "#e3e3e7");
  const text = readVar(VARS.text, "#1a1a1f");
  const textSecondary = readVar(VARS.textSecondary, "#5c5c66");
  const accent = readVar(VARS.accent, "#1f4fff");
  const success = readVar(VARS.success, "#0f7b6c");
  const danger = readVar(VARS.danger, "#d92d20");
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
 * toggles `data-theme` / `class` on <html>; observing that covers light/dark
 * + manual theme switches.
 */
export function subscribeThemeChange(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
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
