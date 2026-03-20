import { Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DriftResult } from "../../types/chaos";

interface DriftCardProps {
  data: DriftResult;
  onClick: () => void;
}

export function DriftCard({ data, onClick }: DriftCardProps) {
  const { t } = useTranslation();

  const pathDisplay = data.path.map((p) => p.tagName).join(" → ");

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-notion-hover/40 hover:bg-notion-hover/70 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Shuffle size={14} className="text-purple-500 shrink-0" />
        <span className="text-scaling-xs font-medium text-notion-text-secondary truncate">
          {t("chaos.drift.title")}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-scaling-xs text-notion-text truncate">
          {data.origin.title}
        </p>
        <p className="text-scaling-xs text-notion-text-secondary truncate">
          → {pathDisplay} →
        </p>
        <p className="text-scaling-xs text-notion-text truncate">
          {data.destination.title}
        </p>
      </div>
    </button>
  );
}
