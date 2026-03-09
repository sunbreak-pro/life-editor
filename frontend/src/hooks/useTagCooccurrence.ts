import { useMemo } from "react";
import type { WikiTagAssignment } from "../types/wikiTag";

export interface CooccurrenceEntry {
  key: string;
  tagId1: string;
  tagId2: string;
  count: number;
}

function makeKey(a: string, b: string): string {
  return a < b ? `${a}---${b}` : `${b}---${a}`;
}

export function useTagCooccurrence(
  assignments: WikiTagAssignment[],
): CooccurrenceEntry[] {
  return useMemo(() => {
    // Group tag IDs by entity
    const entityTags = new Map<string, string[]>();
    for (const a of assignments) {
      const list = entityTags.get(a.entityId);
      if (list) {
        list.push(a.tagId);
      } else {
        entityTags.set(a.entityId, [a.tagId]);
      }
    }

    // Count co-occurrences
    const counts = new Map<
      string,
      { tagId1: string; tagId2: string; count: number }
    >();
    for (const tagIds of entityTags.values()) {
      if (tagIds.length < 2) continue;
      for (let i = 0; i < tagIds.length; i++) {
        for (let j = i + 1; j < tagIds.length; j++) {
          const key = makeKey(tagIds[i], tagIds[j]);
          const existing = counts.get(key);
          if (existing) {
            existing.count++;
          } else {
            const [t1, t2] =
              tagIds[i] < tagIds[j]
                ? [tagIds[i], tagIds[j]]
                : [tagIds[j], tagIds[i]];
            counts.set(key, { tagId1: t1, tagId2: t2, count: 1 });
          }
        }
      }
    }

    return Array.from(counts.entries()).map(([key, val]) => ({
      key,
      ...val,
    }));
  }, [assignments]);
}
