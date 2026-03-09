import type { WikiTag } from "../../types/wikiTag";

interface WikiTagChipProps {
  tag: WikiTag;
  size?: "sm" | "md";
  onRemove?: () => void;
  onClick?: () => void;
}

export function WikiTagChip({
  tag,
  size = "sm",
  onRemove,
  onClick,
}: WikiTagChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      style={{
        backgroundColor: `${tag.color}18`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
      onClick={onClick}
    >
      <span className="font-medium truncate max-w-[120px]">{tag.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 ml-0.5"
        >
          &times;
        </button>
      )}
    </span>
  );
}
