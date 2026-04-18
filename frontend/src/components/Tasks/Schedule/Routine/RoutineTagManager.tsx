import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineTag } from "../../../../types/routineTag";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { Button } from "../../../shared/Button";
import { IconButton } from "../../../shared/IconButton";
import { DEFAULT_PRESET_COLORS } from "../../../../constants/folderColors";

interface RoutineTagManagerProps {
  tags: RoutineTag[];
  onCreateTag: (name: string, color: string) => Promise<RoutineTag>;
  onUpdateTag: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color" | "textColor">>,
  ) => void;
  onDeleteTag: (id: number) => void;
  onClose: () => void;
}

export function RoutineTagManager({
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onClose,
}: RoutineTagManagerProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_PRESET_COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState<{
    tagId: number;
    anchor: HTMLElement;
  } | null>(null);

  const startEdit = (tag: RoutineTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    onUpdateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await onCreateTag(trimmed, newColor);
      setNewName("");
    } catch (err) {
      console.error("Failed to create tag:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-notion-text">
            {t("schedule.manageTags", "Manage Tags")}
          </h3>
          <IconButton icon={<X size={16} />} label="Close" onClick={onClose} />
        </div>

        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-notion-hover group"
            >
              {editingId === tag.id ? (
                <>
                  <UnifiedColorPicker
                    color={editColor}
                    onChange={setEditColor}
                    mode="preset-full"
                  />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 text-sm px-1.5 py-0.5 rounded bg-notion-hover text-notion-text outline-none"
                    autoFocus
                  />
                  <IconButton
                    icon={<Check size={12} />}
                    size="sm"
                    onClick={saveEdit}
                    className="text-green-500"
                  />
                  <IconButton
                    icon={<X size={12} />}
                    size="sm"
                    onClick={() => setEditingId(null)}
                  />
                </>
              ) : deleteConfirmId === tag.id ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[11px] text-notion-text-secondary flex-1">
                    {t("schedule.deleteTagConfirm", 'Delete "{{name}}"?', {
                      name: tag.name,
                    })}
                  </span>
                  <button
                    onClick={() => {
                      onDeleteTag(tag.id);
                      setDeleteConfirmId(null);
                    }}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-red-500 text-white"
                  >
                    {t("common.delete", "Delete")}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-[11px] text-notion-text-secondary"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={(e) =>
                      setColorPickerOpen({
                        tagId: tag.id,
                        anchor: e.currentTarget,
                      })
                    }
                    className="w-3 h-3 rounded-full shrink-0 hover:ring-2 hover:ring-notion-border transition-all"
                    style={{ backgroundColor: tag.color }}
                    title={t("colorPicker.backgroundColor", "Color")}
                  />
                  <span className="flex-1 text-sm text-notion-text">
                    {tag.name}
                  </span>
                  <button
                    onClick={() => startEdit(tag)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-notion-text transition-opacity"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(tag.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-[11px] text-notion-text-secondary px-2 py-1">
              No tags yet.
            </p>
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-notion-border pt-2">
          <div className="mb-1">
            <UnifiedColorPicker
              color={newColor}
              onChange={setNewColor}
              mode="preset-full"
            />
          </div>
          <div className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") handleCreate();
              }}
              placeholder={t("schedule.tagName", "Tag name...")}
              className="flex-1 text-sm px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              {t("schedule.createTag", "Create")}
            </Button>
          </div>
        </div>
      </div>
      {colorPickerOpen && (
        <ColorPickerPopover
          anchor={colorPickerOpen.anchor}
          color={
            tags.find((t) => t.id === colorPickerOpen.tagId)?.color ??
            DEFAULT_PRESET_COLORS[0]
          }
          onChange={(color) => {
            onUpdateTag(colorPickerOpen.tagId, { color });
            setColorPickerOpen(null);
          }}
          onClose={() => setColorPickerOpen(null)}
        />
      )}
    </div>
  );
}

interface ColorPickerPopoverProps {
  anchor: HTMLElement;
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

function ColorPickerPopover({
  anchor,
  color,
  onChange,
  onClose,
}: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position] = useState(() => {
    const rect = anchor.getBoundingClientRect();
    const width = 208;
    const height = 280;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    left = Math.max(8, left);
    if (top + height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - height - 4);
    }
    return { top, left };
  });

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[10000] bg-notion-bg border border-notion-border rounded-lg shadow-lg w-52 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <UnifiedColorPicker
        color={color}
        onChange={onChange}
        mode="preset-full"
        inline
      />
    </div>,
    document.body,
  );
}
