import { useRef, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { getContentPreview } from "../../../../utils/tiptapText";
import { ConfirmDialog } from "../../../shared/ConfirmDialog";
import { Button } from "../../../shared/Button";
import { RoleSwitcher } from "./RoleSwitcher";
import type { ConversionRole } from "../../../../hooks/useRoleConversion";

interface MemoPreviewPopupProps {
  kind: "daily" | "note";
  title: string;
  content: string;
  position: { x: number; y: number };
  onOpenDetail: () => void;
  onClose: () => void;
  onUpdateTitle?: (title: string) => void;
  onDelete?: () => void;
  onConvertRole?: (targetRole: ConversionRole) => void;
  disabledRoles?: ConversionRole[];
}

const ACCENT: Record<
  "daily" | "note",
  { bar: string; badge: string; badgeText: string }
> = {
  daily: {
    bar: "#F59E0B",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "Daily",
  },
  note: {
    bar: "#3B82F6",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "Note",
  },
};

export function MemoPreviewPopup({
  kind,
  title,
  content,
  position,
  onOpenDetail,
  onClose,
  onUpdateTitle,
  onDelete,
  onConvertRole,
  disabledRoles,
}: MemoPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  useClickOutside(ref, onClose, !showDeleteConfirm && !isEditing);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onUpdateTitle?.(trimmed);
    }
    setIsEditing(false);
  };

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);
  const accent = ACCENT[kind];
  const preview = getContentPreview(content);

  return (
    <>
      <div
        ref={ref}
        className="fixed z-50 w-65 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
        style={{ left, top }}
      >
        <div className="p-3 space-y-2">
          <div
            className="w-full h-1 rounded-full"
            style={{ backgroundColor: accent.bar }}
          />
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  setEditValue(title);
                  setIsEditing(false);
                }
              }}
              className="font-medium text-sm text-notion-text w-full bg-transparent border-b border-notion-accent outline-none"
            />
          ) : (
            <div
              className={`font-medium text-sm text-notion-text truncate ${
                kind === "note" && onUpdateTitle
                  ? "cursor-text hover:bg-notion-hover/50 rounded px-0.5 -mx-0.5"
                  : ""
              }`}
              onClick={() => {
                if (kind === "note" && onUpdateTitle) {
                  setEditValue(title);
                  setIsEditing(true);
                }
              }}
            >
              {title}
            </div>
          )}
          <p className="text-xs text-notion-text-secondary line-clamp-3">
            {preview || t("calendar.memoPreviewEmpty")}
          </p>
          {onConvertRole ? (
            <RoleSwitcher
              currentRole={kind}
              disabledRoles={disabledRoles}
              onSelectRole={onConvertRole}
            />
          ) : (
            <span
              className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${accent.badge}`}
            >
              {accent.badgeText}
            </span>
          )}
        </div>
        <div className="border-t border-notion-border flex">
          <Button
            variant="secondary"
            size="sm"
            icon={<ExternalLink size={12} />}
            onClick={onOpenDetail}
            className="flex-1 justify-center rounded-none py-2"
          >
            {t("calendar.openDetail")}
          </Button>
          {kind === "note" && onDelete && (
            <>
              <div className="w-px bg-notion-border" />
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={12} />}
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 justify-center rounded-none py-2"
              >
                {t("common.delete")}
              </Button>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t("calendar.deleteNoteTitle")}
          message={t("calendar.deleteNoteMessage")}
          onConfirm={() => onDelete?.()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
