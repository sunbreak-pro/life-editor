import { useMemo } from "react";
import type { WikiTagAssignment } from "../types/wikiTag";

export interface NoteCooccurrenceEntry {
  key: string;
  noteId1: string;
  noteId2: string;
  sharedTagIds: string[];
  count: number;
}

function makeKey(a: string, b: string): string {
  return a < b ? `${a}---${b}` : `${b}---${a}`;
}

export function useNoteCooccurrence(
  assignments: WikiTagAssignment[],
): NoteCooccurrenceEntry[] {
  return useMemo(() => {
    // Build tagId -> noteId[] mapping (only for note entities)
    const tagNotes = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.entityType !== "note") continue;
      const list = tagNotes.get(a.tagId);
      if (list) {
        list.push(a.entityId);
      } else {
        tagNotes.set(a.tagId, [a.entityId]);
      }
    }

    // For each tag, generate note pairs that share it
    const pairMap = new Map<
      string,
      { noteId1: string; noteId2: string; sharedTagIds: Set<string> }
    >();

    for (const [tagId, noteIds] of tagNotes) {
      if (noteIds.length < 2) continue;
      // Deduplicate noteIds for this tag
      const unique = [...new Set(noteIds)];
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = makeKey(unique[i], unique[j]);
          const existing = pairMap.get(key);
          if (existing) {
            existing.sharedTagIds.add(tagId);
          } else {
            const [n1, n2] =
              unique[i] < unique[j]
                ? [unique[i], unique[j]]
                : [unique[j], unique[i]];
            pairMap.set(key, {
              noteId1: n1,
              noteId2: n2,
              sharedTagIds: new Set([tagId]),
            });
          }
        }
      }
    }

    return Array.from(pairMap.entries()).map(([key, val]) => ({
      key,
      noteId1: val.noteId1,
      noteId2: val.noteId2,
      sharedTagIds: Array.from(val.sharedTagIds),
      count: val.sharedTagIds.size,
    }));
  }, [assignments]);
}
