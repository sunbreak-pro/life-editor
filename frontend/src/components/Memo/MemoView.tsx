import { useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { BookOpen, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { MemoDateList } from "./MemoDateList";
import { DailyMemoView } from "./DailyMemoView";
import { NoteList } from "./NoteList";
import { NotesView } from "./NotesView";
import { useMemoContext } from "../../hooks/useMemoContext";
import { getTodayKey } from "../../utils/dateKey";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

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

  const handleCreateForDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      if (!memos.some((m) => m.date === date)) {
        upsertMemo(date, "");
      }
    },
    [setSelectedDate, memos, upsertMemo],
  );

  const handleDelete = useCallback(
    (date: string) => {
      deleteMemo(date);
      if (selectedDate === date) {
        setSelectedDate(todayKey);
      }
    },
    [deleteMemo, selectedDate, setSelectedDate, todayKey],
  );

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const listElement =
    activeTab === "daily" ? (
      <MemoDateList
        memos={memos}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelectDate={setSelectedDate}
        onCreateForDate={handleCreateForDate}
        onDelete={handleDelete}
      />
    ) : (
      <NoteList />
    );

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("memo.title")}
        tabs={MEMO_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {rightSidebarTarget && createPortal(listElement, rightSidebarTarget)}
      <div className="flex-1 overflow-hidden flex">
        {!rightSidebarTarget && (
          <div
            className={`${activeTab === "daily" ? "w-60" : "w-64"} shrink-0 border-r border-notion-border`}
          >
            {listElement}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {activeTab === "daily" ? <DailyMemoView /> : <NotesView />}
        </div>
      </div>
    </div>
  );
}
