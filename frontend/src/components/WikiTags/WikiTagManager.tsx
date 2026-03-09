import { useState } from "react";
import { Pencil, Trash2, Check, X, Merge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { UnifiedColorPicker } from "../shared/UnifiedColorPicker";
import { DEFAULT_PRESET_COLORS } from "../../constants/folderColors";

export function WikiTagManager() {
  const { t } = useTranslation();
  const { tags, assignments, createTag, updateTag, deleteTag, mergeTags } =
    useWikiTags();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(DEFAULT_PRESET_COLORS[0]);

  const startEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const saveEdit = async () => {
    if (editingId === null || !editName.trim()) return;
    await updateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createTag(trimmed, newColor);
    setNewName("");
  };

  const handleMerge = async (targetId: string) => {
    if (!mergeSourceId || mergeSourceId === targetId) return;
    await mergeTags(mergeSourceId, targetId);
    setMergeSourceId(null);
  };

  const getUsageCount = (tagId: string) =>
    assignments.filter((a) => a.tagId === tagId).length;

  return (
    <div>
      <h3 className="text-base font-semibold text-notion-text mb-1">
        {t("wikiTags.title")}
      </h3>
      <p className="text-xs text-notion-text-secondary mb-4">
        {t("wikiTags.description")}
      </p>

      <div className="space-y-1 mb-4 max-h-[400px] overflow-y-auto">
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
                  mode="preset-only"
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
                <span className="text-[11px] text-notion-text-secondary flex-1">
                  {t("wikiTags.deleteConfirm", { name: tag.name })}
                </span>
                <button
                  onClick={() => {
                    deleteTag(tag.id);
                    setDeleteConfirmId(null);
                  }}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-red-500 text-white"
                >
                  {t("common.delete")}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-[11px] text-notion-text-secondary"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : mergeSourceId === tag.id ? (
              <div className="flex items-center gap-2 w-full">
                <span className="text-[11px] text-notion-text-secondary flex-1">
                  {t("wikiTags.mergeSelectTarget")}
                </span>
                <button
                  onClick={() => setMergeSourceId(null)}
                  className="text-[11px] text-notion-text-secondary"
                >
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <>
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-sm text-notion-text truncate">
                  {tag.name}
                </span>
                <span className="text-[10px] text-notion-text-secondary">
                  {getUsageCount(tag.id)}
                </span>
                {mergeSourceId && mergeSourceId !== tag.id ? (
                  <button
                    onClick={() => handleMerge(tag.id)}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-notion-accent text-white"
                  >
                    {t("wikiTags.mergeInto")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(tag)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-notion-text transition-opacity"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setMergeSourceId(tag.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-notion-accent transition-opacity"
                      title={t("wikiTags.merge")}
                    >
                      <Merge size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(tag.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-notion-text-secondary hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-[11px] text-notion-text-secondary px-2 py-3 text-center">
            {t("wikiTags.empty")}
          </p>
        )}
      </div>

      {/* Create new */}
      <div className="border-t border-notion-border pt-3">
        <div className="mb-1.5">
          <UnifiedColorPicker
            color={newColor}
            onChange={setNewColor}
            mode="preset-only"
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
            placeholder={t("wikiTags.tagNamePlaceholder")}
            className="flex-1 text-sm px-2 py-1 rounded bg-notion-hover text-notion-text outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="text-sm px-2 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
          >
            {t("wikiTags.create")}
          </button>
        </div>
      </div>
    </div>
  );
}
