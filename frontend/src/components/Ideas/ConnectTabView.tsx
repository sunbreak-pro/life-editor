import { useState, useCallback, useEffect, useContext } from "react";
import { createPortal } from "react-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { TagGraphView } from "./Connect/TagGraphView";
import { ConnectSidebar } from "./Connect/ConnectSidebar";
import { useWikiTags } from "../../hooks/useWikiTags";
import { useWikiTagConnections } from "../../hooks/useWikiTagConnections";
import { useTagCooccurrence } from "../../hooks/useTagCooccurrence";
import { useConnectSearch } from "../../hooks/useConnectSearch";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useUndoRedo } from "../shared/UndoRedo";
import { RightSidebarContext } from "../../context/RightSidebarContext";

interface ConnectTabViewProps {
  onNavigateToNote?: (noteId: string) => void;
}

export function ConnectTabView({ onNavigateToNote }: ConnectTabViewProps) {
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

  const { connections, createConnection, deleteConnectionByPair } =
    useWikiTagConnections();
  const cooccurrences = useTagCooccurrence(assignments);
  const { notes, createNote, updateNote } = useNoteContext();

  const [query, setQuery] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<
    "all" | "grouped" | { groupId: string }
  >("all");

  const { matchingTags, matchingNotes } = useConnectSearch({
    query,
    tags,
    notes,
  });

  const handleCreateConnection = useCallback(
    async (sourceTagId: string, targetTagId: string) => {
      await createConnection(sourceTagId, targetTagId);
    },
    [createConnection],
  );

  const handleDeleteConnection = useCallback(
    async (sourceTagId: string, targetTagId: string) => {
      await deleteConnectionByPair(sourceTagId, targetTagId);
    },
    [deleteConnectionByPair],
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
      connections={connections}
      onSelectTag={setSelectedTagId}
      onNavigateToNote={onNavigateToNote}
      onCreateNote={handleCreateNote}
      onCreateTag={createTag}
      onUpdateTag={handleUpdateTag}
      onDeleteTag={handleDeleteTag}
      onCreateConnection={handleCreateConnection}
      onDeleteConnection={handleDeleteConnection}
      groups={groups}
      groupMembers={groupMembers}
      filterMode={filterMode}
      onFilterModeChange={setFilterMode}
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
                connections={connections}
                cooccurrences={cooccurrences}
                selectedTagId={selectedTagId}
                onSelectTag={setSelectedTagId}
                onCreateConnection={handleCreateConnection}
                onDeleteConnection={handleDeleteConnection}
                groups={groups}
                groupMembers={groupMembers}
                notes={notes}
                filterMode={filterMode}
                onNavigateToNote={onNavigateToNote}
                onUpdateNoteColor={handleUpdateNoteColor}
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
                connections={connections}
                cooccurrences={cooccurrences}
                selectedTagId={selectedTagId}
                onSelectTag={setSelectedTagId}
                onCreateConnection={handleCreateConnection}
                onDeleteConnection={handleDeleteConnection}
                groups={groups}
                groupMembers={groupMembers}
                notes={notes}
                filterMode={filterMode}
                onNavigateToNote={onNavigateToNote}
                onUpdateNoteColor={handleUpdateNoteColor}
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
