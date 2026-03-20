import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StickyNote, Search, X, LayoutGrid, FileText } from "lucide-react";
import type { NoteNode } from "../../../../types/note";

interface BoardCreateDialogProps {
  notes: NoteNode[];
  onCreateBoard: (name: string) => void;
  onOpenNoteBoard: (noteId: string, noteName: string) => void;
  onClose: () => void;
}

export function BoardCreateDialog({
  notes,
  onCreateBoard,
  onOpenNoteBoard,
  onClose,
}: BoardCreateDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"choose" | "selectNote">("choose");
  const [query, setQuery] = useState("");

  const filteredNotes = useMemo(() => {
    const q = query.toLowerCase();
    return notes
      .filter((n) => !n.isDeleted)
      .filter((n) => !q || n.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [notes, query]);

  if (mode === "selectNote") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-notion-bg border border-notion-border rounded-xl shadow-xl w-[360px] max-h-[400px] flex flex-col">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-sm font-medium text-notion-text">
              {t("ideas.linkToExistingNote")}
            </span>
            <button
              onClick={onClose}
              className="text-notion-text-secondary hover:text-notion-text"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("ideas.searchMaterials")}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded outline-none focus:border-notion-accent text-notion-text"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => {
                  onOpenNoteBoard(note.id, note.title);
                  onClose();
                }}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-notion-hover cursor-pointer"
              >
                <StickyNote size={12} className="shrink-0 text-yellow-500" />
                <span className="truncate text-notion-text">
                  {note.title || "Untitled"}
                </span>
              </button>
            ))}
            {filteredNotes.length === 0 && (
              <p className="text-xs text-notion-text-secondary text-center py-4">
                {t("ideas.noSearchResults")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-xl shadow-xl w-[300px] flex flex-col">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-sm font-medium text-notion-text">
            {t("ideas.createBoard")}
          </span>
          <button
            onClick={onClose}
            className="text-notion-text-secondary hover:text-notion-text"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 pb-3 space-y-2">
          <button
            onClick={() => setMode("selectNote")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-notion-border hover:bg-notion-hover transition-colors text-left"
          >
            <FileText
              size={16}
              className="text-notion-text-secondary shrink-0"
            />
            <span className="text-xs text-notion-text">
              {t("ideas.linkToExistingNote")}
            </span>
          </button>
          <button
            onClick={() => {
              onCreateBoard(t("ideas.newBoard"));
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-notion-border hover:bg-notion-hover transition-colors text-left"
          >
            <LayoutGrid
              size={16}
              className="text-notion-text-secondary shrink-0"
            />
            <span className="text-xs text-notion-text">
              {t("ideas.newBlankBoard")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
