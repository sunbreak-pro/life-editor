import { useMemo } from "react";
import type { WikiTag } from "../types/wikiTag";
import type { NoteNode } from "../types/note";

interface UseConnectSearchProps {
  query: string;
  tags: WikiTag[];
  notes: NoteNode[];
}

export function useConnectSearch({
  query,
  tags,
  notes,
}: UseConnectSearchProps) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return { matchingTags: tags, matchingNotes: [] };
    }

    const matchingTags = tags.filter((tag) =>
      tag.name.toLowerCase().includes(q),
    );

    const matchingNotes = notes.filter(
      (note) =>
        !note.isDeleted &&
        (note.title.toLowerCase().includes(q) ||
          note.content
            .replace(/<[^>]*>/g, "")
            .toLowerCase()
            .includes(q)),
    );

    return { matchingTags, matchingNotes };
  }, [query, tags, notes]);
}
