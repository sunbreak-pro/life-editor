import { Flame, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MilestoneToastProps {
  title: string;
  days: number;
  onDismiss: () => void;
}

export function MilestoneToast({
  title,
  days,
  onDismiss,
}: MilestoneToastProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="bg-notion-bg border border-amber-300 dark:border-amber-700 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-xs">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
          <Flame size={16} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-notion-text">
            {t("routine.milestoneReached", { days })}
          </p>
          <p className="text-xs text-notion-text-secondary truncate">{title}</p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
