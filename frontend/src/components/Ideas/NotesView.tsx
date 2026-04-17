import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Folder,
  Heart,
  Lock,
  MoreHorizontal,
  PenOff,
  StickyNote,
} from "lucide-react";
import { renderIcon } from "../../utils/iconRenderer";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useScreenLockContext } from "../../hooks/useScreenLockContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";
import { WikiTagList } from "../WikiTags/WikiTagList";
import { UnifiedColorPicker } from "../shared/UnifiedColorPicker";
import { FOLDER_COLORS } from "../../constants/folderColors";
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
    notes,
    selectedNote,
    setSelectedNoteId,
    updateNote,
    togglePin,
    setNotePassword,
    removeNotePassword,
    verifyNotePassword,
    toggleEditLock,
  } = useNoteContext();
  const { isUnlocked, unlock } = useScreenLockContext();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const isLocked = !!selectedNote?.hasPassword && !isUnlocked(selectedNote.id);
  const isEditLocked = !!selectedNote?.isEditLocked;

  // Build breadcrumb ancestors
  const ancestors = useMemo(() => {
    if (!selectedNote?.parentId) return [];
    const result: typeof notes = [];
    let currentId: string | null = selectedNote.parentId;
    while (currentId) {
      const parent = notes.find((n) => n.id === currentId);
      if (!parent) break;
      result.unshift(parent);
      currentId = parent.parentId;
    }
    return result;
  }, [selectedNote, notes]);

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
          {/* Breadcrumb */}
          {ancestors.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-notion-text-secondary mb-2 overflow-x-auto">
              {ancestors.map((ancestor, i) => (
                <div
                  key={ancestor.id}
                  className="flex items-center gap-1 shrink-0"
                >
                  {i > 0 && <ChevronRight size={12} />}
                  <button
                    onClick={() => setSelectedNoteId(ancestor.id)}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-notion-hover transition-colors"
                  >
                    {ancestor.icon ? (
                      renderIcon(ancestor.icon, { size: 13 })
                    ) : ancestor.type === "folder" ? (
                      <Folder size={13} />
                    ) : (
                      <StickyNote size={13} />
                    )}
                    <span>{ancestor.title}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Title + Pin */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <button
                onClick={() =>
                  !isEditLocked && setShowColorPicker(!showColorPicker)
                }
                className={`p-1 rounded hover:bg-notion-hover ${isEditLocked ? "cursor-not-allowed opacity-50" : ""}`}
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
                <UnifiedColorPicker
                  color={selectedNote.color ?? ""}
                  onChange={(color) => {
                    updateNote(selectedNote.id, { color });
                    setShowColorPicker(false);
                  }}
                  mode="preset-only"
                  presets={FOLDER_COLORS}
                  onClose={() => setShowColorPicker(false)}
                />
              )}
            </div>
            <input
              type="text"
              value={selectedNote.title}
              onChange={handleTitleChange}
              readOnly={isEditLocked}
              placeholder={t("notesView.untitled")}
              className={`flex-1 text-lg font-semibold text-notion-text bg-transparent border-none outline-none placeholder:text-notion-text-secondary ${isEditLocked ? "cursor-not-allowed" : ""}`}
            />
            <button
              onClick={() => !isEditLocked && togglePin(selectedNote.id)}
              className={`p-1.5 rounded transition-colors ${isEditLocked ? "cursor-not-allowed opacity-50" : ""} ${
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
              <span
                className="shrink-0 inline-flex"
                title={t("screenLock.locked")}
              >
                <Lock size={14} className="text-notion-text-secondary/60" />
              </span>
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
                isEditLocked={isEditLocked}
                onSetPassword={() => setPasswordDialogMode("set")}
                onChangePassword={() => setPasswordDialogMode("change")}
                onRemovePassword={() => setPasswordDialogMode("remove")}
                onToggleEditLock={() => toggleEditLock(selectedNote.id)}
                onClose={() => setShowOptionsMenu(false)}
                anchorRef={moreButtonRef}
              />
            )}
            {isEditLocked && !isLocked && (
              <span
                className="shrink-0 inline-flex"
                title={t("screenLock.editLocked")}
              >
                <PenOff size={14} className="text-notion-text-secondary/60" />
              </span>
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
                  editable={!isEditLocked}
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
