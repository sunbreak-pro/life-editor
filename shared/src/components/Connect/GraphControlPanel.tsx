import { useState } from "react";
import {
  Search,
  Filter,
  Hash,
  Crosshair,
  Eye,
  EyeOff,
  Activity,
  FileText,
  Calendar,
  X,
  type LucideIcon,
} from "lucide-react";
import { SidebarFilterField } from "../materials/SidebarFilterField";
import type { WikiTag } from "../../types/wikiTagUnified";
import type { GraphNodeType } from "./graph/graph-types";
import { tagNodeId } from "./graph/graph-types";
import type { FilterState, TypeToggles } from "./graph/graph-filters";
import { ALL_TYPES } from "./graph/graph-filters";
import type { ForceParams } from "./graph/useGraphSimulation";
import { Section } from "./primitives/Section";
import { Slider } from "./primitives/Slider";
import { Toggle } from "./primitives/Toggle";
import type { ConnectGraphLabels } from "./labels";

const TYPE_ICON: Record<GraphNodeType, LucideIcon> = {
  note: FileText,
  daily: Calendar,
  tag: Hash,
};

interface GraphControlPanelProps {
  labels: ConnectGraphLabels;
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
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  /**
   * Mobile settings-sheet mode: drop the Desktop-only Local Graph section
   * (the peek sheet already carries a depth chip row) and the keyboard-shortcut
   * hints footer (no physical keyboard on touch). Desktop omits it → false →
   * the full panel, unchanged.
   */
  compact?: boolean;
}

export function GraphControlPanel({
  labels,
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
  searchInputRef,
  compact = false,
}: GraphControlPanelProps) {
  const typeLabel: Record<GraphNodeType, string> = {
    note: labels.typeNote,
    daily: labels.typeDaily,
    tag: labels.typeTag,
  };

  // Tag name filter (#519 — the same narrowing the tag master list got in
  // #368). Local UI state on purpose: it changes which pills are on screen,
  // never which tags are ACTIVE. `filter.activeTags` is the graph's own
  // selection and stays untouched, so narrowing the list cannot silently
  // change what the canvas shows — a tag filtered out of view keeps filtering
  // the graph, and clearing the query brings its pill straight back.
  const [tagQuery, setTagQuery] = useState("");
  // Same needle rule as TagEditModal / TagPicker: trimmed, case-insensitive
  // substring, so "filtering tags" means one thing across the app.
  const needle = tagQuery.trim().toLowerCase();
  const visibleTags = needle
    ? tags.filter((tag) => tag.name.toLowerCase().includes(needle))
    : tags;

  // Pure content — the floating frame / outside-click / close affordance are
  // gone (the shell rightSidebar owns open/close now). This renders straight
  // into the "Graph settings" tab well of <ConnectSidebarPanel>.
  return (
    <div className="flex flex-col gap-5">
      <Section title={labels.search} icon={Search}>
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-lumen-text-secondary"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={filter.search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={labels.search}
            className="w-full pl-7 pr-7 py-1.5 rounded-md text-xs bg-lumen-bg border border-lumen-border text-lumen-text outline-none focus:border-lumen-accent"
          />
          {filter.search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={labels.clearSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-lumen-text-secondary hover:bg-lumen-hover"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </Section>

      <Section title={labels.nodeTypes} icon={Filter}>
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
                    ? "bg-lumen-hover border-lumen-border"
                    : "border-transparent opacity-50 hover:bg-lumen-hover")
                }
              >
                <span className="flex items-center gap-2">
                  <Icon
                    size={11}
                    className={
                      active ? "text-lumen-text" : "text-lumen-text-secondary"
                    }
                  />
                  <span
                    className={
                      "text-xs " +
                      (active ? "text-lumen-text" : "text-lumen-text-secondary")
                    }
                  >
                    {typeLabel[key]}
                  </span>
                </span>
                <span className="font-mono text-xs text-lumen-text-secondary">
                  {typeCounts[key] || 0}/{totalTypeCounts[key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        title={labels.tags}
        icon={Hash}
        count={
          filter.activeTags.size > 0
            ? `${filter.activeTags.size}/${tags.length}`
            : tags.length
        }
      >
        {/* Hidden while there is nothing to narrow (#368 parity) — an empty
            section should read as "no tags", not as a search that found none.
            The copy is deliberately NOT `labels.search`: that field above
            searches graph NODES, and two identically-labelled inputs one
            section apart is exactly the confusion #519 was filed about. */}
        {tags.length > 0 && (
          <SidebarFilterField
            value={tagQuery}
            onChange={setTagQuery}
            placeholder={labels.tagFilterPlaceholder}
            ariaLabel={labels.tagFilterLabel}
            size="sm"
          />
        )}
        {filter.activeTags.size > 0 && (
          <button
            type="button"
            onClick={onClearTags}
            className="text-xs underline text-lumen-accent"
          >
            {labels.clearFilters}
          </button>
        )}
        {tags.length > 0 && visibleTags.length === 0 && (
          <div className="text-xs text-lumen-text-tertiary">
            {labels.tagFilterEmpty}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => {
            const id = tagNodeId(tag.id);
            const active = filter.activeTags.has(id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(id)}
                aria-pressed={active}
                className={
                  "px-1.5 py-0.5 rounded text-xs font-mono border transition-colors " +
                  (active
                    ? "border-lumen-accent text-lumen-accent bg-lumen-hover"
                    : "border-lumen-border text-lumen-text-secondary hover:bg-lumen-hover")
                }
              >
                #{tag.name}
              </button>
            );
          })}
        </div>
      </Section>

      {!compact && (
        <Section title={labels.localGraph} icon={Crosshair}>
          {selectedLabel ? (
            <>
              <div className="text-xs text-lumen-text-secondary">
                {selectedLabel}
              </div>
              <Slider
                label={labels.depth}
                value={filter.localDepth}
                onChange={onLocalDepthChange}
                min={0}
                max={2}
                suffix={filter.localDepth === 0 ? ` (${labels.off})` : "-hop"}
              />
            </>
          ) : (
            <div className="text-xs px-2 py-2 rounded bg-lumen-hover text-lumen-text-secondary">
              {labels.selectNodeHint}
            </div>
          )}
        </Section>
      )}

      <Section title={labels.display} icon={Eye}>
        <Toggle
          label={labels.showOrphans}
          value={filter.showOrphans}
          onChange={onShowOrphansChange}
          icon={filter.showOrphans ? Eye : EyeOff}
        />
        <Toggle
          label={labels.showLabels}
          value={showLabels}
          onChange={onShowLabelsChange}
          icon={FileText}
        />
      </Section>

      <Section title={labels.forces} icon={Activity} defaultOpen={false}>
        <Slider
          label={labels.repel}
          value={forces.repel}
          onChange={(v) => onForcesChange({ ...forces, repel: v })}
          min={-600}
          max={-30}
        />
        <Slider
          label={labels.linkDistance}
          value={forces.linkDist}
          onChange={(v) => onForcesChange({ ...forces, linkDist: v })}
          min={10}
          max={120}
          suffix="px"
        />
        <Slider
          label={labels.center}
          value={forces.centerStr}
          onChange={(v) => onForcesChange({ ...forces, centerStr: v })}
          min={0}
          max={0.3}
          step={0.01}
        />
        <Slider
          label={labels.collide}
          value={forces.collideStr}
          onChange={(v) => onForcesChange({ ...forces, collideStr: v })}
          min={0}
          max={2}
          step={0.05}
        />
      </Section>

      {!compact && (
        <div className="border-t border-lumen-border pt-2.5 text-xs text-lumen-text-tertiary">
          {labels.hintKeys}
        </div>
      )}
    </div>
  );
}
