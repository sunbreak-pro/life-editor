import { useTranslation } from "react-i18next";
import { StickyNote, Type, Frame, Plus } from "lucide-react";

interface PaperToolbarProps {
  onAddCard: () => void;
  onAddText: () => void;
  onAddFrame: () => void;
}

export function PaperToolbar({
  onAddCard,
  onAddText,
  onAddFrame,
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
    </div>
  );
}
