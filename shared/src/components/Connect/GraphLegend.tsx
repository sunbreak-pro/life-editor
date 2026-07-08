import {
  Folder,
  FileText,
  Calendar,
  Hash,
  type LucideIcon,
} from "lucide-react";
import type { GraphNodeType } from "./graph/graph-types";
import type { ConnectGraphLabels } from "./labels";

/*
 * Node-type legend chips (project / note / daily / tag). Layout-agnostic: it
 * only renders the chip row and takes a `className` so the caller positions it
 * (Desktop = absolute top-left over the canvas; Mobile = a horizontal-scroll
 * strip). Colors are pulled from the live theme CSS vars — the SAME vars the
 * Canvas node fills resolve (graph-theme.ts), so a dot and its node always
 * match. No hex literals (§6.4); the daily hue reuses --color-chip-routine-dot.
 */
const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

// CSS-var references (not hex) — mirrors graph-theme.ts resolvePalette().node.
const TYPE_DOT_VAR: Record<GraphNodeType, string> = {
  project: "var(--color-text-primary)",
  note: "var(--color-accent)",
  daily: "var(--color-chip-routine-dot)",
  tag: "var(--color-text-secondary)",
};

const ORDER: readonly GraphNodeType[] = ["project", "note", "daily", "tag"];

interface GraphLegendProps {
  labels: ConnectGraphLabels;
  /** Positioning / layout classes supplied by the caller. */
  className?: string;
}

export function GraphLegend({ labels, className = "" }: GraphLegendProps) {
  const typeLabel: Record<GraphNodeType, string> = {
    project: labels.typeProject,
    note: labels.typeNote,
    daily: labels.typeDaily,
    tag: labels.typeTag,
  };

  return (
    <div className={"flex gap-1.5 " + className}>
      {ORDER.map((type) => {
        const Icon = TYPE_ICON[type];
        return (
          <span
            key={type}
            className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lumen-full bg-lumen-bg border border-lumen-border shadow-lumen-sm text-[11px] text-lumen-text-secondary"
          >
            <span
              className="w-2 h-2 rounded-lumen-full shrink-0"
              style={{ background: TYPE_DOT_VAR[type] }}
            />
            <Icon size={12} className="shrink-0" />
            {typeLabel[type]}
          </span>
        );
      })}
    </div>
  );
}
