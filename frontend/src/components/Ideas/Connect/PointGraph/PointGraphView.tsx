import type {
  WikiTag,
  WikiTagAssignment,
  NoteConnection,
} from "../../../../types/wikiTag";
import type { NoteNode } from "../../../../types/note";
import type { DailyNode } from "../../../../types/daily";
import { useState } from "react";
import type { NoteLink } from "../../../../types/noteLink";
import { usePointGraphModel } from "./hooks/usePointGraphModel";
import { GraphCanvas } from "./components/GraphCanvas";
import { DEFAULT_FORCES } from "./hooks/usePointGraphSimulation";

interface ConnectRequest {
  tagId: string | null;
  newTagName: string | null;
  newTagColor: string;
  sourceEntityType: "note" | "memo";
  sourceEntityId: string;
  targetEntityType: "note" | "memo";
  targetEntityId: string;
  sourceTagIds: string[];
  targetTagIds: string[];
}

/**
 * Point Graph — Canvas 2D + d3-force replacement for the React Flow Node tab.
 * Props mirror TagGraphView so ConnectView can swap with no call-site changes.
 */
export interface PointGraphViewProps {
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  noteConnections: NoteConnection[];
  noteLinks: NoteLink[];
  selectedTagId: string | null;
  onSelectTag: (tagId: string | null) => void;
  onCreateNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onDeleteNoteConnection: (sourceNoteId: string, targetNoteId: string) => void;
  onConnectViaTag: (req: ConnectRequest) => Promise<void>;
  onDeleteNoteEntity: (noteId: string) => void;
  onDeleteDailyEntity: (dailyDate: string) => void;
  notes: NoteNode[];
  dailies: DailyNode[];
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToMemo?: (date: string) => void;
  onUpdateNoteColor?: (noteId: string, color: string) => void;
  focusedNoteId?: string | null;
  onFocusComplete?: () => void;
  sidebarSelectedItemId: string | null;
}

export function PointGraphView({
  notes,
  dailies,
  tags,
  assignments,
  noteConnections,
  noteLinks,
}: PointGraphViewProps) {
  const snapshot = usePointGraphModel({
    notes,
    dailies,
    tags,
    assignments,
    noteConnections,
    noteLinks,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="h-full w-full">
      <GraphCanvas
        snapshot={snapshot}
        forces={DEFAULT_FORCES}
        showLabels
        searchMatchSet={null}
        selectedId={selectedId}
        onSelectedIdChange={setSelectedId}
      />
    </div>
  );
}
