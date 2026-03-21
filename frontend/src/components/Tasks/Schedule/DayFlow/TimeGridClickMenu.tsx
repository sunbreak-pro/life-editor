import { useTranslation } from "react-i18next";
import { CalendarClock, ListTodo, FileText } from "lucide-react";

interface TimeGridClickMenuProps {
  position: { x: number; y: number };
  onSelectRoutine: () => void;
  onSelectTask: () => void;
  onSelectNote: () => void;
  onClose: () => void;
}

export function TimeGridClickMenu({
  position,
  onSelectRoutine,
  onSelectTask,
  onSelectNote,
  onClose,
}: TimeGridClickMenuProps) {
  const { t } = useTranslation();

  // Position with viewport clamping
  const menuWidth = 180;
  const menuHeight = 120;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(position.y, window.innerHeight - menuHeight - 8);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-notion-bg border border-notion-border rounded-lg shadow-xl overflow-hidden"
        style={{ top, left, width: menuWidth }}
      >
        <button
          onClick={onSelectRoutine}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <CalendarClock size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectRoutine", "Select Routine")}
        </button>
        <button
          onClick={onSelectTask}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <ListTodo size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectTask", "Select Task")}
        </button>
        <button
          onClick={onSelectNote}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <FileText size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectNote", "Select Note")}
        </button>
      </div>
    </div>
  );
}
