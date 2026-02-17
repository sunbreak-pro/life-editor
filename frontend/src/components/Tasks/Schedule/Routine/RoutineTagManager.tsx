import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineTag } from "../../../../types/routineTag";

const DEFAULT_COLORS = [
  "#D9730D",
  "#2EAADC",
  "#6940A5",
  "#E03E3E",
  "#0F7B6C",
  "#DFAB01",
  "#AD1457",
  "#808080",
];

interface RoutineTagManagerProps {
  tags: RoutineTag[];
  onCreateTag: (name: string, color: string) => Promise<RoutineTag>;
  onUpdateTag: (
    id: number,
    updates: Partial<Pick<RoutineTag, "name" | "color">>,
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
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);

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
    await onCreateTag(trimmed, newColor);
    setNewName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {t("schedule.manageTags", "Manage Tags")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-notion-hover group"
            >
              {editingId === tag.id ? (
                <>
                  <div className="flex gap-0.5">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-3 h-3 rounded-full ${
                          editColor === c
                            ? "ring-1 ring-notion-text scale-125"
                            : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 text-xs px-1.5 py-0.5 rounded bg-notion-hover text-notion-text outline-none"
                    autoFocus
                  />
                  <button onClick={saveEdit} className="p-0.5 text-green-500">
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-0.5 text-notion-text-secondary"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : deleteConfirmId === tag.id ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[10px] text-notion-text-secondary flex-1">
                    {t("schedule.deleteTagConfirm", 'Delete "{{name}}"?', {
                      name: tag.name,
                    })}
                  </span>
                  <button
                    onClick={() => {
                      onDeleteTag(tag.id);
                      setDeleteConfirmId(null);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white"
                  >
                    {t("common.delete", "Delete")}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-[10px] text-notion-text-secondary"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-xs text-notion-text">
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
            <p className="text-[10px] text-notion-text-secondary px-2 py-1">
              No tags yet.
            </p>
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-notion-border pt-2">
          <div className="flex gap-0.5 mb-1">
            {DEFAULT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-3.5 h-3.5 rounded-full ${
                  newColor === c ? "ring-1 ring-notion-text scale-125" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder={t("schedule.tagName", "Tag name...")}
              className="flex-1 text-xs px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="text-xs px-2 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
            >
              {t("schedule.createTag", "Create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
