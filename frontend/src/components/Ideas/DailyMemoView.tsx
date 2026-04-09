import { Suspense, useCallback, useRef, useState } from "react";
import { Heart, BookOpen, Lock, MoreHorizontal, PenOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMemoContext } from "../../hooks/useMemoContext";
import { useScreenLockContext } from "../../hooks/useScreenLockContext";
import { formatDateTime } from "../../utils/formatRelativeDate";
import { formatDateHeading } from "../../utils/dateKey";
import { LazyMemoEditor as MemoEditor } from "../Tasks/TaskDetail/LazyMemoEditor";
import { WikiTagList } from "../WikiTags/WikiTagList";
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

export function DailyMemoView() {
  const {
    selectedDate,
    selectedMemo,
    upsertMemo,
    togglePin,
    setMemoPassword,
    removeMemoPassword,
    verifyMemoPassword,
    toggleEditLock,
  } = useMemoContext();
  const { isUnlocked, unlock } = useScreenLockContext();
  const { t, i18n } = useTranslation();

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const memoId = selectedMemo?.id ?? `memo-${selectedDate}`;
  const isLocked = !!selectedMemo?.hasPassword && !isUnlocked(memoId);
  const isEditLocked = !!selectedMemo?.isEditLocked;

  const handleUpdate = useCallback(
    (content: string) => {
      upsertMemo(selectedDate, content);
    },
    [selectedDate, upsertMemo],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string, newPassword?: string): Promise<boolean> => {
      try {
        if (passwordDialogMode === "set") {
          await setMemoPassword(selectedDate, password);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "verify") {
          const ok = await verifyMemoPassword(selectedDate, password);
          if (ok) {
            unlock(memoId);
            setPasswordDialogMode(null);
          }
          return ok;
        }
        if (passwordDialogMode === "change") {
          const ok = await verifyMemoPassword(selectedDate, password);
          if (!ok) return false;
          await removeMemoPassword(selectedDate, password);
          await setMemoPassword(selectedDate, newPassword!);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "remove") {
          await removeMemoPassword(selectedDate, password);
          setPasswordDialogMode(null);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [
      selectedDate,
      memoId,
      passwordDialogMode,
      setMemoPassword,
      removeMemoPassword,
      verifyMemoPassword,
      unlock,
    ],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={18} className="text-blue-500 shrink-0" />
          <h2 className="text-lg font-semibold text-notion-text flex-1">
            {formatDateHeading(selectedDate, i18n.language)}
          </h2>
          {selectedMemo && (
            <button
              onClick={() => !isEditLocked && togglePin(selectedDate)}
              className={`p-1.5 rounded transition-colors ${isEditLocked ? "cursor-not-allowed opacity-50" : ""} ${
                selectedMemo.isPinned
                  ? "text-red-500 hover:text-red-400"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
              title={
                selectedMemo.isPinned
                  ? t("notesView.unfavorite")
                  : t("notesView.favorite")
              }
            >
              {selectedMemo.isPinned ? (
                <Heart size={16} className="fill-current" />
              ) : (
                <Heart size={16} />
              )}
            </button>
          )}
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
              hasPassword={!!selectedMemo?.hasPassword}
              isEditLocked={isEditLocked}
              onSetPassword={() => setPasswordDialogMode("set")}
              onChangePassword={() => setPasswordDialogMode("change")}
              onRemovePassword={() => setPasswordDialogMode("remove")}
              onToggleEditLock={() => toggleEditLock(selectedDate)}
              onClose={() => setShowOptionsMenu(false)}
              anchorRef={moreButtonRef}
            />
          )}
          {isEditLocked && !isLocked && (
            <PenOff
              size={14}
              className="text-notion-text-secondary/60 shrink-0"
              title={t("screenLock.editLocked")}
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
            {selectedMemo?.updatedAt && (
              <p className="text-[11px] text-notion-text-secondary/60 mb-4">
                {t("dateTime.updated")}:{" "}
                {formatDateTime(selectedMemo.updatedAt)}
              </p>
            )}
            {!selectedMemo?.updatedAt && <div className="mb-4" />}
            {selectedMemo && (
              <div className="mb-3">
                <WikiTagList entityId={selectedMemo.id} entityType="memo" />
              </div>
            )}
            {selectedMemo && (
              <div className="mb-3">
                <DailyRoleSwitcher date={selectedDate} memo={selectedMemo} />
              </div>
            )}
            <Suspense
              fallback={
                <div className="text-notion-text-secondary text-sm">
                  {t("dateTime.loadingEditor")}
                </div>
              }
            >
              <MemoEditor
                taskId={selectedDate}
                initialContent={selectedMemo?.content}
                onUpdate={handleUpdate}
                entityType="memo"
                syncEntityId={selectedMemo?.id}
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
    </div>
  );
}

function DailyRoleSwitcher({
  date,
  memo,
}: {
  date: string;
  memo: { id: string; date: string; content: string };
}) {
  const { convert, canConvert } = useRoleConversion();
  const source: ConversionSource = {
    role: "daily",
    memo: memo as ConversionSource["memo"],
    date,
  };
  const roles: ConversionRole[] = ["task", "event", "note", "daily"];
  const disabledRoles = roles.filter((r) => !canConvert(source, r));

  return (
    <RoleSwitcher
      currentRole="daily"
      disabledRoles={disabledRoles}
      onSelectRole={(targetRole) => convert(source, targetRole)}
    />
  );
}
