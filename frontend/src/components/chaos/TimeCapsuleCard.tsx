import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimeCapsuleResult } from "../../types/chaos";
import { useState } from "react";

interface TimeCapsuleCardProps {
  items: TimeCapsuleResult[];
  onClick: (item: TimeCapsuleResult) => void;
}

export function TimeCapsuleCard({ items, onClick }: TimeCapsuleCardProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = items[currentIndex];

  if (!current) return null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <button
      onClick={() => onClick(current)}
      className="w-full text-left p-3 rounded-lg bg-notion-hover/40 hover:bg-notion-hover/70 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Clock size={14} className="text-blue-500 shrink-0" />
        <span className="text-scaling-xs font-medium text-notion-text-secondary truncate">
          {t("chaos.timecapsule.label", { period: current.label })}
        </span>
        {items.length > 1 && (
          <span
            onClick={handleNext}
            className="ml-auto text-scaling-xs text-notion-text-secondary hover:text-notion-text cursor-pointer shrink-0"
          >
            {currentIndex + 1}/{items.length}
          </span>
        )}
      </div>
      <p className="text-scaling-xs text-notion-text line-clamp-2 leading-relaxed">
        {current.preview}
      </p>
      <p className="text-scaling-xs text-notion-text-secondary mt-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {current.entityType === "memo"
          ? t("chaos.source.memo", { date: current.title })
          : t("chaos.source.note", { title: current.title })}
      </p>
    </button>
  );
}
