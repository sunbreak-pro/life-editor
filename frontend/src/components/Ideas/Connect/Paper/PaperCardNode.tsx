import { memo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { StickyNote, BookOpen, AlertTriangle } from "lucide-react";

export type PaperCardData = {
  label: string;
  contentPreview: string;
  refEntityId: string | null;
  refEntityType: string | null;
  deleted?: boolean;
};

function PaperCardNodeInner({
  data,
  selected,
}: NodeProps & { data: PaperCardData }) {
  const isNote = data.refEntityType === "note";
  const isMemo = data.refEntityType === "memo";

  return (
    <>
      <NodeResizer
        minWidth={140}
        minHeight={60}
        isVisible={!!selected}
        lineClassName="!border-notion-accent"
        handleClassName="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <div className="bg-notion-bg border border-notion-border rounded-lg p-3 h-full shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing overflow-hidden">
        {data.deleted ? (
          <div className="flex items-center gap-1.5 text-red-400">
            <AlertTriangle size={14} />
            <span className="text-xs italic">Deleted</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              {isNote && (
                <StickyNote size={12} className="shrink-0 text-yellow-500" />
              )}
              {isMemo && (
                <BookOpen size={12} className="shrink-0 text-blue-500" />
              )}
              <span className="text-xs font-medium truncate text-notion-text">
                {data.label}
              </span>
            </div>
            {data.contentPreview && (
              <p className="text-[10px] text-notion-text-secondary line-clamp-3 leading-tight">
                {data.contentPreview}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

export const PaperCardNode = memo(PaperCardNodeInner);
