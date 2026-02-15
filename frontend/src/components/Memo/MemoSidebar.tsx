import { useCallback } from "react";
import { PanelRight, BookOpen, StickyNote, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemoContext } from "../../hooks/useMemoContext";
import { NoteList } from "./NoteList";
import { formatTime } from "../../utils/formatRelativeDate";
import { getTodayKey, formatDisplayDate } from "../../utils/dateKey";
import { STORAGE_KEYS } from "../../constants/storageKeys";

type MemoTab = "daily" | "notes";

interface MemoSidebarProps {
  width: number;
  onToggle: () => void;
  activeTab: MemoTab;
  onTabChange: (tab: MemoTab) => void;
}

export function MemoSidebar({
  width,
  onToggle,
  activeTab,
  onTabChange,
}: MemoSidebarProps) {
  const { t } = useTranslation();
  const { memos, selectedDate, setSelectedDate, upsertMemo, deleteMemo } =
    useMemoContext();
  const todayKey = getTodayKey();
  const hasTodayMemo = memos.some((m) => m.date === todayKey);

  const handleTabChange = (tab: MemoTab) => {
    onTabChange(tab);
    localStorage.setItem(STORAGE_KEYS.MEMO_TAB, tab);
  };

  const handleCreateToday = useCallback(() => {
    setSelectedDate(todayKey);
    if (!memos.some((m) => m.date === todayKey)) {
      upsertMemo(todayKey, "");
    }
  }, [todayKey, setSelectedDate, memos, upsertMemo]);

  const handleDelete = useCallback(
    (date: string) => {
      deleteMemo(date);
      if (selectedDate === date) {
        setSelectedDate(todayKey);
      }
    },
    [deleteMemo, selectedDate, setSelectedDate, todayKey],
  );

  return (
    <div
      className="h-screen bg-notion-bg-subsidebar border-l border-notion-border flex flex-col"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[20px] font-semibold uppercase tracking-wider text-notion-text-secondary">
          Memo
        </span>
        <div className="flex items-center gap-1">
          {activeTab === "daily" && !hasTodayMemo && (
            <button
              onClick={handleCreateToday}
              className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("memo.daily")}
            >
              <Plus size={18} />
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <PanelRight size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => handleTabChange("daily")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "daily"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <BookOpen size={12} />
          {t("memo.daily")}
        </button>
        <button
          onClick={() => handleTabChange("notes")}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-colors ${
            activeTab === "notes"
              ? "bg-notion-accent/10 text-notion-accent font-medium"
              : "text-notion-text-secondary hover:bg-notion-hover"
          }`}
        >
          <StickyNote size={12} />
          {t("memo.notes")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "daily" && (
          <div className="px-1">
            {/* Today shortcut */}
            <button
              onClick={() => setSelectedDate(todayKey)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                selectedDate === todayKey
                  ? "bg-notion-accent/10 text-notion-accent font-medium"
                  : "text-notion-text hover:bg-notion-hover"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Today
            </button>

            {/* Date list */}
            {memos
              .filter((m) => m.date !== todayKey)
              .map((memo) => (
                <div key={memo.id} className="group relative">
                  <button
                    onClick={() => setSelectedDate(memo.date)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedDate === memo.date
                        ? "bg-notion-accent/10 text-notion-accent font-medium"
                        : "text-notion-text hover:bg-notion-hover"
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-notion-text-secondary/30 shrink-0" />
                    <span className="flex-1 text-left">
                      {formatDisplayDate(memo.date)}
                    </span>
                    {memo.updatedAt && (
                      <span className="text-[10px] text-notion-text-secondary/50 shrink-0">
                        {formatTime(memo.updatedAt)}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(memo.date);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-red-500 rounded transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {activeTab === "notes" && <NoteList embedded />}
      </div>
    </div>
  );
}
