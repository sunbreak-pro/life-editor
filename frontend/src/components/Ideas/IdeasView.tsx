import { useState, useCallback, useContext } from "react";
import { createPortal } from "react-dom";
import { Package, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { DailyMemoView } from "./DailyMemoView";
import { NotesView } from "./NotesView";
import { ConnectTabView } from "./ConnectTabView";
import { MaterialsSidebar } from "./MaterialsSidebar";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type IdeasTab = "materials" | "connect";

type MaterialsView =
  | { type: "note"; noteId: string }
  | { type: "daily"; date: string };

const IDEAS_TABS: readonly TabItem<IdeasTab>[] = [
  { id: "materials", labelKey: "ideas.materials", icon: Package },
  { id: "connect", labelKey: "ideas.connect", icon: Network },
];

interface IdeasViewProps {
  onNavigateToNote?: (noteId: string) => void;
}

export function IdeasView({ onNavigateToNote }: IdeasViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<IdeasTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.IDEAS_TAB);
    if (saved === "connect") return "connect";
    // Migrate old tab values
    if (
      saved === "daily" ||
      saved === "notes" ||
      saved === "search" ||
      saved === "tags"
    )
      return "materials";
    return "materials";
  });

  const { memos, selectedDate, setSelectedDate, upsertMemo, deleteMemo } =
    useMemoContext();
  const {
    notes,
    selectedNoteId,
    setSelectedNoteId,
    createNote,
    softDeleteNote,
  } = useNoteContext();
  const {
    assignments,
    tags,
    groups,
    groupMembers,
    createGroup,
    updateGroup,
    deleteGroup,
    createTag,
    updateTag,
    deleteTag,
  } = useWikiTags();

  // Materials view state
  const [materialsView, setMaterialsView] = useState<MaterialsView>(() => {
    const savedType = localStorage.getItem(STORAGE_KEYS.MATERIALS_CONTENT_TYPE);
    if (savedType === "note" && selectedNoteId) {
      return { type: "note", noteId: selectedNoteId };
    }
    return { type: "daily", date: selectedDate };
  });

  const handleTabChange = (tab: IdeasTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, tab);
  };

  const handleSelectMaterialsView = useCallback(
    (view: MaterialsView) => {
      setMaterialsView(view);
      localStorage.setItem(STORAGE_KEYS.MATERIALS_CONTENT_TYPE, view.type);
      if (view.type === "note") {
        setSelectedNoteId(view.noteId);
      } else {
        setSelectedDate(view.date);
        if (!memos.some((m) => m.date === view.date)) {
          upsertMemo(view.date, "");
        }
      }
    },
    [setSelectedNoteId, setSelectedDate, memos, upsertMemo],
  );

  const handleCreateNote = useCallback(() => {
    const noteId = createNote();
    setMaterialsView({ type: "note", noteId });
    localStorage.setItem(STORAGE_KEYS.MATERIALS_CONTENT_TYPE, "note");
  }, [createNote]);

  // Cross-navigation: Materials → Connect with focus
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(
    null,
  );

  const handleNavigateToConnect = useCallback((noteId: string) => {
    setActiveTab("connect");
    localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, "connect");
    setPendingFocusNoteId(noteId);
  }, []);

  const handleFocusConsumed = useCallback(() => {
    setPendingFocusNoteId(null);
  }, []);

  // Navigate to note from Connect tab
  const handleNavigateToNote = useCallback(
    (noteId: string) => {
      setActiveTab("materials");
      localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, "materials");
      setMaterialsView({ type: "note", noteId });
      setSelectedNoteId(noteId);
      localStorage.setItem(STORAGE_KEYS.MATERIALS_CONTENT_TYPE, "note");
      onNavigateToNote?.(noteId);
    },
    [setSelectedNoteId, onNavigateToNote],
  );

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const listElement =
    activeTab === "materials" ? (
      <MaterialsSidebar
        memos={memos}
        notes={notes}
        assignments={assignments}
        tags={tags}
        selectedView={materialsView}
        onSelectView={handleSelectMaterialsView}
        onCreateNote={handleCreateNote}
        onDeleteNote={softDeleteNote}
        onDeleteMemo={deleteMemo}
        groups={groups}
        groupMembers={groupMembers}
        onCreateGroup={createGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={deleteGroup}
        onNavigateToConnect={handleNavigateToConnect}
        onCreateTag={createTag}
        onUpdateTag={updateTag}
        onDeleteTag={deleteTag}
      />
    ) : null;

  const renderContent = () => {
    switch (activeTab) {
      case "materials":
        if (materialsView.type === "note") {
          return <NotesView />;
        }
        return <DailyMemoView />;
      case "connect":
        return (
          <ConnectTabView
            onNavigateToNote={handleNavigateToNote}
            initialFocusNoteId={pendingFocusNoteId}
            onFocusConsumed={handleFocusConsumed}
          />
        );
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${activeTab === "connect" ? "" : `${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}`}
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
          <div className="w-64 shrink-0 border-r border-notion-border">
            {listElement}
          </div>
        )}
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}
