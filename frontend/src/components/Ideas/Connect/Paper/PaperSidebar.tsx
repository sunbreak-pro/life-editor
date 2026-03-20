import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  StickyNote,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { PaperBoard } from "../../../../types/paperBoard";
import type { NoteNode } from "../../../../types/note";
import { BoardCreateDialog } from "./BoardCreateDialog";

interface PaperSidebarProps {
  boards: PaperBoard[];
  activeBoardId: string | null;
  onSelectBoard: (id: string) => void;
  onCreateBoard: (name: string) => void;
  onDeleteBoard: (id: string) => void;
  onRenameBoard: (id: string, name: string) => void;
  notes: NoteNode[];
  onOpenNoteBoard: (noteId: string, noteName: string) => void;
}

const NOTES_EXPANDED_KEY = "life-editor-paper-notes-expanded";

function loadNotesExpanded(): boolean {
  try {
    const saved = localStorage.getItem(NOTES_EXPANDED_KEY);
    if (saved !== null) return saved === "true";
  } catch {
    // ignore
  }
  return true;
}

export function PaperSidebar({
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  onRenameBoard,
  notes,
  onOpenNoteBoard,
}: PaperSidebarProps) {
  const { t } = useTranslation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(loadNotesExpanded);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const customBoards = boards.filter((b) => !b.linkedNoteId);
  const linkedBoards = boards.filter((b) => b.linkedNoteId);

  const startRename = useCallback((board: PaperBoard) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameBoard(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRenameBoard]);

  const toggleNotesExpanded = useCallback(() => {
    setNotesExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(NOTES_EXPANDED_KEY, String(next));
      return next;
    });
  }, []);

  const isEmpty = customBoards.length === 0 && linkedBoards.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Boards list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-notion-text-secondary font-medium">
              {t("ideas.boards")}
            </span>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="text-notion-text-secondary hover:text-notion-text"
            >
              <Plus size={14} />
            </button>
          </div>

          {isEmpty && (
            <div className="py-6 text-center">
              <p className="text-xs text-notion-text-secondary mb-3">
                {t("ideas.emptyBoardMessage")}
              </p>
            </div>
          )}

          {customBoards.map((board) => (
            <div
              key={board.id}
              className={`group flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer ${
                activeBoardId === board.id
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "text-notion-text hover:bg-notion-hover"
              }`}
              onClick={() => onSelectBoard(board.id)}
            >
              {renamingId === board.id ? (
                <div
                  className="flex items-center gap-1 flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="flex-1 bg-transparent outline-none text-xs text-notion-text"
                    autoFocus
                  />
                  <button onClick={confirmRename} className="text-green-500">
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    className="text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <LayoutGrid size={12} className="shrink-0" />
                  <span className="truncate flex-1">{board.name}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(board);
                      }}
                      className="text-notion-text-secondary hover:text-notion-text"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t("ideas.deleteBoardConfirm"))) {
                          onDeleteBoard(board.id);
                        }
                      }}
                      className="text-notion-text-secondary hover:text-red-500"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Note-linked boards */}
        <div className="px-3 py-2 border-t border-notion-border">
          <button
            onClick={toggleNotesExpanded}
            className="flex items-center gap-1 w-full text-left mb-1"
          >
            {notesExpanded ? (
              <ChevronDown size={12} className="text-notion-text-secondary" />
            ) : (
              <ChevronRight size={12} className="text-notion-text-secondary" />
            )}
            <span className="text-[10px] uppercase tracking-wider text-notion-text-secondary font-medium">
              {t("ideas.notes")}
            </span>
          </button>
          {notesExpanded && (
            <div className="mt-1">
              {notes
                .filter((n) => !n.isDeleted)
                .slice(0, 30)
                .map((note) => {
                  const linked = linkedBoards.find(
                    (b) => b.linkedNoteId === note.id,
                  );
                  return (
                    <button
                      key={note.id}
                      onClick={() => onOpenNoteBoard(note.id, note.title)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left ${
                        linked && activeBoardId === linked.id
                          ? "bg-notion-accent/10 text-notion-accent"
                          : "text-notion-text hover:bg-notion-hover"
                      }`}
                    >
                      <StickyNote
                        size={12}
                        className="shrink-0 text-yellow-500"
                      />
                      <span className="truncate">
                        {note.title || "Untitled"}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <BoardCreateDialog
          notes={notes}
          onCreateBoard={onCreateBoard}
          onOpenNoteBoard={onOpenNoteBoard}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
