import { useState, useRef, useCallback } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import type { RoutineTag } from "../../../../types/routineTag";
import { InlineColorPicker } from "../../../shared/ColorPicker";
import { TAG_COLORS } from "../../../../constants/tagColors";

interface RoutineTagSelectorProps {
  tags: RoutineTag[];
  selectedTagIds: number[];
  onSelect: (tagIds: number[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<RoutineTag>;
}

export function RoutineTagSelector({
  tags,
  selectedTagIds,
  onSelect,
  onCreateTag,
}: RoutineTagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setShowCreate(false);
  }, []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onSelect(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelect([...selectedTagIds, tagId]);
    }
  };

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed || !onCreateTag) return;
    const tag = await onCreateTag(trimmed, newTagColor);
    onSelect([...selectedTagIds, tag.id]);
    setNewTagName("");
    setShowCreate(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-base bg-transparent border border-notion-border rounded-md hover:bg-notion-hover transition-colors text-notion-text"
      >
        {selectedTags.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-1.5 py-0 text-[11px] rounded-full text-white shrink-0"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-notion-text-secondary">No tags</span>
        )}
        <ChevronDown
          size={14}
          className="ml-auto text-notion-text-secondary shrink-0"
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-notion-bg border border-notion-border rounded-lg shadow-lg max-h-52 overflow-auto">
          <div className="p-1">
            {tags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isSelected ? "bg-notion-accent/10" : "hover:bg-notion-hover"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-notion-text truncate">{tag.name}</span>
                  {isSelected && (
                    <span className="ml-auto text-notion-accent text-[11px]">
                      &#10003;
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {onCreateTag && (
            <div className="border-t border-notion-border p-1.5">
              {showCreate ? (
                <div>
                  <div className="mb-1">
                    <InlineColorPicker
                      colors={TAG_COLORS}
                      selectedColor={newTagColor}
                      onSelect={setNewTagColor}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Enter") handleCreate();
                        if (e.key === "Escape") setShowCreate(false);
                      }}
                      placeholder="Tag name..."
                      className="flex-1 text-sm px-1.5 py-0.5 rounded bg-notion-hover text-notion-text border-none outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleCreate}
                      disabled={!newTagName.trim()}
                      className="text-[11px] px-1.5 py-0.5 rounded bg-notion-accent text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-sm text-notion-text-secondary hover:text-notion-text rounded transition-colors"
                >
                  <Plus size={12} />
                  Create tag
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
