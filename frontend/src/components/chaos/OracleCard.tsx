import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OracleResult } from "../../types/chaos";

interface OracleCardProps {
  data: OracleResult;
  onClick: () => void;
}

export function OracleCard({ data, onClick }: OracleCardProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-notion-hover/40 hover:bg-notion-hover/70 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles size={14} className="text-amber-500 shrink-0" />
        <span className="text-scaling-xs font-medium text-notion-text-secondary truncate">
          {t("chaos.oracle.title")}
        </span>
      </div>
      <p className="text-scaling-xs text-notion-text line-clamp-2 leading-relaxed">
        {data.preview}
      </p>
      <p className="text-scaling-xs text-notion-text-secondary mt-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {data.entityType === "memo"
          ? t("chaos.source.memo", { date: data.title })
          : t("chaos.source.note", { title: data.title })}
      </p>
    </button>
  );
}
