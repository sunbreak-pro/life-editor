import { useState, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import type { useSoundTags } from "../../../hooks/useSoundTags";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { useConfirmableSubmit } from "../../../hooks/useConfirmableSubmit";
import { InlineColorPicker } from "../../shared/ColorPicker";
import { TAG_COLORS } from "../../../constants/tagColors";

interface SoundTagEditorProps {
  soundId: string;
  soundTagState: ReturnType<typeof useSoundTags>;
  hidePills?: boolean;
}

export function SoundTagEditor({
  soundId,
  soundTagState,
  hidePills,
}: SoundTagEditorProps) {
  const { soundTags, getTagsForSound, setTagsForSound, createTag } =
    soundTagState;
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTags = getTagsForSound(soundId);
  const currentTagIds = currentTags.map((t) => t.id);

  const closeDropdown = useCallback(() => setIsOpen(false), []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const toggleTag = (tagId: number) => {
    const next = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId];
    setTagsForSound(soundId, next);
  };

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    const tag = await createTag(trimmed, newTagColor);
    setTagsForSound(soundId, [...currentTagIds, tag.id]);
    setNewTagName("");
  };

  const {
    inputRef: newTagInputRef,
    handleKeyDown: newTagHandleKeyDown,
    handleBlur: newTagHandleBlur,
    handleFocus: newTagHandleFocus,
  } = useConfirmableSubmit(handleCreate);

  return (
    <div
      className={`flex items-center gap-1 flex-wrap ${hidePills ? "" : "mt-0.5"}`}
      ref={dropdownRef}
    >
      {!hidePills &&
        currentTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] rounded-full text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tag.id)}
              className="hover:opacity-70"
            >
              <X size={8} />
            </button>
          </span>
        ))}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-[10px] text-notion-text-secondary hover:text-notion-text px-1 rounded hover:bg-notion-hover transition-colors"
      >
        <Plus size={14} />
      </button>

      {isOpen && (
        <div className="absolute mt-1 z-50 bg-notion-bg border border-notion-border rounded-lg shadow-lg w-48 max-h-60 overflow-auto">
          <div className="p-1">
            {soundTags.length === 0 && (
              <div className="px-3 py-2 text-xs text-notion-text-secondary">
                No tags yet
              </div>
            )}
            {soundTags.map((tag) => {
              const isSelected = currentTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1 text-xs rounded-md transition-colors ${
                    isSelected ? "bg-notion-accent/10" : "hover:bg-notion-hover"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-notion-text truncate">{tag.name}</span>
                  {isSelected && (
                    <span className="ml-auto text-notion-accent text-[10px]">
                      &#10003;
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="border-t border-notion-border p-1.5">
            <div className="mb-1">
              <InlineColorPicker
                colors={TAG_COLORS}
                selectedColor={newTagColor}
                onSelect={setNewTagColor}
              />
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={newTagInputRef}
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={newTagHandleKeyDown}
                onBlur={newTagHandleBlur}
                onFocus={newTagHandleFocus}
                placeholder="New tag..."
                className="flex-1 text-xs px-1.5 py-0.5 rounded bg-notion-hover text-notion-text border-none outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={!newTagName.trim()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-notion-accent text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
