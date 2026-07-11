import { useState, useCallback, useMemo } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import type { NoteNode } from "@life-editor/shared";

/*
 * Web-side @dnd-kit glue for the Notes tag-heading side list (life-tags
 * unification S1). Replaces the folder-move DnD (useNoteTreeDnd): the only
 * gesture now is "drag a note onto a tag heading = assign that tag". There is
 * no reorder and no move-into — the grouping is derived from tag membership,
 * not tree position, so sort_order carries no meaning across a many-to-many
 * model. The untagged bucket is intentionally NOT a droppable (dropping there
 * would mean "remove all tags", which is destructive — a no-op instead).
 *
 * Lives in web/ (not shared/) so the shared package stays UI/dnd-free.
 */

const TAG_DROP_PREFIX = "note-tag-drop:";

/** Droppable id for a tag heading. Only real tag ids get a droppable. */
export const tagDroppableId = (tagId: string): string =>
  `${TAG_DROP_PREFIX}${tagId}`;

const parseTagDroppable = (id: string): string | null =>
  id.startsWith(TAG_DROP_PREFIX) ? id.slice(TAG_DROP_PREFIX.length) : null;

// A note appears under EVERY tag heading it has, so the same note id renders
// multiple draggable rows. @dnd-kit requires globally-unique draggable ids, so
// each row's draggable id is scoped by its group key; the real note id is
// recovered on drag start / end.
const NOTE_DRAG_SEP = "::";

/** Draggable id for a note row inside a given group (globally unique). */
export const noteDraggableId = (groupKey: string, noteId: string): string =>
  `${groupKey}${NOTE_DRAG_SEP}${noteId}`;

const parseNoteId = (dragId: string): string => {
  const idx = dragId.indexOf(NOTE_DRAG_SEP);
  return idx === -1 ? dragId : dragId.slice(idx + NOTE_DRAG_SEP.length);
};

interface UseNoteTagDndParams {
  notes: NoteNode[];
  /** Assign `tagId` to `noteId` (host de-dupes already-assigned tags). */
  onAssign: (noteId: string, tagId: string) => void;
}

export function useNoteTagDnd({ notes, onAssign }: UseNoteTagDndParams) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTagId, setOverTagId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(parseNoteId(event.active.id as string));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    setOverTagId(overId ? parseTagDroppable(overId) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const noteId = parseNoteId(event.active.id as string);
      const overId = event.over?.id as string | undefined;
      setActiveId(null);
      setOverTagId(null);
      if (!overId) return;
      const tagId = parseTagDroppable(overId);
      if (!tagId) return; // untagged / non-tag target = no-op
      onAssign(noteId, tagId);
    },
    [onAssign],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverTagId(null);
  }, []);

  const activeNote = useMemo(
    () => (activeId ? (notes.find((n) => n.id === activeId) ?? null) : null),
    [activeId, notes],
  );

  return {
    sensors,
    activeId,
    activeNote,
    overTagId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
