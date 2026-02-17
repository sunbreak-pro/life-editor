import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { ColorPicker } from "../../shared/ColorPicker";
import type { useSoundTags } from "../../../hooks/useSoundTags";

interface SoundTagManagerProps {
  soundTagState: ReturnType<typeof useSoundTags>;
}

export function SoundTagManager({ soundTagState }: SoundTagManagerProps) {
  const { soundTags, createTag, updateTag, deleteTag } = soundTagState;
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#808080");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);

  const startEdit = (id: number, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
    setShowEditColorPicker(false);
  };

  const saveEdit = async () => {
    if (editingId === null || !editName.trim()) return;
    await updateTag(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
    setShowEditColorPicker(false);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await createTag(trimmed, newColor);
    setNewName("");
    setShowNewColorPicker(false);
  };

  const handleDelete = async (id: number) => {
    await deleteTag(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="bg-notion-bg-secondary border border-notion-border rounded-lg p-3 mb-4">
      <h4 className="text-xs font-semibold text-notion-text-secondary uppercase tracking-wider mb-2">
        Manage Tags
      </h4>

      <div className="space-y-1.5 mb-3">
        {soundTags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-notion-hover group"
          >
            {editingId === tag.id ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowEditColorPicker(!showEditColorPicker)}
                    className="w-5 h-5 rounded-full shrink-0 ring-1 ring-notion-border hover:ring-notion-text/30 transition-shadow"
                    style={{ backgroundColor: editColor }}
                  />
                  {showEditColorPicker && (
                    <ColorPicker
                      currentColor={editColor}
                      onSelect={setEditColor}
                      onClose={() => setShowEditColorPicker(false)}
                    />
                  )}
                </div>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 text-sm px-2 py-0.5 rounded bg-notion-hover text-notion-text border-none outline-none"
                  autoFocus
                />
                <button
                  onClick={saveEdit}
                  className="p-1 text-green-500 hover:text-green-600"
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
                  Delete &ldquo;{tag.name}&rdquo;?
                </span>
                <button
                  onClick={() => handleDelete(tag.id)}
                  className="text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="text-xs px-2 py-0.5 rounded text-notion-text-secondary hover:text-notion-text"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-sm text-notion-text">
                  {tag.name}
                </span>
                <button
                  onClick={() => startEdit(tag.id, tag.name, tag.color)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-text transition-opacity"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(tag.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-notion-text-secondary hover:text-notion-danger transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
        {soundTags.length === 0 && (
          <p className="text-sm text-notion-text-secondary px-2">
            No tags created yet.
          </p>
        )}
      </div>

      {/* Create new tag */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowNewColorPicker(!showNewColorPicker)}
            className="w-5 h-5 rounded-full shrink-0 ring-1 ring-notion-border hover:ring-notion-text/30 transition-shadow"
            style={{ backgroundColor: newColor }}
          />
          {showNewColorPicker && (
            <ColorPicker
              currentColor={newColor}
              onSelect={setNewColor}
              onClose={() => setShowNewColorPicker(false)}
            />
          )}
        </div>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="New tag name..."
          className="flex-1 text-sm px-2 py-1 rounded bg-notion-hover text-notion-text border-none outline-none"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="text-sm px-3 py-1 rounded bg-notion-accent text-white disabled:opacity-40"
        >
          Create
        </button>
      </div>
    </div>
  );
}
