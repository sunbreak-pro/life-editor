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
import { UNTAGGED_GROUP_KEY, type NoteNode } from "@life-editor/shared";

/*
 * Web-side @dnd-kit glue for the Notes tag-heading side list (life-tags
 * unification S1). Replaces the folder-move DnD (useNoteTreeDnd): the gesture
 * is "drag a note from one tag heading to another = MOVE it there". There is
 * no reorder and no move-into — the grouping is derived from tag membership,
 * not tree position, so sort_order carries no meaning across a many-to-many
 * model.
 *
 * #1687 made the drop a move. It used to only ADD the target tag, so the row
 * stayed under its old heading as well and the second drag of the same note
 * looked broken: dropping it back on the tag it already had was a no-op, and
 * the untagged bucket was not a target at all. Now the drop also removes the
 * tag of the heading the row was dragged FROM — which the draggable id carries,
 * since a note renders one row per tag it has.
 *
 * The untagged bucket IS a target now, and dropping there removes only that
 * source tag. "Remove every tag" would be a destructive gesture with no
 * affordance saying so; removing the one the user dragged out of is the same
 * move the other direction.
 *
 * Lives in web/ (not shared/) so the shared package stays UI/dnd-free.
 */

const TAG_DROP_PREFIX = "note-tag-drop:";

/** Droppable id for the untagged bucket — "drop the tag you came from". */
export const UNTAGGED_DROP_ID = "note-untagged-drop";

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

/**
 * The tag the dragged ROW belongs to (#1687) — the group key in the draggable
 * id, which is the tag id for every group but the untagged bucket. Null when
 * the row came from that bucket, or when the id carries no group at all.
 */
const parseSourceTagId = (dragId: string): string | null => {
  const idx = dragId.indexOf(NOTE_DRAG_SEP);
  if (idx === -1) return null;
  const key = dragId.slice(0, idx);
  return key === UNTAGGED_GROUP_KEY ? null : key;
};

/** Where a drop landed: a tag id, null for the untagged bucket, undefined for nowhere. */
const parseDropTarget = (overId: string): string | null | undefined => {
  if (overId === UNTAGGED_DROP_ID) return null;
  return parseTagDroppable(overId) ?? undefined;
};

/** One drop, as the host has to carry it out (#1687). */
export interface NoteTagMove {
  noteId: string;
  /** The heading the row was dragged out of; null = the untagged bucket. */
  fromTagId: string | null;
  /** The heading it was dropped on; null = the untagged bucket. */
  toTagId: string | null;
}

/** The assignment rows a move is planned against (the tags context shape). */
export interface NoteTagAssignmentRow {
  id: string;
  tagId: string;
  isDeleted?: boolean;
}

/** The two writes a drop comes down to. Either half can be null. */
export interface NoteTagMovePlan {
  /** Assignment id to remove, or null (came from untagged / already gone). */
  unassignId: string | null;
  /** Tag id to add, or null (dropped on untagged / the note already has it). */
  assignTagId: string | null;
}

/**
 * What a drop should write (#1687), as a pure function of the move and the
 * note's current assignments — so the five cases in the Issue are pinned
 * without a pointer. jsdom has no layout, which is why the gesture itself
 * cannot be driven in a test (CLAUDE.md §7.1); this is the half that decides.
 *
 * The remove is by ASSIGNMENT id because that is all +BT+unassignTagFromItem+BT+
 * takes. A source tag whose row is already gone yields null and the add still
 * happens — a stale drag must not swallow the half that is still valid.
 */
export function planTagMove(
  move: NoteTagMove,
  assignments: readonly NoteTagAssignmentRow[],
): NoteTagMovePlan {
  const live = assignments.filter((row) => !row.isDeleted);
  const source =
    move.fromTagId === null
      ? undefined
      : live.find((row) => row.tagId === move.fromTagId);
  const alreadyHasTarget =
    move.toTagId !== null && live.some((row) => row.tagId === move.toTagId);
  return {
    unassignId: source?.id ?? null,
    assignTagId:
      move.toTagId !== null && !alreadyHasTarget ? move.toTagId : null,
  };
}

interface UseNoteTagDndParams {
  notes: NoteNode[];
  /**
   * Carry out a drop: remove `fromTagId`, add `toTagId` (the host owns both
   * writes and de-dupes an assignment the note already has).
   */
  onMove: (move: NoteTagMove) => void;
}

export function useNoteTagDnd({ notes, onMove }: UseNoteTagDndParams) {
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
      const dragId = event.active.id as string;
      const noteId = parseNoteId(dragId);
      const fromTagId = parseSourceTagId(dragId);
      const overId = event.over?.id as string | undefined;
      setActiveId(null);
      setOverTagId(null);
      if (!overId) return;
      const toTagId = parseDropTarget(overId);
      if (toTagId === undefined) return; // not a heading at all
      // Dropping a row back on its own heading is the gesture cancelled.
      if (toTagId === fromTagId) return;
      onMove({ noteId, fromTagId, toTagId });
    },
    [onMove],
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

/** The wiring the host hands to the side list (sensors + drag handlers). */
export type NoteTagDnd = ReturnType<typeof useNoteTagDnd>;
