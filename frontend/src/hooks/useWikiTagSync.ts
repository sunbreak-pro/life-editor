import { useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useWikiTags } from "./useWikiTags";

/**
 * Extracts wiki tag names from TipTap editor JSON content.
 */
function extractWikiTagNames(editor: Editor): string[] {
  const names: string[] = [];
  const json = editor.getJSON();

  function walk(node: Record<string, unknown>) {
    if (node.type === "wikiTag" && node.attrs) {
      const attrs = node.attrs as { tagName?: string };
      if (attrs.tagName) names.push(attrs.tagName);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  walk(json as Record<string, unknown>);
  return [...new Set(names)];
}

/**
 * Syncs wiki tags from editor content to the database on save.
 */
export function useWikiTagSync(
  editor: Editor | null,
  entityId: string,
  entityType: "task" | "memo" | "note",
) {
  const { syncInlineTags } = useWikiTags();
  const lastSyncedRef = useRef<string>("");

  const syncTags = useCallback(() => {
    if (!editor) return;
    const names = extractWikiTagNames(editor);
    const key = names.sort().join(",");
    if (key === lastSyncedRef.current) return;
    lastSyncedRef.current = key;
    syncInlineTags(entityId, entityType, names);
  }, [editor, entityId, entityType, syncInlineTags]);

  // Sync on editor content changes (debounced via MemoEditor's onUpdate)
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      syncTags();
    };

    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, syncTags]);

  return { syncTags };
}
