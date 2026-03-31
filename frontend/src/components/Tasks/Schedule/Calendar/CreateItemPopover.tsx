import { useRef, useState, useLayoutEffect } from "react";
import { ListTodo, FileText, BookOpen, CalendarClock } from "lucide-react";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { useTranslation } from "react-i18next";

interface CreateItemPopoverProps {
  position: { x: number; y: number };
  onSelectTask: () => void;
  onSelectNote: () => void;
  onSelectDaily: () => void;
  onSelectEvent: () => void;
  onClose: () => void;
}

const ITEMS = [
  { key: "task", icon: ListTodo, labelKey: "calendar.createTask" },
  { key: "note", icon: FileText, labelKey: "calendar.createNote" },
  { key: "daily", icon: BookOpen, labelKey: "calendar.createDaily" },
  { key: "event", icon: CalendarClock, labelKey: "calendar.createEvent" },
] as const;

export function CreateItemPopover({
  position,
  onSelectTask,
  onSelectNote,
  onSelectDaily,
  onSelectEvent,
  onClose,
}: CreateItemPopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState(position);
  useClickOutside(ref, onClose, true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const x = Math.max(
      pad,
      Math.min(position.x, window.innerWidth - rect.width - pad),
    );
    const y = Math.max(
      pad,
      Math.min(position.y, window.innerHeight - rect.height - pad),
    );
    setAdjusted({ x, y });
  }, [position]);

  const handlers: Record<string, () => void> = {
    task: onSelectTask,
    note: onSelectNote,
    daily: onSelectDaily,
    event: onSelectEvent,
  };

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ left: adjusted.x, top: adjusted.y }}
    >
      {ITEMS.map(({ key, icon: Icon, labelKey }) => (
        <button
          key={key}
          onClick={() => {
            handlers[key]();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-notion-text hover:bg-notion-hover transition-colors"
        >
          <Icon size={14} className="text-notion-text-secondary" />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
