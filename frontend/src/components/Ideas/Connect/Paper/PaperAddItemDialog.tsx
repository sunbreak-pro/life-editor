import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StickyNote, BookOpen, Search, X } from "lucide-react";
import type { NoteNode } from "../../../../types/note";
import type { DailyNode } from "../../../../types/daily";
import { formatDisplayDate } from "../../../../utils/dateKey";

interface PaperAddItemDialogProps {
  notes: NoteNode[];
  dailies: DailyNode[];
  existingRefIds: Set<string>;
  onSelect: (entityId: string, entityType: "note" | "memo") => void;
  onClose: () => void;
}

export function PaperAddItemDialog({
  notes,
  dailies,
  existingRefIds,
  onSelect,
  onClose,
}: PaperAddItemDialogProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"note" | "memo">("note");

  const filteredNotes = useMemo(() => {
    const q = query.toLowerCase();
    return notes
      .filter((n) => !n.isDeleted)
      .filter((n) => !q || n.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [notes, query]);

  const filteredMemos = useMemo(() => {
    const q = query.toLowerCase();
    return dailies
      .filter((m) => !m.isDeleted)
      .filter(
        (m) => !q || m.date.includes(q) || m.content.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [dailies, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-xl shadow-xl w-[400px] max-h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-sm font-medium text-notion-text">
            {t("ideas.addCard")}
          </span>
          <button
            onClick={onClose}
            className="text-notion-text-secondary hover:text-notion-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
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

        {/* Tabs */}
        <div className="flex px-4 gap-2 border-b border-notion-border">
          <button
            onClick={() => setTab("note")}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs border-b-2 ${
              tab === "note"
                ? "border-notion-accent text-notion-accent"
                : "border-transparent text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <StickyNote size={12} />
            {t("ideas.notes")}
          </button>
          <button
            onClick={() => setTab("memo")}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs border-b-2 ${
              tab === "memo"
                ? "border-notion-accent text-notion-accent"
                : "border-transparent text-notion-text-secondary hover:text-notion-text"
            }`}
          >
            <BookOpen size={12} />
            {t("ideas.daily")}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {tab === "note" &&
            filteredNotes.map((note) => {
              const alreadyAdded = existingRefIds.has(note.id);
              return (
                <button
                  key={note.id}
                  onClick={() => !alreadyAdded && onSelect(note.id, "note")}
                  disabled={alreadyAdded}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                    alreadyAdded
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-notion-hover cursor-pointer"
                  }`}
                >
                  <StickyNote size={12} className="shrink-0 text-yellow-500" />
                  <span className="truncate text-notion-text">
                    {note.title || "Untitled"}
                  </span>
                </button>
              );
            })}
          {tab === "memo" &&
            filteredMemos.map((memo) => {
              const alreadyAdded = existingRefIds.has(memo.id);
              return (
                <button
                  key={memo.id}
                  onClick={() => !alreadyAdded && onSelect(memo.id, "memo")}
                  disabled={alreadyAdded}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                    alreadyAdded
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-notion-hover cursor-pointer"
                  }`}
                >
                  <BookOpen size={12} className="shrink-0 text-blue-500" />
                  <span className="truncate text-notion-text">
                    {formatDisplayDate(memo.date, lang)}
                  </span>
                </button>
              );
            })}
          {tab === "note" && filteredNotes.length === 0 && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
          {tab === "memo" && filteredMemos.length === 0 && (
            <p className="text-xs text-notion-text-secondary text-center py-4">
              {t("ideas.noSearchResults")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
