import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services/dataServiceFactory";
import { useSyncContext } from "../../hooks/useSyncContext";
import type { NoteNode } from "../../types/note";
import { MobileRichEditor } from "./shared/MobileRichEditor";

function extractPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed?.content) {
      return parsed.content
        .map(
          (block: { content?: Array<{ text?: string }> }) =>
            block.content?.map((c) => c.text || "").join("") || "",
        )
        .join(" ")
        .slice(0, 120);
    }
  } catch {
    // plain text
  }
  return content?.slice(0, 120) || "";
}

export function MobileNoteView() {
  const { t } = useTranslation();
  const { syncVersion } = useSyncContext();
  const [notes, setNotes] = useState<NoteNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  }, [loadNotes, syncVersion]);

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

  const selectedNote = selectedId
    ? (notes.find((n) => n.id === selectedId) ?? null)
    : null;

  if (selectedId) {
    return (
      <MobileNoteDetail
        key={selectedId}
        note={selectedNote}
        onBack={async () => {
          setSelectedId(null);
          await loadNotes();
        }}
      />
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
                <p className="mt-1 line-clamp-2 text-xs text-notion-text-secondary">
                  {extractPlainText(note.content || "")}
                </p>
                <p className="mt-1 text-[10px] text-notion-text-secondary">
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

interface MobileNoteDetailProps {
  note: NoteNode | null;
  onBack: () => void | Promise<void>;
}

function MobileNoteDetail({ note, onBack }: MobileNoteDetailProps) {
  const { t } = useTranslation();
  const ds = getDataService();
  // Seed once per mount — parent keys us on selectedId so switching notes
  // remounts the component with the right initial values.
  const [title, setTitle] = useState(note?.title ?? "");
  const titleDebounceRef = useRef<number | null>(null);

  const saveTitle = useCallback(
    async (value: string) => {
      if (!note) return;
      try {
        await ds.updateNote(note.id, { title: value });
      } catch (e) {
        console.error("Failed to save note title:", e);
      }
    },
    [note, ds],
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (titleDebounceRef.current) window.clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = window.setTimeout(() => {
      void saveTitle(value);
    }, 400);
  };

  const handleContentChange = useCallback(
    async (content: string) => {
      if (!note) return;
      try {
        await ds.updateNote(note.id, { content });
      } catch (e) {
        console.error("Failed to save note content:", e);
      }
    },
    [note, ds],
  );

  const handleBack = async () => {
    if (titleDebounceRef.current) {
      window.clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
      await saveTitle(title);
    }
    await onBack();
  };

  if (!note) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-notion-border px-4 py-3">
          <button onClick={onBack} className="text-sm text-notion-accent">
            &larr; {t("common.back", "Back")}
          </button>
        </div>
        <div className="flex-1 p-8 text-center text-sm text-notion-text-secondary">
          {t("common.loading", "Loading...")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-notion-border px-4 py-3">
        <button onClick={handleBack} className="text-sm text-notion-accent">
          &larr; {t("common.back", "Back")}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="mb-3 w-full border-b border-notion-border bg-transparent pb-2 text-lg font-semibold text-notion-text-primary focus:outline-none"
          placeholder={t("mobile.note.titlePlaceholder", "Title")}
        />
        <MobileRichEditor
          entityId={note.id}
          initialContent={note.content || ""}
          onChange={handleContentChange}
          placeholder={t("mobile.note.contentPlaceholder", "Start writing...")}
        />
      </div>
    </div>
  );
}
