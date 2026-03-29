import { useTranslation } from "react-i18next";
import { StickyNote, Type, Frame, Plus, Trash2 } from "lucide-react";

interface PaperToolbarProps {
  onAddCard: () => void;
  onAddText: () => void;
  onAddFrame: () => void;
  selectedNodeCount?: number;
  onDeleteSelected?: () => void;
}

export function PaperToolbar({
  onAddCard,
  onAddText,
  onAddFrame,
  selectedNodeCount = 0,
  onDeleteSelected,
}: PaperToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 bg-notion-bg border border-notion-border rounded-lg shadow-sm px-1 py-0.5">
      <button
        onClick={onAddCard}
        className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text hover:bg-notion-hover rounded"
        title={t("ideas.addCard")}
      >
        <Plus size={12} />
        <StickyNote size={12} />
      </button>
      <button
        onClick={onAddText}
        className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text hover:bg-notion-hover rounded"
        title={t("ideas.addTextBlock")}
      >
        <Plus size={12} />
        <Type size={12} />
      </button>
      <button
        onClick={onAddFrame}
        className="flex items-center gap-1 px-2 py-1 text-xs text-notion-text hover:bg-notion-hover rounded"
        title={t("ideas.addFrame")}
      >
        <Plus size={12} />
        <Frame size={12} />
      </button>
      {selectedNodeCount > 0 && onDeleteSelected && (
        <>
          <div className="w-px h-4 bg-notion-border mx-0.5" />
          <button
            onClick={onDeleteSelected}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete selected"
          >
            <Trash2 size={12} />
            <span>{selectedNodeCount}</span>
          </button>
        </>
      )}
    </div>
  );
}
