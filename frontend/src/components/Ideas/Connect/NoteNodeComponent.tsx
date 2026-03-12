import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StickyNote } from "lucide-react";

type NoteNodeType = {
  title: string;
  contentPreview: string;
  noteId: string;
  color?: string;
};

function NoteNodeInner({ data }: NodeProps & { data: NoteNodeType }) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-notion-text-secondary !border-notion-border"
      />
      <div className="px-3 py-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing bg-yellow-50 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700 max-w-[160px]">
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
