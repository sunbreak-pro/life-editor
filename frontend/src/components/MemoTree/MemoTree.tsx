import { useState, useMemo, useCallback } from "react";
import { BookOpen, StickyNote, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useNoteContext } from "../../hooks/useNoteContext";
import { STORAGE_KEYS } from "../../constants/storageKeys";

interface MemoTreeProps {
  onSelectMemo: (date: string) => void;
  onSelectNote: (noteId: string) => void;
  selectedMemoDate?: string | null;
  selectedNoteId?: string | null;
}

function usePersistedExpand(
  key: string,
  defaultValue: boolean,
): [boolean, () => void] {
  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored === "true" : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [key]);

  return [expanded, toggle];
}

export function MemoTree({
  onSelectMemo,
  onSelectNote,
  selectedMemoDate,
  selectedNoteId,
}: MemoTreeProps) {
  const { t } = useTranslation();
  const { memos } = useMemoContext();
  const { sortedFilteredNotes } = useNoteContext();

  const [dailyExpanded, toggleDaily] = usePersistedExpand(
    `${STORAGE_KEYS.MEMO_TREE_EXPANDED}-daily`,
    true,
  );
  const [notesExpanded, toggleNotes] = usePersistedExpand(
    `${STORAGE_KEYS.MEMO_TREE_EXPANDED}-notes`,
    true,
  );

  const sortedMemos = useMemo(
    () =>
      [...memos]
        .filter((m) => !m.isDeleted)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [memos],
  );

  const activeNotes = useMemo(
    () => sortedFilteredNotes.filter((n) => !n.isDeleted),
    [sortedFilteredNotes],
  );

  return (
    <div className="space-y-1">
      {/* Daily Section */}
      <div>
        <button
          onClick={toggleDaily}
          className="flex items-center gap-2 px-2 py-1.5 w-full text-xs font-semibold uppercase tracking-wider text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors"
        >
          {dailyExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          <BookOpen size={14} />
          <span>{t("memoTree.daily")}</span>
          {sortedMemos.length > 0 && (
            <span className="font-normal">({sortedMemos.length})</span>
          )}
        </button>
        {dailyExpanded && (
          <div className="ml-4">
            {sortedMemos.map((memo) => (
              <button
                key={memo.date}
                onClick={() => onSelectMemo(memo.date)}
                className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded-md transition-colors ${
                  selectedMemoDate === memo.date
                    ? "bg-notion-hover text-notion-text"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <span className="truncate">{memo.date}</span>
              </button>
            ))}
            {sortedMemos.length === 0 && (
              <div className="px-2 py-1 text-xs text-notion-text-secondary">
                —
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div>
        <button
          onClick={toggleNotes}
          className="flex items-center gap-2 px-2 py-1.5 w-full text-xs font-semibold uppercase tracking-wider text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors"
        >
          {notesExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
          <StickyNote size={14} />
          <span>{t("memoTree.notes")}</span>
          {activeNotes.length > 0 && (
            <span className="font-normal">({activeNotes.length})</span>
          )}
        </button>
        {notesExpanded && (
          <div className="ml-4">
            {activeNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className={`flex items-center gap-2 w-full px-2 py-1 text-sm rounded-md transition-colors ${
                  selectedNoteId === note.id
                    ? "bg-notion-hover text-notion-text"
                    : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
                }`}
              >
                <span className="truncate">
                  {note.title || t("notes.untitled")}
                </span>
              </button>
            ))}
            {activeNotes.length === 0 && (
              <div className="px-2 py-1 text-xs text-notion-text-secondary">
                —
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
