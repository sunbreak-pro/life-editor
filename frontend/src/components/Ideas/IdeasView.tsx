import { useState, useCallback, useContext, useEffect } from "react";
import { getDataService } from "../../services/dataServiceFactory";
import { useToast } from "../../context/ToastContext";
import { createPortal } from "react-dom";
import { BookOpen, StickyNote, GitBranch, LayoutGrid } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { LAYOUT } from "../../constants/layout";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { DailyMemoView } from "./DailyMemoView";
import { NotesView } from "./NotesView";
import { TemplateContentView } from "./TemplateContentView";
import { TagGraphView } from "./Connect/TagGraphView";
import { ConnectSidebar } from "./Connect/ConnectSidebar";
import { PaperCanvasView } from "./Connect/Paper/PaperCanvasView";
import { PaperSidebar } from "./Connect/Paper/PaperSidebar";
import { DailySidebar } from "./DailySidebar";
import { MaterialsSidebar } from "./MaterialsSidebar";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useTemplateContext } from "../../hooks/useTemplateContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useNoteConnections } from "../../hooks/useNoteConnections";
import { useConnectSearch } from "../../hooks/useConnectSearch";
import { usePaperBoard } from "../../hooks/usePaperBoard";
import { useUndoRedo } from "../shared/UndoRedo";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type IdeasTab = "daily" | "materials" | "node" | "board";

const IDEAS_TABS: readonly TabItem<IdeasTab>[] = [
  { id: "daily", labelKey: "ideas.daily", icon: BookOpen },
  { id: "materials", labelKey: "ideas.notes", icon: StickyNote },
  { id: "node", labelKey: "ideas.node", icon: GitBranch },
  { id: "board", labelKey: "ideas.board", icon: LayoutGrid },
];

function loadIdeasTab(): IdeasTab {
  const saved = localStorage.getItem(STORAGE_KEYS.IDEAS_TAB);
  // Migrate old tab values
  if (saved === "connect") {
    // Check if user was in paper mode → board tab
    const viewMode = localStorage.getItem(STORAGE_KEYS.CONNECT_VIEW_MODE);
    return viewMode === "paper" ? "board" : "node";
  }
  if (saved === "daily") return "daily";
  if (
    saved === "materials" ||
    saved === "notes" ||
    saved === "search" ||
    saved === "tags"
  )
    return "materials";
  if (saved === "node") return "node";
  if (saved === "board") return "board";
  return "materials";
}

interface IdeasViewProps {
  onNavigateToNote?: (noteId: string) => void;
}

export function IdeasView({ onNavigateToNote }: IdeasViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<IdeasTab>(loadIdeasTab);

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
    togglePin,
    persistWithHistory,
    sortMode,
    setSortMode,
    sortDirection,
    setSortDirection,
  } = useNoteContext();
  const { getDefaultNoteContent, selectedTemplateId, setSelectedTemplateId } =
    useTemplateContext();
  const { assignments, tags, setTagsForEntity } = useWikiTags();
  const { showToast } = useToast();

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

  // --- Connect/Node tab state (from ConnectTabView) ---
  const { setActiveDomain } = useUndoRedo();
  const { noteConnections, createNoteConnection, deleteNoteConnectionByPair } =
    useNoteConnections();
  const paper = usePaperBoard();

  const [connectQuery, setConnectQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [sidebarSelectedItemId, setSidebarSelectedItemId] = useState<
    string | null
  >(null);

  const handleSidebarSelect = useCallback((id: string | null) => {
    setSidebarSelectedItemId(id);
  }, []);

  const handleFocusComplete = useCallback(() => {
    setFocusedNoteId(null);
  }, []);

  const { matchingTags, matchingNotes } = useConnectSearch({
    query: connectQuery,
    tags,
    notes,
  });

  // Activate undo/redo domain for node/board tabs
  useEffect(() => {
    if (activeTab === "node" || activeTab === "board") {
      setActiveDomain("wikiTag");
      return () => setActiveDomain(null);
    }
  }, [activeTab, setActiveDomain]);

  const handleCreateNoteConnection = useCallback(
    async (sourceNoteId: string, targetNoteId: string) => {
      await createNoteConnection(sourceNoteId, targetNoteId);
      const sourceTagIds = assignments
        .filter((a) => a.entityId === sourceNoteId && a.entityType === "note")
        .map((a) => a.tagId);
      const targetTagIds = assignments
        .filter((a) => a.entityId === targetNoteId && a.entityType === "note")
        .map((a) => a.tagId);
      const mergedForSource = [...new Set([...sourceTagIds, ...targetTagIds])];
      const mergedForTarget = [...new Set([...targetTagIds, ...sourceTagIds])];
      if (mergedForSource.length > sourceTagIds.length) {
        await setTagsForEntity(sourceNoteId, "note", mergedForSource);
      }
      if (mergedForTarget.length > targetTagIds.length) {
        await setTagsForEntity(targetNoteId, "note", mergedForTarget);
      }
    },
    [createNoteConnection, assignments, setTagsForEntity],
  );

  const handleDeleteNoteConnection = useCallback(
    async (sourceNoteId: string, targetNoteId: string) => {
      await deleteNoteConnectionByPair(sourceNoteId, targetNoteId);
    },
    [deleteNoteConnectionByPair],
  );

  const handleCreateNoteForConnect = useCallback(
    async (title: string, tagId?: string) => {
      const noteId = createNote(title);
      if (tagId) {
        await setTagsForEntity(noteId, "note", [tagId]);
      }
      onNavigateToNote?.(noteId);
    },
    [createNote, setTagsForEntity, onNavigateToNote],
  );

  const handleUpdateNoteColor = useCallback(
    (noteId: string, color: string) => {
      updateNote(noteId, { color });
    },
    [updateNote],
  );

  const handleUpdateNoteTitle = useCallback(
    (noteId: string, title: string) => {
      updateNote(noteId, { title });
    },
    [updateNote],
  );

  // --- Materials tab state ---
  const handleTabChange = (tab: IdeasTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, tab);
  };

  // Daily tab: select date
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

  // Materials tab: select note
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

  // Cross-navigation: Materials → Node with focus
  const handleNavigateToNode = useCallback((noteId: string) => {
    setActiveTab("node");
    localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, "node");
    setFocusedNoteId(noteId);
  }, []);

  // Cross-navigation: receive focus request
  const [pendingFocusNoteId, setPendingFocusNoteId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (pendingFocusNoteId) {
      setFocusedNoteId(pendingFocusNoteId);
      setPendingFocusNoteId(null);
    }
  }, [pendingFocusNoteId]);

  // Navigate to note from Node/Board tab
  const handleNavigateToNote = useCallback(
    (noteId: string) => {
      setActiveTab("materials");
      localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, "materials");
      setSelectedNoteId(noteId);
      onNavigateToNote?.(noteId);
    },
    [setSelectedNoteId, onNavigateToNote],
  );

  // Navigate to memo from Node tab
  const handleNavigateToMemo = useCallback(
    (date: string) => {
      setActiveTab("daily");
      localStorage.setItem(STORAGE_KEYS.IDEAS_TAB, "daily");
      handleSelectDailyDate(date);
    },
    [handleSelectDailyDate],
  );

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  // --- Sidebar rendering ---
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
      case "materials":
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
            onNavigateToNode={handleNavigateToNode}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            onUpdateNote={updateNote}
            onTogglePin={togglePin}
            onCopyToFiles={handleCopyNoteToFiles}
            onToggleExpand={toggleExpanded}
            persistWithHistory={persistWithHistory}
            sortMode={sortMode}
            onSortChange={setSortMode}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
            onSelectTemplate={setSelectedTemplateId}
            selectedTemplateId={selectedTemplateId}
          />
        );
      case "node":
        return (
          <ConnectSidebar
            query={connectQuery}
            onQueryChange={setConnectQuery}
            matchingTags={matchingTags}
            matchingNotes={matchingNotes}
            selectedTagId={selectedTagId}
            tags={tags}
            assignments={assignments}
            notes={notes}
            memos={memos}
            onSelectTag={setSelectedTagId}
            onNavigateToNote={handleNavigateToNote}
            onCreateNote={handleCreateNoteForConnect}
            sidebarSelectedItemId={sidebarSelectedItemId}
            onSidebarSelect={handleSidebarSelect}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            onDeleteNote={softDeleteNote}
            onDeleteMemo={deleteMemo}
          />
        );
      case "board":
        return (
          <PaperSidebar
            boards={paper.boards}
            activeBoardId={paper.activeBoardId}
            onSelectBoard={(id) => paper.setActiveBoardId(id)}
            onCreateBoard={(name) => paper.createBoard(name)}
            onDeleteBoard={(id) => paper.deleteBoard(id)}
            onRenameBoard={(id, name) => paper.updateBoard(id, { name })}
            notes={notes}
            onOpenNoteBoard={(noteId, noteName) =>
              paper.openBoardForNote(noteId, noteName)
            }
            boardNodeCounts={paper.boardNodeCounts}
          />
        );
    }
  };

  const listElement = renderSidebar();

  const isCanvasTab = activeTab === "node" || activeTab === "board";

  const renderContent = () => {
    if (
      selectedTemplateId &&
      (activeTab === "daily" || activeTab === "materials")
    ) {
      return <TemplateContentView />;
    }
    switch (activeTab) {
      case "daily":
        return <DailyMemoView />;
      case "materials":
        return <NotesView />;
      case "node":
        return (
          <ReactFlowProvider key="ideas-node">
            <TagGraphView
              tags={tags}
              assignments={assignments}
              noteConnections={noteConnections}
              selectedTagId={selectedTagId}
              onSelectTag={setSelectedTagId}
              onCreateNoteConnection={handleCreateNoteConnection}
              onDeleteNoteConnection={handleDeleteNoteConnection}
              notes={notes}
              memos={memos}
              onNavigateToNote={handleNavigateToNote}
              onNavigateToMemo={handleNavigateToMemo}
              onUpdateNoteColor={handleUpdateNoteColor}
              focusedNoteId={focusedNoteId}
              onFocusComplete={handleFocusComplete}
              sidebarSelectedItemId={sidebarSelectedItemId}
            />
          </ReactFlowProvider>
        );
      case "board":
        return (
          <ReactFlowProvider key="ideas-board">
            <PaperCanvasView
              board={paper.activeBoard}
              paperNodes={paper.nodes}
              paperEdges={paper.edges}
              notes={notes}
              memos={memos}
              onCreateNode={paper.createNode}
              onUpdateNode={paper.updateNode}
              onBulkUpdatePositions={paper.bulkUpdatePositions}
              onDeleteNode={paper.deleteNode}
              onCreateEdge={paper.createEdge}
              onDeleteEdge={paper.deleteEdge}
              onSaveViewport={paper.saveViewport}
              onNavigateToNote={handleNavigateToNote}
            />
          </ReactFlowProvider>
        );
    }
  };

  return (
    <div
      className={`h-full flex flex-col ${isCanvasTab ? "" : `${LAYOUT.CONTENT_PX} ${LAYOUT.CONTENT_PT} ${LAYOUT.CONTENT_PB}`}`}
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
