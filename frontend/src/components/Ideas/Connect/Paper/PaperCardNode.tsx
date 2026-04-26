import { memo, useMemo } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { StickyNote, BookOpen, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../../../hooks/useNoteContext";
import { useDailyContext } from "../../../../hooks/useDailyContext";
import { formatDisplayDate } from "../../../../utils/dateKey";
import { getContentPreview } from "../../../../utils/tiptapText";

export type PaperCardData = {
  refEntityId: string | null;
  refEntityType: string | null;
};

function PaperCardNodeInner({
  data,
  selected,
}: NodeProps & { data: PaperCardData }) {
  const isNote = data.refEntityType === "note";
  const isMemo = data.refEntityType === "memo";

  const { notes } = useNoteContext();
  const { dailies } = useDailyContext();
  const { i18n } = useTranslation();

  // Look up referenced entity locally instead of receiving label/preview from
  // the parent. This way editing an unrelated note no longer rebuilds rfNodes
  // and forces React Flow to re-diff every node — only the affected card
  // re-renders via context.
  const { label, contentPreview, isDeleted } = useMemo(() => {
    if (!data.refEntityId) {
      return { label: "Unknown", contentPreview: "", isDeleted: false };
    }
    if (isNote) {
      const note = notes.find((n) => n.id === data.refEntityId);
      if (!note) {
        return { label: "Unknown", contentPreview: "", isDeleted: true };
      }
      return {
        label: note.title || "Untitled",
        contentPreview: getContentPreview(note.content, 100),
        isDeleted: false,
      };
    }
    if (isMemo) {
      const memo = dailies.find((m) => m.id === data.refEntityId);
      if (!memo) {
        return { label: "Unknown", contentPreview: "", isDeleted: true };
      }
      return {
        label: formatDisplayDate(memo.date, i18n.language),
        contentPreview: getContentPreview(memo.content, 100),
        isDeleted: false,
      };
    }
    return { label: "Unknown", contentPreview: "", isDeleted: false };
  }, [data.refEntityId, isNote, isMemo, notes, dailies, i18n.language]);

  return (
    <>
      <NodeResizer
        minWidth={140}
        minHeight={60}
        isVisible={!!selected}
        lineClassName="!border-notion-accent"
        handleClassName="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      {/*
        Bidirectional handles: at each Position we render BOTH a source-type
        and a target-type Handle that share the same id. This lets ConnectionMode.Loose
        save edges with any source/target handle combination without triggering
        React Flow error #008 ("couldn't create edge for source handle id ..."),
        and keeps backward compatibility with edges already saved using the legacy
        "*-source" / "*-target" id suffixes.
      */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-source"
        className="!w-2 !h-2 !bg-transparent !border-0 !pointer-events-none"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-target"
        className="!w-2 !h-2 !bg-transparent !border-0 !pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-source"
        className="!w-2 !h-2 !bg-transparent !border-0 !pointer-events-none"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-target"
        className="!w-2 !h-2 !bg-transparent !border-0 !pointer-events-none"
      />
      <div className="bg-notion-bg border border-notion-border rounded-lg p-3 h-full shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing overflow-hidden">
        {isDeleted ? (
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
                {label}
              </span>
            </div>
            {contentPreview && (
              <p className="text-[10px] text-notion-text-secondary line-clamp-3 leading-tight">
                {contentPreview}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}

export const PaperCardNode = memo(PaperCardNodeInner);
