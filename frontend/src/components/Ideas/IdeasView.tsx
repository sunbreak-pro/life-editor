import { useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { BookOpen, StickyNote, Search, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { MemoDateList } from "./MemoDateList";
import { DailyMemoView } from "./DailyMemoView";
import { NoteList } from "./NoteList";
import { NotesView } from "./NotesView";
import { SearchTabView } from "./SearchTabView";
import { TagsTabView } from "./TagsTabView";
import { useMemoContext } from "../../hooks/useMemoContext";
import { getTodayKey } from "../../utils/dateKey";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type IdeasTab = "daily" | "notes" | "search" | "tags";

const IDEAS_TABS: readonly TabItem<IdeasTab>[] = [
  { id: "daily", labelKey: "ideas.daily", icon: BookOpen },
  { id: "notes", labelKey: "ideas.notes", icon: StickyNote },
  { id: "search", labelKey: "ideas.search", icon: Search },
  { id: "tags", labelKey: "ideas.tags", icon: Tag },
];

interface IdeasViewProps {
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToMemo?: (date: string) => void;
  onNavigateToNote?: (noteId: string) => void;
}

export function IdeasView({
  onNavigateToTask,
  onNavigateToMemo,
  onNavigateToNote,
}: IdeasViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<IdeasTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.IDEAS_TAB);
    if (saved === "notes" || saved === "search" || saved === "tags")
      return saved;
    return "daily";
  });

  const { memos, selectedDate, setSelectedDate, upsertMemo, deleteMemo } =
    useMemoContext();
  const todayKey = getTodayKey();

  const handleTabChange = (tab: IdeasTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, tab);
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
    ) : activeTab === "notes" ? (
      <NoteList />
    ) : null;

  const renderContent = () => {
    switch (activeTab) {
      case "daily":
        return <DailyMemoView />;
      case "notes":
        return <NotesView />;
      case "search":
        return (
          <SearchTabView
            onNavigateToTask={onNavigateToTask}
            onNavigateToMemo={onNavigateToMemo}
            onNavigateToNote={onNavigateToNote}
          />
        );
      case "tags":
        return <TagsTabView />;
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("ideas.title")}
        tabs={IDEAS_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {rightSidebarTarget &&
        listElement &&
        createPortal(listElement, rightSidebarTarget)}
      <div className="flex-1 overflow-hidden flex">
        {!rightSidebarTarget && listElement && (
          <div
            className={`${activeTab === "daily" ? "w-60" : "w-64"} shrink-0 border-r border-notion-border`}
          >
            {listElement}
          </div>
        )}
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}
