import { useTranslation } from "react-i18next";
import {
  Search,
  Filter,
  Hash,
  Crosshair,
  Eye,
  EyeOff,
  Activity,
  FileText,
  Folder,
  Calendar,
  X,
  type LucideIcon,
} from "lucide-react";
import type { WikiTag } from "../../../../../types/wikiTag";
import type { GraphNodeType } from "../lib/graph-types";
import { tagNodeId } from "../lib/graph-types";
import type { FilterState, TypeToggles } from "../lib/graph-filters";
import { ALL_TYPES } from "../lib/graph-filters";
import type { ForceParams } from "../hooks/usePointGraphSimulation";
import { Section } from "./primitives/Section";
import { Slider } from "./primitives/Slider";
import { Toggle } from "./primitives/Toggle";

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  project: Folder,
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface GraphControlPanelProps {
  filter: FilterState;
  onSearchChange: (q: string) => void;
  onToggleType: (type: GraphNodeType) => void;
  onToggleTag: (tagNodeIdValue: string) => void;
  onClearTags: () => void;
  onLocalDepthChange: (d: number) => void;
  showLabels: boolean;
  onShowLabelsChange: (v: boolean) => void;
  onShowOrphansChange: (v: boolean) => void;
  forces: ForceParams;
  onForcesChange: (f: ForceParams) => void;
  tags: WikiTag[];
  typeCounts: Record<string, number>;
  totalTypeCounts: Record<string, number>;
  selectedLabel: string | null;
}

export function GraphControlPanel({
  filter,
  onSearchChange,
  onToggleType,
  onToggleTag,
  onClearTags,
  onLocalDepthChange,
  showLabels,
  onShowLabelsChange,
  onShowOrphansChange,
  forces,
  onForcesChange,
  tags,
  typeCounts,
  totalTypeCounts,
  selectedLabel,
}: GraphControlPanelProps) {
  const { t } = useTranslation();
  const typeLabel: Record<GraphNodeType, string> = {
    project: t("connect.graph.typeProject"),
    note: t("connect.graph.typeNote"),
    daily: t("connect.graph.typeDaily"),
    tag: t("connect.graph.typeTag"),
  };

  return (
    <aside className="absolute top-3 bottom-3 right-3 w-72 flex flex-col gap-5 p-4 overflow-y-auto rounded-lg bg-notion-bg border border-notion-border shadow-lg">
      <Section title={t("connect.graph.search")} icon={Search}>
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-notion-text-secondary"
          />
          <input
            type="text"
            value={filter.search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("connect.graph.search")}
            className="w-full pl-7 pr-7 py-1.5 rounded-md text-[12px] bg-notion-bg border border-notion-border text-notion-text outline-none focus:border-notion-accent"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-notion-text-secondary hover:bg-notion-hover"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </Section>

      <Section title={t("connect.graph.nodeTypes")} icon={Filter}>
        <div className="space-y-1">
          {ALL_TYPES.map((key) => {
            const Icon = TYPE_ICON[key];
            const active = filter.activeTypes[key as keyof TypeToggles];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleType(key)}
                aria-pressed={active}
                className={
                  "w-full flex items-center justify-between px-2 py-1.5 rounded border transition-colors " +
                  (active
                    ? "bg-notion-hover border-notion-border"
                    : "border-transparent opacity-50 hover:bg-notion-hover")
                }
              >
                <span className="flex items-center gap-2">
                  <Icon
                    size={11}
                    className={
                      active ? "text-notion-text" : "text-notion-text-secondary"
                    }
                  />
                  <span
                    className={
                      "text-[11px] " +
                      (active
                        ? "text-notion-text"
                        : "text-notion-text-secondary")
                    }
                  >
                    {typeLabel[key]}
                  </span>
                </span>
                <span className="font-mono text-[10px] text-notion-text-secondary">
                  {typeCounts[key] || 0}/{totalTypeCounts[key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title={t("connect.graph.tags")}
        icon={Hash}
        count={
          filter.activeTags.size > 0
            ? `${filter.activeTags.size}/${tags.length}`
            : tags.length
        }
      >
        {filter.activeTags.size > 0 && (
          <button
            type="button"
            onClick={onClearTags}
            className="text-[10px] underline text-notion-accent"
          >
            {t("connect.graph.clearFilters")}
          </button>
        )}
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const id = tagNodeId(tag.id);
            const active = filter.activeTags.has(id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(id)}
                aria-pressed={active}
                className={
                  "px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors " +
                  (active
                    ? "border-notion-accent text-notion-accent bg-notion-hover"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover")
                }
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t("connect.graph.localGraph")} icon={Crosshair}>
        {selectedLabel ? (
          <>
            <div className="text-[10px] text-notion-text-secondary">
              {selectedLabel}
            </div>
            <Slider
              label={t("connect.graph.depth")}
              value={filter.localDepth}
              onChange={onLocalDepthChange}
              min={0}
              max={2}
              suffix={
                filter.localDepth === 0
                  ? ` (${t("connect.graph.off")})`
                  : "-hop"
              }
            />
          </>
        ) : (
          <div className="text-[10px] px-2 py-2 rounded bg-notion-hover text-notion-text-secondary">
            {t("connect.graph.selectNodeHint")}
          </div>
        )}
      </Section>

      <Section title={t("connect.graph.display")} icon={Eye}>
        <Toggle
          label={t("connect.graph.showOrphans")}
          value={filter.showOrphans}
          onChange={onShowOrphansChange}
          icon={filter.showOrphans ? Eye : EyeOff}
        />
        <Toggle
          label={t("connect.graph.showLabels")}
          value={showLabels}
          onChange={onShowLabelsChange}
          icon={FileText}
        />
      </Section>

      <Section
        title={t("connect.graph.forces")}
        icon={Activity}
        defaultOpen={false}
      >
        <Slider
          label={t("connect.graph.repel")}
          value={forces.repel}
          onChange={(v) => onForcesChange({ ...forces, repel: v })}
          min={-600}
          max={-30}
        />
        <Slider
          label={t("connect.graph.linkDistance")}
          value={forces.linkDist}
          onChange={(v) => onForcesChange({ ...forces, linkDist: v })}
          min={10}
          max={120}
          suffix="px"
        />
        <Slider
          label={t("connect.graph.center")}
          value={forces.centerStr}
          onChange={(v) => onForcesChange({ ...forces, centerStr: v })}
          min={0}
          max={0.3}
          step={0.01}
        />
        <Slider
          label={t("connect.graph.collide")}
          value={forces.collideStr}
          onChange={(v) => onForcesChange({ ...forces, collideStr: v })}
          min={0}
          max={2}
          step={0.05}
        />
      </Section>
    </aside>
  );
}
