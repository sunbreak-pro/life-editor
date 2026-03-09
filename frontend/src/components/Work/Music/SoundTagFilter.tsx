import { X } from "lucide-react";
import type { useSoundTags } from "../../../hooks/useSoundTags";
import { getTextColorForBg } from "../../../constants/folderColors";

interface SoundTagFilterProps {
  soundTagState: ReturnType<typeof useSoundTags>;
}

export function SoundTagFilter({ soundTagState }: SoundTagFilterProps) {
  const { soundTags, filterTagIds, toggleFilterTag, clearFilter } =
    soundTagState;

  if (soundTags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {soundTags.map((tag) => {
        const isActive = filterTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => toggleFilterTag(tag.id)}
            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium transition-opacity ${
              isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
            }`}
            style={{
              backgroundColor: `${tag.color}E6`,
              color: getTextColorForBg(tag.color),
              fontWeight: "bold",
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {filterTagIds.length > 0 && (
        <button
          onClick={clearFilter}
          className="text-notion-text-secondary hover:text-notion-text p-0.5 rounded"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
