import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { NoteNode } from "../types/note";

const MENU_HEIGHT = 260;
const MENU_WIDTH = 300;

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

export interface ParsedNoteLinkTarget {
  noteQuery: string;
  heading: string | null;
  blockId: string | null;
  alias: string | null;
}

/**
 * Parse the raw text between `[[` and caret into structured parts.
 * Example: "My Note#Intro|alias" → { noteQuery: "My Note", heading: "Intro", blockId: null, alias: "alias" }
 * Example: "My Note#^abc123|see" → { noteQuery: "My Note", heading: null, blockId: "abc123", alias: "see" }
 */
export function parseNoteLinkRaw(raw: string): ParsedNoteLinkTarget {
  let rest = raw;
  let alias: string | null = null;
  let heading: string | null = null;
  let blockId: string | null = null;

  const pipeIdx = rest.indexOf("|");
  if (pipeIdx >= 0) {
    alias = rest.slice(pipeIdx + 1);
    rest = rest.slice(0, pipeIdx);
  }

  const hashIdx = rest.indexOf("#");
  if (hashIdx >= 0) {
    const subpath = rest.slice(hashIdx + 1);
    rest = rest.slice(0, hashIdx);
    if (subpath.startsWith("^")) {
      blockId = subpath.slice(1);
    } else {
      heading = subpath;
    }
  }

  return {
    noteQuery: rest,
    heading: heading && heading.length > 0 ? heading : null,
    blockId: blockId && blockId.length > 0 ? blockId : null,
    alias: alias && alias.length > 0 ? alias : null,
  };
}

export function useNoteLinkSuggestion(
  editor: Editor,
  notes: NoteNode[],
  onInsertNoteLink: (args: {
    note: NoteNode;
    heading: string | null;
    blockId: string | null;
    alias: string | null;
    embed: boolean;
  }) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [embedFlag, setEmbedFlag] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Position of the opening `[[` (or `![[` if embed).
  const triggerPosRef = useRef<number | null>(null);
  const triggerLenRef = useRef<number>(2); // 2 for `[[`, 3 for `![[`

  const parsed = useMemo(() => parseNoteLinkRaw(raw), [raw]);

  const filteredNotes = useMemo(() => {
    const q = parsed.noteQuery.toLowerCase().trim();
    const pool = notes.filter((n) => !n.isDeleted && n.type === "note");
    if (q.length === 0) return pool.slice(0, 15);
    return pool
      .filter((n) => (n.title ?? "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [notes, parsed.noteQuery]);

  const totalOptions = filteredNotes.length;

  const close = useCallback(() => {
    setIsOpen(false);
    setRaw("");
    setEmbedFlag(false);
    setSelectedIndex(0);
    triggerPosRef.current = null;
    triggerLenRef.current = 2;
  }, []);

  const deleteTriggerText = useCallback(() => {
    if (triggerPosRef.current !== null) {
      const from = triggerPosRef.current;
      const to = from + triggerLenRef.current + raw.length;
      editor.chain().focus().deleteRange({ from, to }).run();
    }
  }, [editor, raw]);

  const insertNote = useCallback(
    (index: number) => {
      if (index < 0 || index >= filteredNotes.length) {
        close();
        return;
      }
      const note = filteredNotes[index];
      deleteTriggerText();
      onInsertNoteLink({
        note,
        heading: parsed.heading,
        blockId: parsed.blockId,
        alias: parsed.alias,
        embed: embedFlag,
      });
      close();
    },
    [
      filteredNotes,
      deleteTriggerText,
      onInsertNoteLink,
      parsed,
      embedFlag,
      close,
    ],
  );

  // Detect `[[…` (optionally prefixed by `!` for embed) and update state.
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

      // Auto-confirm on `]]`
      if (textBefore.endsWith("]]")) {
        const match = textBefore.match(/(!?)\[\[([^\]]+)\]\]$/);
        if (match) {
          const embed = match[1] === "!";
          const rawContent = match[2];
          const parsedInner = parseNoteLinkRaw(rawContent);
          const lowerQuery = parsedInner.noteQuery.toLowerCase().trim();
          const hit = notes.find(
            (n) =>
              !n.isDeleted &&
              n.type === "note" &&
              (n.title ?? "").toLowerCase() === lowerQuery,
          );
          if (hit) {
            const from = $head.pos - match[0].length;
            const to = $head.pos;
            editor.chain().focus().deleteRange({ from, to }).run();
            onInsertNoteLink({
              note: hit,
              heading: parsedInner.heading,
              blockId: parsedInner.blockId,
              alias: parsedInner.alias,
              embed,
            });
            close();
            return;
          }
          // No exact title match — leave raw `[[...]]` text in place.
          close();
          return;
        }
      }

      // Detect open `[[…` / `![[…` without closing `]]`.
      const openMatch = textBefore.match(/(!?)\[\[([^\]\n]*)$/);
      if (openMatch) {
        const embed = openMatch[1] === "!";
        const inner = openMatch[2];
        try {
          const coords = editor.view.coordsAtPos($head.pos);
          const editorRect = editor.view.dom.getBoundingClientRect();
          setPosition(calcMenuPosition(coords, editorRect));
          setRaw(inner);
          setEmbedFlag(embed);
          setSelectedIndex(0);
          const triggerLen = embed ? 3 : 2;
          triggerLenRef.current = triggerLen;
          triggerPosRef.current = $head.pos - inner.length - triggerLen;
          setIsOpen(true);
        } catch {
          if (isOpen) close();
        }
      } else if (isOpen) {
        close();
      }
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, isOpen, close, notes, onInsertNoteLink]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.isComposing || e.keyCode === 229) return;

      if (totalOptions === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % totalOptions);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + totalOptions) % totalOptions);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertNote(selectedIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, selectedIndex, totalOptions, insertNote, close]);

  return {
    isOpen,
    position,
    selectedIndex,
    filteredNotes,
    parsed,
    raw,
    embed: embedFlag,
    insertNote,
    close,
  };
}
