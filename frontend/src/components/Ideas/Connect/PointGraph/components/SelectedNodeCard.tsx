import { useTranslation } from "react-i18next";
import {
  Folder,
  FileText,
  Calendar,
  Hash,
  X,
  Link2,
  Crosshair,
  type LucideIcon,
} from "lucide-react";
import type { GraphNode, GraphNodeType } from "../lib/graph-types";
import { isTagNodeId } from "../lib/graph-types";
import { UnifiedColorPicker } from "../../../../shared/UnifiedColorPicker";

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface SelectedNodeCardProps {
  node: GraphNode;
  neighbors: GraphNode[];
  localDepth: number;
  onLocalDepthChange: (d: number) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** double-click / open intent (note/daily navigation) */
  onActivate?: (id: string) => void;
  /** change note/project color (omitted for daily/tag) */
  onColorChange?: (id: string, color: string) => void;
}

export function SelectedNodeCard({
  node,
  neighbors,
  localDepth,
  onLocalDepthChange,
  onSelect,
  onClose,
  onActivate,
  onColorChange,
}: SelectedNodeCardProps) {
  const { t } = useTranslation();
  const Icon = TYPE_ICON[node.type];
  const canRecolor =
    !!onColorChange && (node.type === "note" || node.type === "project");
  const linkCount = neighbors.filter((n) => !isTagNodeId(n.id)).length;
  const tagCount = neighbors.filter((n) => isTagNodeId(n.id)).length;

  return (
    <div className="absolute bottom-3 left-3 w-80 rounded-lg bg-notion-bg border border-notion-border p-3.5 space-y-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-notion-hover text-notion-text">
            <Icon size={14} />
          </span>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onActivate?.(node.id)}
              disabled={!onActivate || node.type === "tag"}
              className="text-[13px] font-medium truncate text-notion-text text-left hover:underline disabled:hover:no-underline disabled:cursor-default"
            >
              {node.label}
            </button>
            <div className="text-[10px] font-mono truncate text-notion-text-secondary">
              {node.id}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("connect.graph.clearFilters")}
          className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-notion-text-secondary hover:bg-notion-hover"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-notion-text-secondary">
        <span className="flex items-center gap-1">
          <Link2 size={10} /> {linkCount} {t("connect.graph.links")}
        </span>
        <span className="flex items-center gap-1">
          <Hash size={10} /> {tagCount} {t("connect.graph.tagsShort")}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] pt-1 border-t border-notion-border">
        <Crosshair size={10} className="text-notion-accent" />
        <span className="text-notion-text-secondary">
          {t("connect.graph.localGraph")}:
        </span>
        {[0, 1, 2].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onLocalDepthChange(d)}
            aria-pressed={localDepth === d}
            className={
              "px-1.5 py-0.5 rounded font-mono border transition-colors " +
              (localDepth === d
                ? "border-notion-accent text-notion-accent bg-notion-hover"
                : "border-notion-border text-notion-text-secondary hover:bg-notion-hover")
            }
          >
            {d === 0 ? t("connect.graph.off") : `${d}-hop`}
          </button>
        ))}
      </div>

      {canRecolor && (
        <div className="space-y-1 pt-1 border-t border-notion-border">
          <div className="text-[10px] uppercase tracking-wider text-notion-text-secondary">
            {t("ideas.noteColor")}
          </div>
          <UnifiedColorPicker
            color={node.color || "#D5E8F5"}
            onChange={(c) => onColorChange?.(node.id, c)}
            mode="preset-full"
            inline
          />
        </div>
      )}

      {neighbors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-notion-text-secondary">
            {t("connect.graph.connections")}
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
            {neighbors.map((n) => {
              const NIcon = TYPE_ICON[n.type];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-notion-hover text-left"
                >
                  <NIcon
                    size={11}
                    className="text-notion-text-secondary shrink-0"
                  />
                  <span className="text-[11px] truncate text-notion-text">
                    {n.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
