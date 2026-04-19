import { useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";
import { extractNoteLinksFromTiptapJson } from "../utils/noteLinkExtractor";
import type { NoteLinkPayload } from "../types/noteLink";

type Source =
  | { kind: "note"; noteId: string }
  | { kind: "memo"; memoDate: string }
  | null;

function payloadKey(p: NoteLinkPayload): string {
  return [
    p.targetNoteId,
    p.targetHeading ?? "",
    p.targetBlockId ?? "",
    p.alias ?? "",
    p.linkType ?? "inline",
  ].join("|");
}

/**
 * Syncs `[[NoteName]]` / `![[NoteName]]` Note Links from editor JSON to the DB.
 * Mirrors the behavior of `useWikiTagSync` but targets the `note_links` table.
 */
export function useNoteLinkSync(editor: Editor | null, source: Source) {
  const lastSyncedRef = useRef<string>("");

  const syncLinks = useCallback(async () => {
    if (!editor || !source) return;
    const links = extractNoteLinksFromTiptapJson(editor.getJSON());
    const key = links.map(payloadKey).sort().join("\n");
    if (key === lastSyncedRef.current) return;
    lastSyncedRef.current = key;

    try {
      const ds = getDataService();
      if (source.kind === "note") {
        await ds.upsertNoteLinksForNote(source.noteId, links);
      } else {
        await ds.upsertNoteLinksForMemo(source.memoDate, links);
      }
    } catch (err) {
      logServiceError("useNoteLinkSync", "upsert", err);
      // Retry on next update by clearing the cache
      lastSyncedRef.current = "";
    }
  }, [editor, source]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      void syncLinks();
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, syncLinks]);

  return { syncLinks };
}
