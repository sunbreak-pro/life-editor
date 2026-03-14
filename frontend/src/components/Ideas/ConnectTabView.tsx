import { useState, useCallback, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { TagGraphView } from "./Connect/TagGraphView";
import { ConnectSidebar } from "./Connect/ConnectSidebar";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useNoteConnections } from "../../hooks/useNoteConnections";
import { useConnectSearch } from "../../hooks/useConnectSearch";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useUndoRedo } from "../shared/UndoRedo";
import { RightSidebarContext } from "../../context/RightSidebarContext";

interface ConnectTabViewProps {
  onNavigateToNote?: (noteId: string) => void;
  initialFocusNoteId?: string | null;
  onFocusConsumed?: () => void;
}

export function ConnectTabView({
  onNavigateToNote,
  initialFocusNoteId,
  onFocusConsumed,
}: ConnectTabViewProps) {
  const { setActiveDomain } = useUndoRedo();

  useEffect(() => {
    setActiveDomain("wikiTag");
    return () => setActiveDomain(null);
  }, [setActiveDomain]);

  const { tags, assignments, setTagsForEntity } = useWikiTags();

  const { noteConnections, createNoteConnection, deleteNoteConnectionByPair } =
    useNoteConnections();
  const { notes, createNote, updateNote } = useNoteContext();
  const { memos } = useMemoContext();

  const [query, setQuery] = useState("");
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

  // Receive focus request from cross-navigation
  useEffect(() => {
    if (initialFocusNoteId) {
      setFocusedNoteId(initialFocusNoteId);
      onFocusConsumed?.();
    }
  }, [initialFocusNoteId, onFocusConsumed]);

  const { matchingTags, matchingNotes } = useConnectSearch({
    query,
    tags,
    notes,
  });

  const handleCreateNoteConnection = useCallback(
    async (sourceNoteId: string, targetNoteId: string) => {
      await createNoteConnection(sourceNoteId, targetNoteId);
      // Auto-add tags from each note to the other
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

  const handleCreateNote = useCallback(
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

  const { portalTarget: rightSidebarTarget } = useContext(RightSidebarContext);

  const sidebar = (
    <ConnectSidebar
      query={query}
      onQueryChange={setQuery}
      matchingTags={matchingTags}
      matchingNotes={matchingNotes}
      selectedTagId={selectedTagId}
      tags={tags}
      assignments={assignments}
      notes={notes}
      memos={memos}
      onSelectTag={setSelectedTagId}
      onNavigateToNote={onNavigateToNote}
      onCreateNote={handleCreateNote}
      sidebarSelectedItemId={sidebarSelectedItemId}
      onSidebarSelect={handleSidebarSelect}
      onUpdateNoteTitle={handleUpdateNoteTitle}
    />
  );

  const graphView = (
    <ReactFlowProvider>
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
        onNavigateToNote={onNavigateToNote}
        onUpdateNoteColor={handleUpdateNoteColor}
        focusedNoteId={focusedNoteId}
        onFocusComplete={handleFocusComplete}
        sidebarSelectedItemId={sidebarSelectedItemId}
      />
    </ReactFlowProvider>
  );

  return (
    <div className="h-full flex">
      {rightSidebarTarget ? (
        <>
          {createPortal(sidebar, rightSidebarTarget)}
          <div className="flex-1 min-w-0">{graphView}</div>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">{graphView}</div>
          <div className="w-64 shrink-0 border-l border-notion-border overflow-hidden">
            {sidebar}
          </div>
        </>
      )}
    </div>
  );
}
