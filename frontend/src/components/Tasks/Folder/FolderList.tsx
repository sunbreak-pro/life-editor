import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { FlatFolder } from "../../../utils/flattenFolders";

interface FolderListProps {
  folders: FlatFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  rootLabel: string;
  maxHeightClass?: string;
  fontSizeClass?: string;
  indentPx?: (depth: number) => number;
  depthIndicator?: (depth: number) => ReactNode;
  bordered?: boolean;
}

export function FolderList({
  folders,
  selectedId,
  onSelect,
  rootLabel,
  maxHeightClass = "max-h-60",
  fontSizeClass = "text-xs",
  indentPx = (d) => 12 + d * 14,
  depthIndicator = (d: number) =>
    d > 0 ? (
      <ChevronRight size={10} className="mr-1 text-notion-text-secondary/50" />
    ) : null,
  bordered = false,
}: FolderListProps) {
  const selectedStyle = "bg-notion-accent/10 text-notion-accent font-medium";
  const normalStyle = "text-notion-text hover:bg-notion-hover";
  const containerClass = bordered
    ? `${maxHeightClass} overflow-y-auto border border-notion-border rounded-md`
    : `${maxHeightClass} overflow-y-auto`;

  return (
    <div className={containerClass}>
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-1.5 ${fontSizeClass} transition-colors ${
          selectedId === null ? selectedStyle : normalStyle
        }`}
      >
        {rootLabel}
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          className={`w-full text-left py-1.5 ${fontSizeClass} transition-colors flex items-center ${
            selectedId === f.id ? selectedStyle : normalStyle
          }`}
          style={{ paddingLeft: `${indentPx(f.depth)}px`, paddingRight: 12 }}
        >
          {depthIndicator?.(f.depth)}
          <span className="truncate">{f.title}</span>
        </button>
      ))}
    </div>
  );
}
