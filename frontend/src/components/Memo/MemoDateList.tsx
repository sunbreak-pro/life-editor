import { Plus, Trash2 } from "lucide-react";
import type { MemoNode } from "../../types/memo";
import { formatTime } from "../../utils/formatRelativeDate";
import { formatDisplayDate } from "../../utils/dateKey";

interface MemoDateListProps {
  memos: MemoNode[];
  selectedDate: string;
  todayKey: string;
  onSelectDate: (date: string) => void;
  onCreateToday: () => void;
  onDelete: (date: string) => void;
}

export function MemoDateList({
  memos,
  selectedDate,
  todayKey,
  onSelectDate,
  onCreateToday,
  onDelete,
}: MemoDateListProps) {
  const hasTodayMemo = memos.some((m) => m.date === todayKey);

  return (
    <div className="w-60 shrink-0 border-r border-notion-border h-full flex flex-col">
      <div className="p-3 border-b border-notion-border">
        <div className="flex items-center justify-end">
          {!hasTodayMemo && (
            <button
              onClick={onCreateToday}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title="Create today's memo"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {/* Today shortcut - always visible */}
        <button
          onClick={() => onSelectDate(todayKey)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            selectedDate === todayKey
              ? "bg-notion-hover text-notion-text font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Today
        </button>

        {/* Memo date list */}
        {memos
          .filter((m) => m.date !== todayKey)
          .map((memo) => (
            <div key={memo.id} className="group relative">
              <button
                onClick={() => onSelectDate(memo.date)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedDate === memo.date
                    ? "bg-notion-hover text-notion-text font-medium"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-notion-text-secondary/30 shrink-0" />
                <span className="flex-1">{formatDisplayDate(memo.date)}</span>
                {memo.updatedAt && (
                  <span className="text-[10px] text-notion-text-secondary/50 shrink-0">
                    {formatTime(memo.updatedAt)}
                  </span>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(memo.date);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-red-500 rounded transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
