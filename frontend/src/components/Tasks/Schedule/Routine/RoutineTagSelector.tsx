import { useState, useRef, useCallback } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import type { RoutineTag } from "../../../../types/routineTag";
import { InlineColorPicker } from "../../../shared/ColorPicker";
import { TAG_COLORS } from "../../../../constants/tagColors";

interface RoutineTagSelectorProps {
  tags: RoutineTag[];
  selectedTagId: number | null;
  onSelect: (tagId: number | null) => void;
  onCreateTag?: (name: string, color: string) => Promise<RoutineTag>;
}

export function RoutineTagSelector({
  tags,
  selectedTagId,
  onSelect,
  onCreateTag,
}: RoutineTagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setShowCreate(false);
  }, []);
  useClickOutside(dropdownRef, closeDropdown, isOpen);

  const handleCreate = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed || !onCreateTag) return;
    const tag = await onCreateTag(trimmed, newTagColor);
    onSelect(tag.id);
    setNewTagName("");
    setShowCreate(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md hover:bg-notion-hover transition-colors text-notion-text"
      >
        {selectedTag ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedTag.color }}
            />
            <span className="truncate">{selectedTag.name}</span>
          </>
        ) : (
          <span className="text-notion-text-secondary">No tag</span>
        )}
        <ChevronDown size={14} className="ml-auto text-notion-text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-notion-bg border border-notion-border rounded-lg shadow-lg max-h-52 overflow-auto">
          <div className="p-1">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
                selectedTagId === null
                  ? "bg-notion-accent/10"
                  : "hover:bg-notion-hover"
              }`}
            >
              <span className="text-notion-text-secondary">No tag</span>
            </button>

            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  onSelect(tag.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  selectedTagId === tag.id
                    ? "bg-notion-accent/10"
                    : "hover:bg-notion-hover"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-notion-text truncate">{tag.name}</span>
                {selectedTagId === tag.id && (
                  <span className="ml-auto text-notion-accent text-[10px]">
                    &#10003;
                  </span>
                )}
              </button>
            ))}
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
                      className="flex-1 text-xs px-1.5 py-0.5 rounded bg-notion-hover text-notion-text border-none outline-none"
                      autoFocus
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
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-xs text-notion-text-secondary hover:text-notion-text rounded transition-colors"
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
