import { getTextColorForBg } from "../../../constants/folderColors";

interface FolderTagProps {
  tag: string;
  color?: string;
  compact?: boolean;
}

export function FolderTag({ tag, color, compact }: FolderTagProps) {
  if (!tag) return null;

  const textColor = color ? getTextColorForBg(color) : "#6B7280";
  const bgColor = color ?? "#F3F4F6";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium truncate ${
        compact
          ? "px-1.5 py-0 text-[10px] max-w-30"
          : "px-2 py-0.5 text-xs max-w-50"
      }`}
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {tag}
    </span>
  );
}
