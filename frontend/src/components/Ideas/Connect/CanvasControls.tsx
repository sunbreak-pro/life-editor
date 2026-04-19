import { useReactFlow } from "@xyflow/react";
import { ZoomIn, ZoomOut, Scan, Filter, Spline } from "lucide-react";

interface CanvasControlsProps {
  showFilter?: boolean;
  filterCount?: number;
  onFilterClick?: () => void;
  showConnect?: boolean;
  connectMode?: boolean;
  onToggleConnectMode?: () => void;
  connectLabel?: string;
}

export function CanvasControls({
  showFilter = false,
  filterCount = 0,
  onFilterClick,
  showConnect = false,
  connectMode = false,
  onToggleConnectMode,
  connectLabel,
}: CanvasControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => zoomIn()}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <ZoomIn size={14} />
      </button>
      <button
        onClick={() => zoomOut()}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={() => fitView({ padding: 0.3 })}
        className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
      >
        <Scan size={14} />
      </button>
      {showFilter && (
        <button
          onClick={() => onFilterClick?.()}
          className="p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover flex items-center gap-1"
        >
          <Filter size={14} />
          {filterCount > 0 && (
            <span className="text-[10px] font-medium text-notion-accent">
              {filterCount}
            </span>
          )}
        </button>
      )}
      {showConnect && (
        <button
          onClick={() => onToggleConnectMode?.()}
          title={connectLabel}
          aria-label={connectLabel}
          aria-pressed={connectMode}
          className={
            connectMode
              ? "p-1.5 rounded border border-notion-accent bg-notion-accent text-white shadow-sm"
              : "p-1.5 rounded bg-notion-bg border border-notion-border text-notion-text-secondary hover:bg-notion-hover"
          }
        >
          <Spline size={14} />
        </button>
      )}
    </div>
  );
}
