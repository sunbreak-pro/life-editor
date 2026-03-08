import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import type { PanelCommand } from "../components/Tasks/TaskDetail/editorCommands";

const MENU_HEIGHT = 380;
const MENU_WIDTH = 320;

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

export function useSlashCommand(editor: Editor, commands: PanelCommand[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const slashPosRef = useRef<number | null>(null);

  const filteredCommands = useMemo(
    () =>
      commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.title.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q)
        );
      }),
    [commands, query],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
    slashPosRef.current = null;
  }, []);

  const deleteSlashText = useCallback(() => {
    if (slashPosRef.current !== null) {
      const from = slashPosRef.current;
      const to = from + 1 + query.length;
      editor.chain().focus().deleteRange({ from, to }).run();
    }
  }, [editor, query]);

  const executeCommand = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index];
      if (!cmd) return;

      deleteSlashText();
      cmd.action(editor);
      close();
    },
    [editor, filteredCommands, deleteSlashText, close],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        executeCommand(selectedIndex);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredCommands.length, executeCommand, close]);

  useEffect(() => {
    const handleTransaction = () => {
      try {
        if (!editor.view?.dom?.isConnected) return;
      } catch {
        return;
      }

      const { state } = editor;
      const { $head } = state.selection;
      const textBefore = $head.parent.textContent.slice(0, $head.parentOffset);

      const slashMatch = textBefore.match(/\/([a-zA-Z0-9 ]*)$/);
      if (slashMatch) {
        try {
          const coords = editor.view.coordsAtPos($head.pos);
          const editorRect = editor.view.dom.getBoundingClientRect();
          setPosition(calcMenuPosition(coords, editorRect));
          setQuery(slashMatch[1]);
          setSelectedIndex(0);
          slashPosRef.current = $head.pos - slashMatch[0].length;
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
  }, [editor, isOpen, close]);

  return {
    isOpen,
    position,
    selectedIndex,
    filteredCommands,
    query,
    executeCommand,
    deleteSlashText,
    close,
  };
}
