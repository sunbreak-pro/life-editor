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
};

function NoteNodeInner({ data }: NodeProps & { data: NoteNodeType }) {
  const [hoveredDot, setHoveredDot] = useState<string | null>(null);
  const tagDots = data.tagDots || [];

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-notion-text-secondary !border-notion-border"
      />
      <div
        className={`px-3 py-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing bg-yellow-50 dark:bg-yellow-900 max-w-[180px] ${data.focused ? "ring-2 ring-blue-400/50 border-blue-500 shadow-md" : data.highlighted ? "border-notion-accent ring-2 ring-notion-accent/30" : "border-yellow-300 dark:border-yellow-700"}`}
      >
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
        {/* Tag dots */}
        {tagDots.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {tagDots.slice(0, 5).map((dot) => (
              <div key={dot.id} className="relative">
                <span
                  className="w-2 h-2 rounded-full inline-block cursor-pointer"
                  style={{ backgroundColor: dot.color }}
                  onMouseEnter={() => setHoveredDot(dot.id)}
                  onMouseLeave={() => setHoveredDot(null)}
                />
                {hoveredDot === dot.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-gray-900 text-white text-[9px] whitespace-nowrap z-50 pointer-events-none">
                    {dot.name}
                  </div>
                )}
              </div>
            ))}
            {tagDots.length > 5 && (
              <span className="text-[8px] text-yellow-700/50 dark:text-yellow-300/40">
                +{tagDots.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-notion-text-secondary !border-notion-border"
      />
    </>
  );
}

export const NoteNodeComponent = memo(NoteNodeInner);
