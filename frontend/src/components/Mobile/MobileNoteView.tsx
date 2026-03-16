import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import type { NoteNode } from "../../types/note";

export function MobileNoteView() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);

  const ds = getDataService();

  const loadNotes = useCallback(async () => {
    try {
      const all = await ds.fetchAllNotes();
      setNotes(all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (e) {
      console.error("Failed to load notes:", e);
    } finally {
      setLoading(false);
    }
  }, [ds]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    if (selectedId) {
      const note = notes.find((n) => n.id === selectedId);
      if (note) {
        setEditTitle(note.title);
        setEditContent(note.content || "");
      }
    }
  }, [selectedId, notes]);

  async function handleSave() {
    if (!selectedId) return;
    try {
      await ds.updateNote(selectedId, {
        title: editTitle,
        content: editContent,
      });
      await loadNotes();
    } catch (e) {
      console.error("Failed to save note:", e);
    }
  }

  async function handleCreateNote() {
    const id = `note-${Date.now()}`;
    try {
      const note = await ds.createNote(id, "");
      await loadNotes();
      setSelectedId(note.id);
    } catch (e) {
      console.error("Failed to create note:", e);
    }
  }

  if (selectedId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-notion-border px-4 py-3">
          <button
            onClick={() => setSelectedId(null)}
            className="text-sm text-notion-accent"
          >
            &larr; {t("common.back", "Back")}
          </button>
          <button
            onClick={handleSave}
            className="ml-auto rounded bg-notion-accent px-3 py-1 text-xs text-white"
          >
            {t("common.save", "Save")}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="mb-3 w-full border-b border-notion-border bg-transparent pb-2 text-lg font-semibold text-notion-text-primary focus:outline-none"
            placeholder={t("mobile.note.titlePlaceholder", "Title")}
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[200px] w-full resize-none bg-transparent text-sm text-notion-text-primary focus:outline-none"
            placeholder={t(
              "mobile.note.contentPlaceholder",
              "Start writing...",
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-notion-border px-4 py-3">
        <h2 className="text-sm font-medium text-notion-text-primary">
          {t("mobile.tabs.notes", "Notes")}
        </h2>
        <button
          onClick={handleCreateNote}
          className="rounded bg-notion-accent px-3 py-1 text-xs text-white"
        >
          + {t("mobile.note.new", "New")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-notion-text-secondary">
            {t("common.loading", "Loading...")}
          </div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-sm text-notion-text-secondary">
            {t("mobile.note.empty", "No notes yet")}
          </div>
        ) : (
          <ul>
            {notes.map((note) => (
              <li
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className="cursor-pointer border-b border-notion-border px-4 py-3 active:bg-notion-hover"
              >
                <div className="text-sm font-medium text-notion-text-primary">
                  {note.title || t("mobile.note.untitled", "Untitled")}
                </div>
                <p className="mt-1 text-xs text-notion-text-secondary">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
