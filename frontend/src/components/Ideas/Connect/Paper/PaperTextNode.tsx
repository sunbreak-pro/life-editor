import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { measureTextDimensions } from "../../../../utils/measureTextDimensions";

export type PaperTextData = {
  textContent: string;
  onTextChange?: (nodeId: string, text: string) => void;
  onResize?: (nodeId: string, width: number, height: number) => void;
};

function PaperTextNodeInner({
  id,
  data,
  selected,
}: NodeProps & { data: PaperTextData }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.textContent || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(data.textContent || "");
  }, [data.textContent]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (text !== data.textContent) {
      data.onTextChange?.(id, text);
    }
    if (data.onResize && text) {
      const { width, height } = measureTextDimensions({
        text,
        minWidth: 100,
        minHeight: 40,
        maxWidth: 400,
        padding: 8,
      });
      data.onResize(id, width, height);
    }
  }, [id, text, data]);

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={40}
        isVisible={!!selected}
        lineClassName="!border-notion-accent"
        handleClassName="!w-2 !h-2 !bg-notion-accent !border-notion-accent"
      />
      {/* See PaperCardNode.tsx for the bidirectional-handle rationale. */}
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
      <div
        className="bg-notion-bg/80 border border-dashed border-notion-border rounded p-2 h-full cursor-grab active:cursor-grabbing"
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                handleBlur();
              }
            }}
            className="w-full h-full bg-transparent text-xs text-notion-text resize-none outline-none nodrag"
          />
        ) : (
          <p className="text-xs text-notion-text whitespace-pre-wrap break-words">
            {text || "Double-click to edit..."}
          </p>
        )}
      </div>
    </>
  );
}

export const PaperTextNode = memo(PaperTextNodeInner);
