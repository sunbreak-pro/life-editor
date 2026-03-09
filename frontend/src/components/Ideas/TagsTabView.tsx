import { useState } from "react";
import { Pencil, Trash2, Check, X, Merge, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWikiTags } from "../../hooks/useWikiTags";
import { InlineColorPicker } from "../shared/ColorPicker";
import { TAG_COLORS } from "../../constants/tagColors";

export function TagsTabView() {
  const { t } = useTranslation();
  const { tags, assignments, createTag, updateTag, deleteTag, mergeTags } =
    useWikiTags();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);

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
    setShowCreate(false);
  };

  const handleMerge = async (targetId: string) => {
    if (!mergeSourceId || mergeSourceId === targetId) return;
    await mergeTags(mergeSourceId, targetId);
    setMergeSourceId(null);
  };

  const getUsageCount = (tagId: string) =>
    assignments.filter((a) => a.tagId === tagId).length;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-notion-text">
            {t("wikiTags.title")}
          </h3>
          <p className="text-xs text-notion-text-secondary mt-0.5">
            {t("wikiTags.description")}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1.5 rounded-md text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover transition-colors"
          title={t("wikiTags.createNew")}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Create new tag */}
      {showCreate && (
        <div className="mb-4 p-3 rounded-lg bg-notion-hover/50 border border-notion-border">
          <div className="mb-2">
            <InlineColorPicker
              colors={TAG_COLORS}
              selectedColor={newColor}
              onSelect={setNewColor}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreate(false);
              }}
              placeholder={t("wikiTags.tagNamePlaceholder")}
              className="flex-1 text-sm px-2 py-1.5 rounded bg-notion-bg text-notion-text outline-none border border-notion-border focus:border-notion-accent/50"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="text-sm px-3 py-1.5 rounded bg-notion-accent text-white disabled:opacity-40"
            >
              {t("wikiTags.create")}
            </button>
          </div>
        </div>
      )}

      {/* Tags grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-1">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-notion-hover group transition-colors"
            >
              {editingId === tag.id ? (
                <>
                  <InlineColorPicker
                    colors={TAG_COLORS}
                    selectedColor={editColor}
                    onSelect={setEditColor}
                    size="sm"
                  />
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 text-sm px-2 py-1 rounded bg-notion-hover text-notion-text outline-none border border-notion-border"
                    autoFocus
                  />
                  <button
                    onClick={saveEdit}
                    className="p-1 text-green-500 hover:text-green-400"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 text-notion-text-secondary hover:text-notion-text"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : deleteConfirmId === tag.id ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-notion-text-secondary flex-1">
                    {t("wikiTags.deleteConfirm", { name: tag.name })}
                  </span>
                  <button
                    onClick={() => {
                      deleteTag(tag.id);
                      setDeleteConfirmId(null);
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-500 text-white"
                  >
                    {t("common.delete")}
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="text-xs text-notion-text-secondary"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : mergeSourceId === tag.id ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-notion-text-secondary flex-1">
                    {t("wikiTags.mergeSelectTarget")}
                  </span>
                  <button
                    onClick={() => setMergeSourceId(null)}
                    className="text-xs text-notion-text-secondary"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-sm text-notion-text truncate">
                    {tag.name}
                  </span>
                  <span className="text-xs text-notion-text-secondary tabular-nums">
                    {getUsageCount(tag.id)}
                  </span>
                  {mergeSourceId && mergeSourceId !== tag.id ? (
                    <button
                      onClick={() => handleMerge(tag.id)}
                      className="text-xs px-2 py-1 rounded bg-notion-accent text-white"
                    >
                      {t("wikiTags.mergeInto")}
                    </button>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(tag)}
                        className="p-1 text-notion-text-secondary hover:text-notion-text"
                        title={t("wikiTags.editTag")}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setMergeSourceId(tag.id)}
                        className="p-1 text-notion-text-secondary hover:text-notion-accent"
                        title={t("wikiTags.merge")}
                      >
                        <Merge size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(tag.id)}
                        className="p-1 text-notion-text-secondary hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {tags.length === 0 && (
            <p className="text-xs text-notion-text-secondary px-3 py-6 text-center">
              {t("wikiTags.empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
