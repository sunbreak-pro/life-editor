import { Suspense, useCallback, useState } from "react";
import { Heart, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";
import { WikiTagList } from "../WikiTags/WikiTagList";
import { ColorPicker } from "../shared/ColorPicker";
import { RoleSwitcher } from "../Tasks/Schedule/shared/RoleSwitcher";
import {
  useRoleConversion,
  type ConversionSource,
  type ConversionRole,
} from "../../hooks/useRoleConversion";
import { formatDateKey } from "../../utils/dateKey";

export function NotesView() {
  const { t } = useTranslation();
  const { selectedNote, updateNote, togglePin } = useNoteContext();

  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedNote) {
        updateNote(selectedNote.id, { title: e.target.value });
      }
    },
    [selectedNote, updateNote],
  );

  const handleContentUpdate = useCallback(
    (content: string) => {
      if (selectedNote) {
        updateNote(selectedNote.id, { content });
      }
    },
    [selectedNote, updateNote],
  );

  return (
    <div className="h-full overflow-y-auto">
      {selectedNote ? (
        <div className="max-w-3xl mx-auto px-8 py-6">
          {/* Title + Pin */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1 rounded hover:bg-notion-hover"
              >
                <StickyNote
                  size={16}
                  style={
                    selectedNote.color
                      ? { color: selectedNote.color }
                      : undefined
                  }
                  className={
                    selectedNote.color
                      ? ""
                      : "text-yellow-600 dark:text-yellow-400"
                  }
                />
              </button>
              {showColorPicker && (
                <ColorPicker
                  currentColor={selectedNote.color}
                  onSelect={(color) => {
                    updateNote(selectedNote.id, { color });
                    setShowColorPicker(false);
                  }}
                  onClose={() => setShowColorPicker(false)}
                />
              )}
            </div>
            <input
              type="text"
              value={selectedNote.title}
              onChange={handleTitleChange}
              placeholder={t("notesView.untitled")}
              className="flex-1 text-lg font-semibold text-notion-text bg-transparent border-none outline-none placeholder:text-notion-text-secondary"
            />
            <button
              onClick={() => togglePin(selectedNote.id)}
              className={`p-1.5 rounded transition-colors ${
                selectedNote.isPinned
                  ? "text-red-500 hover:text-red-400"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
              title={
                selectedNote.isPinned
                  ? t("notesView.unfavorite")
                  : t("notesView.favorite")
              }
            >
              {selectedNote.isPinned ? (
                <Heart size={16} className="fill-current" />
              ) : (
                <Heart size={16} />
              )}
            </button>
          </div>

          {/* Wiki Tags */}
          <div className="mb-2">
            <WikiTagList entityId={selectedNote.id} entityType="note" />
          </div>

          {/* Role Switcher */}
          <div className="mb-2">
            <NoteRoleSwitcher note={selectedNote} />
          </div>

          {/* Date info */}
          <div className="flex items-center gap-3 text-[11px] text-notion-text-secondary/60 mb-3">
            {selectedNote.createdAt && (
              <span>
                {t("dateTime.created")}:{" "}
                {formatDateTime(selectedNote.createdAt)}
              </span>
            )}
            {selectedNote.updatedAt &&
              selectedNote.updatedAt !== selectedNote.createdAt && (
                <span>
                  {t("dateTime.updated")}:{" "}
                  {formatDateTime(selectedNote.updatedAt)}
                </span>
              )}
          </div>

          {/* Editor */}
          <Suspense
            fallback={
              <div className="text-notion-text-secondary text-sm">
                {t("notesView.loadingEditor")}
              </div>
            }
          >
            <MemoEditor
              taskId={selectedNote.id}
              initialContent={selectedNote.content}
              onUpdate={handleContentUpdate}
              entityType="note"
            />
          </Suspense>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-notion-text-secondary">
          <StickyNote size={48} strokeWidth={1} className="mb-3 opacity-30" />
          <p className="text-sm">{t("notesView.emptyState")}</p>
        </div>
      )}
    </div>
  );
}

function NoteRoleSwitcher({
  note,
}: {
  note: { id: string; createdAt: string };
}) {
  const { convert, canConvert } = useRoleConversion();
  const { selectedNote } = useNoteContext();
  const fullNote = selectedNote?.id === note.id ? selectedNote : undefined;
  if (!fullNote) return null;

  const date = formatDateKey(new Date(fullNote.createdAt));
  const source: ConversionSource = { role: "note", note: fullNote, date };
  const roles: ConversionRole[] = ["task", "event", "note", "daily"];
  const disabledRoles = roles.filter((r) => !canConvert(source, r));

  return (
    <RoleSwitcher
      currentRole="note"
      disabledRoles={disabledRoles}
      onSelectRole={(targetRole) => convert(source, targetRole)}
    />
  );
}
