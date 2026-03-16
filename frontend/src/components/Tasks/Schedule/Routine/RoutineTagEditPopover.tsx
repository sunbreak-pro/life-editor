import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineTag } from "../../../../types/routineTag";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { getTextColorForBg } from "../../../../constants/folderColors";

interface RoutineTagEditPopoverProps {
  tag: RoutineTag;
  anchorEl: HTMLElement;
  onUpdate: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
  ) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function RoutineTagEditPopover({
  tag,
  anchorEl,
  onUpdate,
  onDelete,
  onClose,
}: RoutineTagEditPopoverProps) {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position calculation
  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const popoverWidth = 240;
    const popoverHeight = 340;
    let top = rect.bottom + 4;
    let left = rect.left;

    // Clamp to viewport
    if (left + popoverWidth > window.innerWidth - 8) {
      left = window.innerWidth - popoverWidth - 8;
    }
    left = Math.max(8, left);

    if (top + popoverHeight > window.innerHeight - 8) {
      top = rect.top - popoverHeight - 4;
    }

    setPosition({ top, left });
  }, [anchorEl]);

  // Click outside to close
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        saveName();
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose, name, tag.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== tag.name) {
      onUpdate(tag.id, { name: trimmed });
    }
  }, [name, tag.name, tag.id, onUpdate]);

  const handleColorChange = useCallback(
    (newColor: string) => {
      setColor(newColor);
      onUpdate(tag.id, { color: newColor });
    },
    [tag.id, onUpdate],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      saveName();
      onClose();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(tag.id);
    onClose();
  };

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-notion-bg border border-notion-border rounded-lg shadow-lg w-60 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      {/* Preview + Name */}
      <div className="p-3 border-b border-notion-border">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs rounded-full shrink-0"
            style={{
              backgroundColor: color,
              color: getTextColorForBg(color),
            }}
          >
            {name || tag.name}
          </span>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={handleKeyDown}
          placeholder={t("schedule.tagName", "Tag name...")}
          className="w-full text-sm px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
          autoFocus
        />
      </div>

      {/* Color Picker */}
      <div className="border-b border-notion-border">
        <UnifiedColorPicker
          color={color}
          onChange={handleColorChange}
          mode="preset-full"
          inline
        />
      </div>

      {/* Delete */}
      <div className="p-2">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-notion-text-secondary flex-1">
              {t("schedule.deleteTagConfirm", 'Delete "{{name}}"?', {
                name: tag.name,
              })}
            </span>
            <button
              onClick={handleDelete}
              className="text-[11px] px-1.5 py-0.5 rounded bg-red-500 text-white"
            >
              {t("common.delete", "Delete")}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-[11px] text-notion-text-secondary"
            >
              {t("common.cancel", "Cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={13} />
            {t("common.delete", "Delete")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
