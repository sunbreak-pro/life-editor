import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  GitBranch,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  StickyNote,
} from "lucide-react";
import type { PaperBoard } from "../../../../types/paperBoard";
import type { NoteNode } from "../../../../types/note";

type ConnectViewMode = "point" | "paper";

interface PaperSidebarProps {
  viewMode: ConnectViewMode;
  onViewModeChange: (mode: ConnectViewMode) => void;
  boards: PaperBoard[];
  activeBoardId: string | null;
  onSelectBoard: (id: string) => void;
  onCreateBoard: (name: string) => void;
  onDeleteBoard: (id: string) => void;
  onRenameBoard: (id: string, name: string) => void;
  notes: NoteNode[];
  onOpenNoteBoard: (noteId: string, noteName: string) => void;
}

export function PaperSidebar({
  viewMode,
  onViewModeChange,
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

  return (
    <div className="h-full flex flex-col">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-notion-border">
        <button
          onClick={() => onViewModeChange("point")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
            viewMode === "point"
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
          title={t("ideas.pointView")}
        >
          <GitBranch size={14} />
          <span>{t("ideas.pointView")}</span>
        </button>
        <button
          onClick={() => onViewModeChange("paper")}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
            viewMode === "paper"
              ? "bg-notion-accent/10 text-notion-accent"
              : "text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
          }`}
          title={t("ideas.paperView")}
        >
          <LayoutGrid size={14} />
          <span>{t("ideas.paperView")}</span>
        </button>
      </div>

      {/* Boards list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-notion-text-secondary font-medium">
              {t("ideas.boards")}
            </span>
            <button
              onClick={() => onCreateBoard(t("ideas.newBoard"))}
              className="text-notion-text-secondary hover:text-notion-text"
            >
              <Plus size={14} />
            </button>
          </div>

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
          <span className="text-[10px] uppercase tracking-wider text-notion-text-secondary font-medium">
            {t("ideas.notes")}
          </span>
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
                    <span className="truncate">{note.title || "Untitled"}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
