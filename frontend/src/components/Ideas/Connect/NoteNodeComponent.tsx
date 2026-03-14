import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StickyNote } from "lucide-react";

type NoteNodeType = {
  title: string;
  contentPreview: string;
  noteId: string;
  color?: string;
  tagDots?: Array<{ id: string; name: string; color: string }>;
  highlighted?: boolean;
  focused?: boolean;
  dimmed?: boolean;
  splitTag?: { id: string; name: string; color: string };
};

function NoteNodeInner({ data }: NodeProps & { data: NoteNodeType }) {
  const [hovered, setHovered] = useState(false);
  const tagDots = data.tagDots || [];

  return (
    <div
      className={`relative transition-opacity ${data.dimmed ? "opacity-10" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(["Top", "Right", "Bottom", "Left"] as const).map((pos) => (
        <span key={pos}>
          <Handle
            type="source"
            position={Position[pos]}
            id={`s-${pos}`}
            className="!opacity-0 !w-2 !h-2"
          />
          <Handle
            type="target"
            position={Position[pos]}
            id={`t-${pos}`}
            className="!opacity-0 !w-2 !h-2"
          />
        </span>
      ))}
      {/* Dot + title */}
      <div className="relative flex flex-col items-center w-5 cursor-grab active:cursor-grabbing">
        <span
          className={`w-3.5 h-3.5 rounded-full bg-yellow-400 dark:bg-yellow-500 ${
            data.focused
              ? "ring-2 ring-blue-400/50"
              : data.highlighted
                ? "ring-2 ring-notion-accent/50"
                : ""
          }`}
          style={data.color ? { backgroundColor: data.color } : undefined}
        />
        <span className="absolute top-full left-1/2 -translate-x-1/2 text-[10px] text-notion-text truncate max-w-[80px] mt-0.5 text-center leading-tight whitespace-nowrap pointer-events-none">
          {data.title}
        </span>
        {data.splitTag && (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-4 text-[8px] px-1 rounded-full text-white whitespace-nowrap pointer-events-none"
            style={{ backgroundColor: data.splitTag.color }}
          >
            {data.splitTag.name}
          </span>
        )}
      </div>

      {/* Hover popup */}
      {hovered && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 pointer-events-none z-50">
          <div className="px-3 py-2 rounded-lg border shadow-lg bg-yellow-50 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700 min-w-[160px] max-w-[220px]">
            <div className="flex items-center gap-1.5">
              <StickyNote
                size={12}
                className={
                  data.color
                    ? "shrink-0"
                    : "shrink-0 text-yellow-600 dark:text-yellow-400"
                }
                style={data.color ? { color: data.color } : undefined}
              />
              <span className="text-xs font-medium truncate text-yellow-900 dark:text-yellow-200">
                {data.title}
              </span>
            </div>
            {data.contentPreview && (
              <p className="text-[9px] mt-1 text-yellow-700/70 dark:text-yellow-300/50 line-clamp-2 leading-tight">
                {data.contentPreview}
              </p>
            )}
            {tagDots.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {tagDots.slice(0, 5).map((dot) => (
                  <span
                    key={dot.id}
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: dot.color }}
                  />
                ))}
                {tagDots.length > 5 && (
                  <span className="text-[8px] text-yellow-700/50 dark:text-yellow-300/40">
                    +{tagDots.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const NoteNodeComponent = memo(NoteNodeInner);
