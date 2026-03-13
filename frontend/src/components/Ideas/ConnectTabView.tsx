import { useState, useCallback, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { TagGraphView } from "./Connect/TagGraphView";
import { ConnectSidebar } from "./Connect/ConnectSidebar";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useNoteConnections } from "../../hooks/useNoteConnections";
import { useNoteCooccurrence } from "../../hooks/useNoteCooccurrence";
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

  const {
    tags,
    assignments,
    createTag,
    updateTag,
    deleteTag,
    setTagsForEntity,
    groups,
    groupMembers,
    createGroup,
    updateGroup,
    deleteGroup,
  } = useWikiTags();

  const { noteConnections, createNoteConnection, deleteNoteConnectionByPair } =
    useNoteConnections();
  const noteCooccurrences = useNoteCooccurrence(assignments);
  const { notes, createNote, updateNote } = useNoteContext();
  const { memos } = useMemoContext();

  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filterMode, _setFilterMode] = useState<
    "all" | "grouped" | { groupId: string }
  >("all");
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

  const handleFocusNote = useCallback((noteId: string) => {
    setFocusedNoteId(noteId);
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

  const handleUpdateTag = useCallback(
    async (
      id: string,
      updates: Partial<Pick<(typeof tags)[0], "name" | "color">>,
    ) => {
      await updateTag(id, updates);
    },
    [updateTag],
  );

  const handleDeleteTag = useCallback(
    async (id: string) => {
      await deleteTag(id);
      if (selectedTagId === id) setSelectedTagId(null);
    },
    [deleteTag, selectedTagId],
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
      onFocusNote={handleFocusNote}
      onCreateNote={handleCreateNote}
      onCreateTag={createTag}
      onUpdateTag={handleUpdateTag}
      onDeleteTag={handleDeleteTag}
      groups={groups}
      groupMembers={groupMembers}
      onCreateGroup={createGroup}
      onUpdateGroup={updateGroup}
      onDeleteGroup={deleteGroup}
    />
  );

  return (
    <div className="h-full flex">
      {rightSidebarTarget ? (
        <>
          {createPortal(sidebar, rightSidebarTarget)}
          <div className="flex-1 min-w-0">
            <ReactFlowProvider>
              <TagGraphView
                tags={tags}
                assignments={assignments}
                noteConnections={noteConnections}
                noteCooccurrences={noteCooccurrences}
                selectedTagId={selectedTagId}
                onSelectTag={setSelectedTagId}
                onCreateNoteConnection={handleCreateNoteConnection}
                onDeleteNoteConnection={handleDeleteNoteConnection}
                groups={groups}
                groupMembers={groupMembers}
                notes={notes}
                filterMode={filterMode}
                onNavigateToNote={onNavigateToNote}
                onUpdateNoteColor={handleUpdateNoteColor}
                focusedNoteId={focusedNoteId}
                onFocusComplete={handleFocusComplete}
              />
            </ReactFlowProvider>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <ReactFlowProvider>
              <TagGraphView
                tags={tags}
                assignments={assignments}
                noteConnections={noteConnections}
                noteCooccurrences={noteCooccurrences}
                selectedTagId={selectedTagId}
                onSelectTag={setSelectedTagId}
                onCreateNoteConnection={handleCreateNoteConnection}
                onDeleteNoteConnection={handleDeleteNoteConnection}
                groups={groups}
                groupMembers={groupMembers}
                notes={notes}
                filterMode={filterMode}
                onNavigateToNote={onNavigateToNote}
                onUpdateNoteColor={handleUpdateNoteColor}
                focusedNoteId={focusedNoteId}
                onFocusComplete={handleFocusComplete}
              />
            </ReactFlowProvider>
          </div>
          <div className="w-64 shrink-0 border-l border-notion-border overflow-hidden">
            {sidebar}
          </div>
        </>
      )}
    </div>
  );
}
