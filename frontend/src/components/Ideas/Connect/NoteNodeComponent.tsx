import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StickyNote } from "lucide-react";
import { useTagGraphSelection } from "./TagGraphSelectionContext";

type NoteNodeType = {
  title: string;
  contentPreview: string;
  noteId: string;
  color?: string;
  tagDots?: Array<{ id: string; name: string; color: string }>;
  focused?: boolean;
  splitTag?: { id: string; name: string; color: string };
};

function NoteNodeInner({ id, data }: NodeProps & { data: NoteNodeType }) {
  const [hovered, setHovered] = useState(false);
  const tagDots = data.tagDots || [];

  // highlighted/dimmed are derived from the small selection context instead of
  // baked into data, so changing selection doesn't rebuild the entire rfNodes
  // array and force React Flow to re-diff every node. Each node component just
  // re-renders with new highlighted/dimmed values.
  const { selectedTagId, relatedNodeIds } = useTagGraphSelection();
  const highlighted =
    !!selectedTagId && tagDots.some((d) => d.id === selectedTagId);
  const dimmed = relatedNodeIds ? !relatedNodeIds.has(id) : false;
  const focused = !!data.focused;

  return (
    <div
      className={`relative transition-opacity ${dimmed ? "opacity-10" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/*
        Handles are sized to cover the dot (and a small grab margin) so users can
        drag connections from anywhere on the dot in connect mode. Visually hidden
        but pointer-events remain enabled.
      */}
      <Handle
        type="source"
        position={Position.Top}
        id="center-source"
        className="!opacity-0 !border-0"
        style={{
          width: 16,
          height: 16,
          minWidth: 16,
          minHeight: 16,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "transparent",
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="center-target"
        className="!opacity-0 !border-0"
        style={{
          width: 16,
          height: 16,
          minWidth: 16,
          minHeight: 16,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "transparent",
        }}
      />
      {/* Dot */}
      <div className="relative flex flex-col items-center w-2.5 cursor-grab active:cursor-grabbing">
        <span
          className={`w-2.5 h-2.5 rounded-full bg-yellow-400 dark:bg-yellow-500 ${
            focused
              ? "ring-2 ring-blue-400/50"
              : highlighted
                ? "ring-2 ring-notion-accent/50"
                : ""
          }`}
          style={data.color ? { backgroundColor: data.color } : undefined}
        />
        {data.splitTag && (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 text-[8px] px-1 rounded-full text-white whitespace-nowrap pointer-events-none"
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
