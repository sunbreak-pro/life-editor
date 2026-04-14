import { useState, useCallback, useContext } from "react";
import { getDataService } from "../../services/dataServiceFactory";
import { useToast } from "../../context/ToastContext";
import { createPortal } from "react-dom";
import { BookOpen, StickyNote, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { DailyMemoView } from "../Ideas/DailyMemoView";
import { NotesView } from "../Ideas/NotesView";
import { TemplateContentView } from "../Ideas/TemplateContentView";
import { DailySidebar } from "../Ideas/DailySidebar";
import { MaterialsSidebar } from "../Ideas/MaterialsSidebar";
import { FileExplorerSidebar } from "./FileExplorerSidebar";
import { FileExplorerView } from "./FileExplorerView";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useTemplateContext } from "../../hooks/useTemplateContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type MaterialsTab = "daily" | "notes" | "files";

const MATERIALS_TABS: readonly TabItem<MaterialsTab>[] = [
  { id: "daily", labelKey: "ideas.daily", icon: BookOpen },
  { id: "notes", labelKey: "ideas.notes", icon: StickyNote },
  { id: "files", labelKey: "ideas.files", icon: FolderOpen },
];

function loadMaterialsTab(): MaterialsTab {
  const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS_TAB);
  if (saved === "daily") return "daily";
  if (saved === "notes") return "notes";
  if (saved === "files") return "files";
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
  const { getDefaultNoteContent, selectedTemplateId, setSelectedTemplateId } =
    useTemplateContext();
  const { assignments, tags } = useWikiTags();
  const { showToast } = useToast();

  const handleTabChange = (tab: MaterialsTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, tab);
  };

  const handleSelectDailyDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setSelectedTemplateId(null);
      if (!memos.some((m) => m.date === date)) {
        upsertMemo(date, "");
      }
    },
    [setSelectedDate, setSelectedTemplateId, memos, upsertMemo],
  );

  const handleSelectMaterialsNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
      setSelectedTemplateId(null);
    },
    [setSelectedNoteId, setSelectedTemplateId],
  );

  const handleCreateNoteMaterials = useCallback(() => {
    const initialContent = getDefaultNoteContent();
    const noteId = createNote(
      undefined,
      initialContent ? { initialContent } : undefined,
    );
    setSelectedNoteId(noteId);
  }, [createNote, setSelectedNoteId, getDefaultNoteContent]);

  const handleCreateFolder = useCallback(() => {
    createFolder();
  }, [createFolder]);

  const handleCreateNoteInFolder = useCallback(
    (parentId: string) => {
      const initialContent = getDefaultNoteContent();
      const noteId = createNote(undefined, {
        parentId,
        ...(initialContent ? { initialContent } : {}),
      });
      setSelectedNoteId(noteId);
      if (!expandedIds.has(parentId)) {
        toggleExpanded(parentId);
      }
    },
    [
      createNote,
      setSelectedNoteId,
      expandedIds,
      toggleExpanded,
      getDefaultNoteContent,
    ],
  );

  const handleCreateFolderInFolder = useCallback(
    (parentId: string) => {
      createFolder(undefined, parentId);
      if (!expandedIds.has(parentId)) {
        toggleExpanded(parentId);
      }
    },
    [createFolder, expandedIds, toggleExpanded],
  );

  const handleUpdateNoteTitle = useCallback(
    (noteId: string, title: string) => {
      updateNote(noteId, { title });
    },
    [updateNote],
  );

  const handleCopyNoteToFiles = useCallback(
    async (noteId: string) => {
      try {
        const ds = getDataService();
        const dir = await ds.selectFolder();
        if (!dir) return;
        const filePath = await ds.copyNoteToFile(noteId, dir);
        showToast("success", t("copy.copiedToFile", { path: filePath }));
      } catch (e) {
        showToast(
          "error",
          e instanceof Error ? e.message : t("copy.copyFailed"),
        );
      }
    },
    [showToast, t],
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
            onSelectTemplate={setSelectedTemplateId}
            selectedTemplateId={selectedTemplateId}
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
            onCreateNoteInFolder={handleCreateNoteInFolder}
            onCreateFolderInFolder={handleCreateFolderInFolder}
            onDeleteNote={softDeleteNote}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            onCopyToFiles={handleCopyNoteToFiles}
            onToggleExpand={toggleExpanded}
            persistWithHistory={persistWithHistory}
            onSelectTemplate={setSelectedTemplateId}
            selectedTemplateId={selectedTemplateId}
          />
        );
      case "files":
        return <FileExplorerSidebar />;
    }
  };

  const listElement = renderSidebar();

  const renderContent = () => {
    if (
      selectedTemplateId &&
      (activeTab === "daily" || activeTab === "notes")
    ) {
      return <TemplateContentView />;
    }
    switch (activeTab) {
      case "daily":
        return <DailyMemoView />;
      case "notes":
        return <NotesView />;
      case "files":
        return <FileExplorerView />;
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
