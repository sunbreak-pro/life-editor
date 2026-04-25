import { Suspense, useCallback, useRef, useState } from "react";
import { getDataService } from "../../services/dataServiceFactory";
import { useToast } from "../../context/ToastContext";
import { Heart, BookOpen, Lock, MoreHorizontal, PenOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDailyContext } from "../../hooks/useDailyContext";
import { useScreenLockContextOptional } from "../../hooks/useScreenLockContextOptional";

// Stable fallback for Mobile (where ScreenLockProvider is omitted) — kept at
// module scope so the reference never changes and useCallback deps stay stable.
const SCREEN_LOCK_FALLBACK = {
  isUnlocked: () => true,
  unlock: () => {},
} as const;
import { formatDateTime } from "../../utils/formatRelativeDate";
import { formatDateHeading } from "../../utils/dateKey";
import { LazyRichTextEditor as RichTextEditor } from "../shared/LazyRichTextEditor";
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
import { useTemplateContext } from "../../hooks/useTemplateContext";

export function DailyView() {
  const {
    selectedDate,
    selectedDaily,
    upsertDaily,
    togglePin,
    setDailyPassword,
    removeDailyPassword,
    verifyDailyPassword,
    toggleEditLock,
  } = useDailyContext();
  const screenLock = useScreenLockContextOptional();
  const { isUnlocked, unlock } = screenLock ?? SCREEN_LOCK_FALLBACK;
  const { getDefaultDailyContent } = useTemplateContext();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const handleCopyToFiles = useCallback(async () => {
    try {
      const ds = getDataService();
      const dir = await ds.selectFolder();
      if (!dir) return;
      const filePath = await ds.copyDailyToFile(selectedDate, dir);
      showToast("success", t("copy.copiedToFile", { path: filePath }));
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : t("copy.copyFailed"));
    }
  }, [selectedDate, showToast, t]);

  const dailyId = selectedDaily?.id ?? `memo-${selectedDate}`;
  const isLocked = !!selectedDaily?.hasPassword && !isUnlocked(dailyId);
  const isEditLocked = !!selectedDaily?.isEditLocked;

  const handleUpdate = useCallback(
    (content: string) => {
      upsertDaily(selectedDate, content);
    },
    [selectedDate, upsertDaily],
  );

  const handlePasswordSubmit = useCallback(
    async (password: string, newPassword?: string): Promise<boolean> => {
      try {
        if (passwordDialogMode === "set") {
          await setDailyPassword(selectedDate, password);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "verify") {
          const ok = await verifyDailyPassword(selectedDate, password);
          if (ok) {
            unlock(dailyId);
            setPasswordDialogMode(null);
          }
          return ok;
        }
        if (passwordDialogMode === "change") {
          const ok = await verifyDailyPassword(selectedDate, password);
          if (!ok) return false;
          await removeDailyPassword(selectedDate, password);
          await setDailyPassword(selectedDate, newPassword!);
          setPasswordDialogMode(null);
          return true;
        }
        if (passwordDialogMode === "remove") {
          await removeDailyPassword(selectedDate, password);
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
      dailyId,
      passwordDialogMode,
      setDailyPassword,
      removeDailyPassword,
      verifyDailyPassword,
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
          {selectedDaily && (
            <button
              onClick={() => !isEditLocked && togglePin(selectedDate)}
              className={`p-1.5 rounded transition-colors ${isEditLocked ? "cursor-not-allowed opacity-50" : ""} ${
                selectedDaily.isPinned
                  ? "text-red-500 hover:text-red-400"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
              title={
                selectedDaily.isPinned
                  ? t("notesView.unfavorite")
                  : t("notesView.favorite")
              }
            >
              {selectedDaily.isPinned ? (
                <Heart size={16} className="fill-current" />
              ) : (
                <Heart size={16} />
              )}
            </button>
          )}
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
              hasPassword={!!selectedDaily?.hasPassword}
              isEditLocked={isEditLocked}
              onSetPassword={() => setPasswordDialogMode("set")}
              onChangePassword={() => setPasswordDialogMode("change")}
              onRemovePassword={() => setPasswordDialogMode("remove")}
              onToggleEditLock={() => toggleEditLock(selectedDate)}
              onCopyToFiles={selectedDaily ? handleCopyToFiles : undefined}
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
            {selectedDaily?.updatedAt && (
              <p className="text-[11px] text-notion-text-secondary/60 mb-4">
                {t("dateTime.updated")}:{" "}
                {formatDateTime(selectedDaily.updatedAt)}
              </p>
            )}
            {!selectedDaily?.updatedAt && <div className="mb-4" />}
            {selectedDaily && (
              <div className="mb-3">
                <WikiTagList entityId={selectedDaily.id} entityType="daily" />
              </div>
            )}
            {selectedDaily && (
              <div className="mb-3">
                <DailyRoleSwitcher date={selectedDate} memo={selectedDaily} />
              </div>
            )}
            <Suspense
              fallback={
                <div className="text-notion-text-secondary text-sm">
                  {t("dateTime.loadingEditor")}
                </div>
              }
            >
              <RichTextEditor
                taskId={selectedDate}
                initialContent={
                  selectedDaily?.content ||
                  getDefaultDailyContent() ||
                  undefined
                }
                onUpdate={handleUpdate}
                entityType="daily"
                syncEntityId={selectedDaily?.id}
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
    daily: memo as ConversionSource["daily"],
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
