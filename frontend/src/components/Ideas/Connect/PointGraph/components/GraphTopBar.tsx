import { useTranslation } from "react-i18next";
import { RotateCcw, Maximize2, Settings2, X, Filter } from "lucide-react";
import { IconButton } from "./primitives/IconButton";

interface GraphTopBarProps {
  zoomPct: number;
  nodeCount: number;
  totalCount: number;
  edgeCount: number;
  activeFilterCount: number;
  panelOpen: boolean;
  onClearFilters: () => void;
  onReheat: () => void;
  onResetView: () => void;
  onTogglePanel: () => void;
}

export function GraphTopBar({
  zoomPct,
  nodeCount,
  totalCount,
  edgeCount,
  activeFilterCount,
  panelOpen,
  onClearFilters,
  onReheat,
  onResetView,
  onTogglePanel,
}: GraphTopBarProps) {
  const { t } = useTranslation();
  return (
    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 px-3 py-1.5 rounded-lg bg-notion-bg border border-notion-border">
        <span className="text-[12px] text-notion-text-secondary">
          {t("connect.title")}
        </span>
        <span className="text-[11px] font-mono text-notion-text-secondary">
          {nodeCount}/{totalCount}n · {edgeCount}e
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            title={t("connect.graph.clearFilters")}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border border-notion-border text-notion-accent hover:bg-notion-hover"
          >
            <Filter size={9} />
            {activeFilterCount}
            <X size={9} />
          </button>
        )}
        <span className="text-[10px] font-mono text-notion-text-secondary">
          {zoomPct}%
        </span>
      </div>

      <div className="pointer-events-auto flex gap-1.5">
        <IconButton onClick={onReheat} title={t("connect.graph.reheat")}>
          <RotateCcw size={14} />
        </IconButton>
        <IconButton onClick={onResetView} title={t("connect.graph.resetView")}>
          <Maximize2 size={14} />
        </IconButton>
        <IconButton
          onClick={onTogglePanel}
          title={t("connect.graph.togglePanel")}
          active={panelOpen}
          marker="panel-toggle"
        >
          {panelOpen ? <X size={14} /> : <Settings2 size={14} />}
        </IconButton>
      </div>
    </div>
  );
}
