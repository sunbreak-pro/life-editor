import { useState } from "react";
import { BookOpen, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import { SectionTabs, type TabItem } from "../shared/SectionTabs";
import { MemoDateList } from "./MemoDateList";
import { DailyMemoView } from "./DailyMemoView";
import { NoteList } from "./NoteList";
import { NotesView } from "./NotesView";
import { useMemoContext } from "../../hooks/useMemoContext";
import { getTodayKey } from "../../utils/dateKey";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useCallback } from "react";

type MemoTab = "daily" | "notes";

const MEMO_TABS: readonly TabItem<MemoTab>[] = [
  { id: "daily", labelKey: "memo.daily", icon: BookOpen },
  { id: "notes", labelKey: "memo.notes", icon: StickyNote },
];

export function MemoView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MemoTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMO_TAB);
    return saved === "notes" ? "notes" : "daily";
  });

  const { memos, selectedDate, setSelectedDate, upsertMemo, deleteMemo } =
    useMemoContext();
  const todayKey = getTodayKey();

  const handleTabChange = (tab: MemoTab) => {
    setActiveTab(tab);
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
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <div className="flex items-baseline gap-4 border-b border-notion-border mb-5">
        <h2 className="text-2xl font-bold text-notion-text">
          {t("memo.title")}
        </h2>
        <SectionTabs
          tabs={MEMO_TABS}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          noBorder
        />
      </div>
      <div className="flex-1 overflow-hidden flex">
        {activeTab === "daily" && (
          <>
            <MemoDateList
              memos={memos}
              selectedDate={selectedDate}
              todayKey={todayKey}
              onSelectDate={setSelectedDate}
              onCreateToday={handleCreateToday}
              onDelete={handleDelete}
            />
            <div className="flex-1 min-w-0">
              <DailyMemoView />
            </div>
          </>
        )}
        {activeTab === "notes" && (
          <>
            <NoteList />
            <div className="flex-1 min-w-0">
              <NotesView />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
