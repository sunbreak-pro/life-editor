import { Suspense, useCallback, useRef, useState } from "react";
import { Heart, Lock, MoreHorizontal, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useScreenLockContext } from "../../hooks/useScreenLockContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";
import { WikiTagList } from "../WikiTags/WikiTagList";
import { ColorPicker } from "../shared/ColorPicker";
import {
  PasswordDialog,
  type PasswordDialogMode,
} from "../shared/PasswordDialog";
import { ItemOptionsMenu } from "../shared/ItemOptionsMenu";
import { RoleSwitcher } from "../Tasks/Schedule/shared/RoleSwitcher";
import {
  useRoleConversion,
  type ConversionSource,
  type ConversionRole,
} from "../../hooks/useRoleConversion";
import { formatDateKey } from "../../utils/dateKey";

export function NotesView() {
  const { t } = useTranslation();
  const {
    selectedNote,
    updateNote,
    togglePin,
    setNotePassword,
    removeNotePassword,
    verifyNotePassword,
  } = useNoteContext();
  const { isUnlocked, unlock } = useScreenLockContext();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const isLocked = !!selectedNote?.hasPassword && !isUnlocked(selectedNote.id);

  const handlePasswordSubmit = useCallback(
    async (password: string, newPassword?: string): Promise<boolean> => {
      if (!selectedNote) return false;
      try {
        if (passwordDialogMode === "set") {
          await setNotePassword(selectedNote.id, password);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "verify") {
          const ok = await verifyNotePassword(selectedNote.id, password);
          if (ok) {
            unlock(selectedNote.id);
            setPasswordDialogMode(null);
          }
          return ok;
        }
        if (passwordDialogMode === "change") {
          const ok = await verifyNotePassword(selectedNote.id, password);
          if (!ok) return false;
          await removeNotePassword(selectedNote.id, password);
          await setNotePassword(selectedNote.id, newPassword!);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "remove") {
          await removeNotePassword(selectedNote.id, password);
          setPasswordDialogMode(null);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [
      selectedNote,
      passwordDialogMode,
      setNotePassword,
      removeNotePassword,
      verifyNotePassword,
      unlock,
    ],
  );

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
            {isLocked && (
              <Lock
                size={14}
                className="text-notion-text-secondary/60 shrink-0"
                title={t("screenLock.locked")}
              />
            )}
            <button
              ref={moreButtonRef}
              onClick={() => setShowOptionsMenu((v) => !v)}
              className="p-1.5 rounded transition-colors text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover"
              title={t("screenLock.moreOptions")}
            >
              <MoreHorizontal size={16} />
            </button>
            {showOptionsMenu && (
              <ItemOptionsMenu
                hasPassword={!!selectedNote.hasPassword}
                onSetPassword={() => setPasswordDialogMode("set")}
                onChangePassword={() => setPasswordDialogMode("change")}
                onRemovePassword={() => setPasswordDialogMode("remove")}
                onClose={() => setShowOptionsMenu(false)}
                anchorRef={moreButtonRef}
              />
            )}
          </div>

          {/* Content area — blurred when locked */}
          <div className="relative">
            {isLocked && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-notion-bg/30 rounded-lg cursor-pointer"
                onClick={() => setPasswordDialogMode("verify")}
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-notion-bg/80 border border-notion-border shadow-sm">
                  <Lock size={16} className="text-notion-text-secondary" />
                  <span className="text-sm text-notion-text-secondary">
                    {t("screenLock.clickToUnlock")}
                  </span>
                </div>
              </div>
            )}
            <div
              className={
                isLocked ? "blur-md pointer-events-none select-none" : ""
              }
            >
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
          </div>

          {passwordDialogMode && (
            <PasswordDialog
              mode={passwordDialogMode}
              onSubmit={handlePasswordSubmit}
              onCancel={() => setPasswordDialogMode(null)}
            />
          )}
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
