import { useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { BookOpen, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { DailyMemoView } from "../Ideas/DailyMemoView";
import { NotesView } from "../Ideas/NotesView";
import { DailySidebar } from "../Ideas/DailySidebar";
import { MaterialsSidebar } from "../Ideas/MaterialsSidebar";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type MaterialsTab = "daily" | "notes";

const MATERIALS_TABS: readonly TabItem<MaterialsTab>[] = [
  { id: "daily", labelKey: "ideas.daily", icon: BookOpen },
  { id: "notes", labelKey: "ideas.notes", icon: StickyNote },
];

function loadMaterialsTab(): MaterialsTab {
  const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_TAB);
  if (saved === "daily") return "daily";
  if (saved === "notes") return "notes";
  // Migrate from old IDEAS_TAB
  const oldTab = localStorage.getItem(STORAGE_KEYS.IDEAS_TAB);
  if (oldTab === "daily") return "daily";
  if (
    oldTab === "materials" ||
    oldTab === "notes" ||
    oldTab === "search" ||
    oldTab === "tags"
  )
    return "notes";
  return "notes";
}

interface MaterialsViewProps {
  onNavigateToNote?: (noteId: string) => void;
}

export function MaterialsView({ onNavigateToNote }: MaterialsViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MaterialsTab>(loadMaterialsTab);

  const { memos, selectedDate, setSelectedDate, upsertMemo, deleteMemo } =
    useMemoContext();
  const {
    notes,
    flattenedNotes,
    expandedIds,
    toggleExpanded,
    selectedNoteId,
    setSelectedNoteId,
    createNote,
    createFolder,
    softDeleteNote,
    updateNote,
    persistWithHistory,
  } = useNoteContext();
  const { assignments, tags } = useWikiTags();

  const handleTabChange = (tab: MaterialsTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, tab);
  };

  const handleSelectDailyDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      if (!memos.some((m) => m.date === date)) {
        upsertMemo(date, "");
      }
    },
    [setSelectedDate, memos, upsertMemo],
  );

  const handleSelectMaterialsNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
    },
    [setSelectedNoteId],
  );

  const handleCreateNoteMaterials = useCallback(() => {
    const noteId = createNote();
    setSelectedNoteId(noteId);
  }, [createNote, setSelectedNoteId]);

  const handleCreateFolder = useCallback(() => {
    createFolder();
  }, [createFolder]);

  const handleUpdateNoteTitle = useCallback(
    (noteId: string, title: string) => {
      updateNote(noteId, { title });
    },
    [updateNote],
  );

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const renderSidebar = () => {
    switch (activeTab) {
      case "daily":
        return (
          <DailySidebar
            memos={memos}
            assignments={assignments}
            tags={tags}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDailyDate}
            onDeleteMemo={deleteMemo}
          />
        );
      case "notes":
        return (
          <MaterialsSidebar
            notes={notes}
            flattenedNotes={flattenedNotes}
            expandedIds={expandedIds}
            assignments={assignments}
            tags={tags}
            selectedNoteId={selectedNoteId}
            onSelectNote={handleSelectMaterialsNote}
            onCreateNote={handleCreateNoteMaterials}
            onCreateFolder={handleCreateFolder}
            onDeleteNote={softDeleteNote}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            onToggleExpand={toggleExpanded}
            persistWithHistory={persistWithHistory}
          />
        );
    }
  };

  const listElement = renderSidebar();

  const renderContent = () => {
    switch (activeTab) {
      case "daily":
        return <DailyMemoView />;
      case "notes":
        return <NotesView />;
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}
    >
      <SectionHeader
        title={t("materials.title")}
        tabs={MATERIALS_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {rightSidebarTarget &&
        listElement &&
        createPortal(listElement, rightSidebarTarget)}
      <div className="flex-1 overflow-hidden flex">
        {!rightSidebarTarget && listElement && (
          <div className="w-64 shrink-0 border-r border-notion-border">
            {listElement}
          </div>
        )}
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}
