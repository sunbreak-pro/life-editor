import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { WikiTag } from "../types/wikiTag";

const MENU_HEIGHT = 260;
const MENU_WIDTH = 280;

function calcMenuPosition(
  coords: { top: number; bottom: number; left: number },
  editorRect: DOMRect,
): { top: number; left: number } {
  let top = coords.bottom - editorRect.top + 4;
  let left = coords.left - editorRect.left;

  if (coords.bottom + 4 + MENU_HEIGHT > window.innerHeight) {
    top = coords.top - editorRect.top - MENU_HEIGHT - 4;
  }
  if (coords.left + MENU_WIDTH > window.innerWidth) {
    left = left - (coords.left + MENU_WIDTH - window.innerWidth) - 8;
  }

  return { top, left };
}

export function useWikiTagSuggestion(
  editor: Editor,
  tags: WikiTag[],
  onInsertTag: (tag: WikiTag) => void,
  onCreateAndInsertTag: (name: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Position of the `@` that opened the suggestion.
  const triggerPosRef = useRef<number | null>(null);

  const filteredTags = useMemo(() => {
    const q = query.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(q));
  }, [tags, query]);

  const hasExactMatch = useMemo(
    () =>
      query.length > 0 &&
      filteredTags.some((t) => t.name.toLowerCase() === query.toLowerCase()),
    [filteredTags, query],
  );

  const totalOptions =
    filteredTags.length + (query.length > 0 && !hasExactMatch ? 1 : 0);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    triggerPosRef.current = null;
  }, []);

  const deleteTriggerText = useCallback(() => {
    if (triggerPosRef.current !== null) {
      const from = triggerPosRef.current;
      // +1 for "@", then query length
      const to = from + 1 + query.length;
      editor.chain().focus().deleteRange({ from, to }).run();
    }
  }, [editor, query]);

  const insertTag = useCallback(
    (index: number) => {
      if (index < filteredTags.length) {
        const tag = filteredTags[index];
        deleteTriggerText();
        onInsertTag(tag);
      } else {
        deleteTriggerText();
        onCreateAndInsertTag(query);
      }
      close();
    },
    [
      filteredTags,
      query,
      deleteTriggerText,
      onInsertTag,
      onCreateAndInsertTag,
      close,
    ],
  );

  // Detect `@query` and drive the suggestion menu.
  useEffect(() => {
    const handleTransaction = () => {
      try {
        if (!editor.view?.dom?.isConnected) return;
      } catch {
        return;
      }

      const isComposing = editor.view.composing;
      if (isComposing) return;

      const { state } = editor;
      const { $head } = state.selection;
      const textBefore = $head.parent.textContent.slice(0, $head.parentOffset);

      // Match `@query` where query has no whitespace or nested `@`.
      // Require start-of-block or whitespace before `@` so mid-word `@`s don't trigger.
      const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/);
      if (match) {
        const rawQuery = match[1];
        // `@` position: end of textBefore minus rawQuery.length minus 1 for the `@` itself,
        // mapped into the doc by parent offset.
        try {
          const coords = editor.view.coordsAtPos($head.pos);
          const editorRect = editor.view.dom.getBoundingClientRect();
          setPosition(calcMenuPosition(coords, editorRect));
          setQuery(rawQuery);
          setSelectedIndex(0);
          triggerPosRef.current = $head.pos - rawQuery.length - 1;
          setIsOpen(true);
        } catch {
          if (isOpen) close();
        }
      } else {
        if (isOpen) close();
      }
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, isOpen, close, tags, onInsertTag, onCreateAndInsertTag]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % totalOptions);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + totalOptions) % totalOptions);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertTag(selectedIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, selectedIndex, totalOptions, insertTag, close]);

  return {
    isOpen,
    position,
    selectedIndex,
    filteredTags,
    query,
    hasExactMatch,
    insertTag,
    close,
  };
}
