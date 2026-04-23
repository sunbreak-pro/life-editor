import { useState, useCallback, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { GitBranch, LayoutGrid } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { TabItem } from "../shared/SectionTabs";
import { SectionHeader } from "../shared/SectionHeader";
import { TagGraphView } from "./Connect/TagGraphView";
import { ConnectSidebar } from "./Connect/ConnectSidebar";
import { PaperCanvasView } from "./Connect/Paper/PaperCanvasView";
import { PaperSidebar } from "./Connect/Paper/PaperSidebar";
import { useDailyContext } from "../../hooks/useDailyContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useNoteConnections } from "../../hooks/useNoteConnections";
import { useConnectSearch } from "../../hooks/useConnectSearch";
import { useNoteLinksGraph } from "../../hooks/useNoteLinksGraph";
import { usePaperBoard } from "../../hooks/usePaperBoard";
import { useUndoRedo } from "../shared/UndoRedo";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { RightSidebarContext } from "../../context/RightSidebarContext";

type ConnectTab = "node" | "board";

const CONNECT_TABS: readonly TabItem<ConnectTab>[] = [
  { id: "node", labelKey: "ideas.node", icon: GitBranch },
  { id: "board", labelKey: "ideas.board", icon: LayoutGrid },
];

function loadConnectTab(): ConnectTab {
  const saved = localStorage.getItem(STORAGE_KEYS.CONNECT_TAB);
  if (saved === "node") return "node";
  if (saved === "board") return "board";
  // Migrate from old IDEAS_TAB
  const oldTab = localStorage.getItem(STORAGE_KEYS.IDEAS_TAB);
  if (oldTab === "node") return "node";
  if (oldTab === "board") return "board";
  const viewMode = localStorage.getItem(STORAGE_KEYS.CONNECT_VIEW_MODE);
  if (viewMode === "paper") return "board";
  if (oldTab === "connect") return "node";
  return "node";
}

interface ConnectViewProps {
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToMemo?: (date: string) => void;
}

export function ConnectView({
  onNavigateToNote,
  onNavigateToMemo,
}: ConnectViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConnectTab>(loadConnectTab);

  const { dailies, setSelectedDate, deleteDaily } = useDailyContext();
  const { notes, setSelectedNoteId, createNote, softDeleteNote, updateNote } =
    useNoteContext();
  const { assignments, tags, setTagsForEntity, createTag } = useWikiTags();

  const { setActiveDomain } = useUndoRedo();
  const { noteConnections, createNoteConnection, deleteNoteConnectionByPair } =
    useNoteConnections();
  const { noteLinks } = useNoteLinksGraph();
  const paper = usePaperBoard();

  const [connectQuery, setConnectQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [canvasSelectedNodeIds, setCanvasSelectedNodeIds] = useState<string[]>(
    [],
  );
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

  // Activate undo/redo domain
  useEffect(() => {
    if (activeTab === "node") {
      setActiveDomain("wikiTag");
    } else if (activeTab === "board") {
      setActiveDomain("paper");
    }
    return () => setActiveDomain(null);
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

  const handleConnectViaTag = useCallback(
    async (req: {
      tagId: string | null;
      newTagName: string | null;
      newTagColor: string;
      sourceEntityType: "note" | "memo";
      sourceEntityId: string;
      targetEntityType: "note" | "memo";
      targetEntityId: string;
      sourceTagIds: string[];
      targetTagIds: string[];
    }) => {
      let tagId = req.tagId;
      if (!tagId && req.newTagName) {
        const created = await createTag(req.newTagName, req.newTagColor);
        tagId = created.id;
      }
      if (!tagId) return;
      const nextSourceIds = req.sourceTagIds.includes(tagId)
        ? req.sourceTagIds
        : [...req.sourceTagIds, tagId];
      const nextTargetIds = req.targetTagIds.includes(tagId)
        ? req.targetTagIds
        : [...req.targetTagIds, tagId];
      await setTagsForEntity(
        req.sourceEntityId,
        req.sourceEntityType,
        nextSourceIds,
      );
      await setTagsForEntity(
        req.targetEntityId,
        req.targetEntityType,
        nextTargetIds,
      );
    },
    [createTag, setTagsForEntity],
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

  const handleTabChange = (tab: ConnectTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEYS.CONNECT_TAB, tab);
  };

  // Navigate to note from Node/Board tab
  const handleNavigateToNote = useCallback(
    (noteId: string) => {
      // Navigate to Materials section
      localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "notes");
      setSelectedNoteId(noteId);
      onNavigateToNote?.(noteId);
    },
    [setSelectedNoteId, onNavigateToNote],
  );

  // Navigate to memo from Node tab
  const handleNavigateToMemo = useCallback(
    (date: string) => {
      localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "daily");
      setSelectedDate(date);
      onNavigateToMemo?.(date);
    },
    [setSelectedDate, onNavigateToMemo],
  );

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const renderSidebar = () => {
    switch (activeTab) {
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
            dailies={dailies}
            onSelectTag={setSelectedTagId}
            onNavigateToNote={handleNavigateToNote}
            onCreateNote={handleCreateNoteForConnect}
            sidebarSelectedItemId={sidebarSelectedItemId}
            onSidebarSelect={handleSidebarSelect}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            onDeleteNote={softDeleteNote}
            onDeleteMemo={() => {}}
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
            paperNodes={paper.nodes}
            selectedNodeIds={canvasSelectedNodeIds}
            onSelectNode={(nodeId) => setCanvasSelectedNodeIds([nodeId])}
            onBulkUpdateLayerOrder={paper.bulkUpdateLayerOrder}
            onDeleteNode={paper.deleteNode}
            onUpdateNode={paper.updateNode}
            onDuplicateNode={paper.duplicateNode}
            onToggleHidden={paper.toggleNodeHidden}
          />
        );
    }
  };

  const listElement = renderSidebar();

  const renderContent = () => {
    switch (activeTab) {
      case "node":
        return (
          <ReactFlowProvider key="connect-node">
            <TagGraphView
              tags={tags}
              assignments={assignments}
              noteConnections={noteConnections}
              noteLinks={noteLinks}
              selectedTagId={selectedTagId}
              onSelectTag={setSelectedTagId}
              onCreateNoteConnection={handleCreateNoteConnection}
              onDeleteNoteConnection={handleDeleteNoteConnection}
              onConnectViaTag={handleConnectViaTag}
              onDeleteNoteEntity={softDeleteNote}
              onDeleteDailyEntity={deleteDaily}
              notes={notes}
              dailies={dailies}
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
          <ReactFlowProvider key="connect-board">
            <PaperCanvasView
              board={paper.activeBoard}
              paperNodes={paper.nodes}
              paperEdges={paper.edges}
              notes={notes}
              dailies={dailies}
              onCreateNode={paper.createNode}
              onUpdateNode={paper.updateNode}
              onBulkUpdatePositions={paper.bulkUpdatePositions}
              onDeleteNode={paper.deleteNode}
              onCreateEdge={paper.createEdge}
              onDeleteEdge={paper.deleteEdge}
              onSaveViewport={paper.saveViewport}
              onNavigateToNote={handleNavigateToNote}
              onSelectionChanged={setCanvasSelectedNodeIds}
            />
          </ReactFlowProvider>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <SectionHeader
        title={t("connect.title")}
        tabs={CONNECT_TABS}
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
