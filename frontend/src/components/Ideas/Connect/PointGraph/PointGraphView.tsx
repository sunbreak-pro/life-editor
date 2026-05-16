import type {
  WikiTag,
  WikiTagAssignment,
  NoteConnection,
} from "../../../../types/wikiTag";
import type { NoteNode } from "../../../../types/note";
import type { DailyNode } from "../../../../types/daily";
import type { NoteLink } from "../../../../types/noteLink";
import { usePointGraphModel } from "./hooks/usePointGraphModel";

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

  // S2 placeholder — counts only. Canvas lands in S4.
  const byType = snapshot.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});
  const byKind = snapshot.links.reduce<Record<string, number>>((acc, l) => {
    acc[l.kind] = (acc[l.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full w-full flex items-center justify-center bg-notion-bg text-notion-text">
      <pre className="text-xs leading-relaxed">
        {`Point Graph (S2 scaffold)\n\nnodes: ${snapshot.nodes.length}\n${JSON.stringify(byType, null, 2)}\n\nlinks: ${snapshot.links.length}\n${JSON.stringify(byKind, null, 2)}`}
      </pre>
    </div>
  );
}
