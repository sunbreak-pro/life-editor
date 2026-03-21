import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import type { NoteNode } from "../../../types/note";
import { getDataService } from "../../../services";

interface ExistingNoteTabProps {
  onSelect: (note: NoteNode) => void;
}

export function ExistingNoteTab({ onSelect }: ExistingNoteTabProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const data = await getDataService().fetchAllNotes();
      setNotes(data);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, search]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-notion-bg-secondary border border-notion-border rounded">
        <Search size={12} className="text-notion-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("schedulePanel.searchNotes", "Search notes...")}
          className="flex-1 text-sm bg-transparent focus:outline-none text-notion-text"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelect(note)}
            className="w-full flex items-center px-2 py-1.5 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
          >
            <span className="truncate">
              {note.title || t("schedulePanel.untitledNote", "Untitled")}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-notion-text-secondary text-center py-2">
            {t("schedulePanel.noNotes", "No notes found")}
          </p>
        )}
      </div>
    </div>
  );
}
