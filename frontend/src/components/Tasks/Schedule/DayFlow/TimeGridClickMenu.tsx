import { useTranslation } from "react-i18next";
import {
  ListTodo,
  CalendarDays,
  CalendarClock,
  StickyNote,
} from "lucide-react";

interface TimeGridClickMenuProps {
  position: { x: number; y: number };
  onSelectTask: () => void;
  onSelectEvent: () => void;
  onSelectRoutine: () => void;
  onSelectNote?: () => void;
  onClose: () => void;
}

export function TimeGridClickMenu({
  position,
  onSelectTask,
  onSelectEvent,
  onSelectRoutine,
  onSelectNote,
  onClose,
}: TimeGridClickMenuProps) {
  const { t } = useTranslation();

  // Position with viewport clamping
  const menuWidth = 180;
  const menuHeight = onSelectNote ? 160 : 120;
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
          onClick={onSelectTask}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <ListTodo size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectTask", "Select Task")}
        </button>
        <button
          onClick={onSelectEvent}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <CalendarDays size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectEvent", "Select Event")}
        </button>
        <button
          onClick={onSelectRoutine}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
        >
          <CalendarClock size={14} className="text-notion-text-secondary" />
          {t("dayFlow.selectRoutine", "Select Routine")}
        </button>
        {onSelectNote && (
          <button
            onClick={onSelectNote}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-notion-text hover:bg-notion-hover transition-colors text-left"
          >
            <StickyNote size={14} className="text-notion-text-secondary" />
            {t("dayFlow.selectNote", "Select Note")}
          </button>
        )}
      </div>
    </div>
  );
}
