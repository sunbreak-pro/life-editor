import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getTextColorForBg } from "../../../constants/folderColors";

export interface TagNodeData {
  label: string;
  color: string;
  textColor?: string;
  usageCount: number;
  selected?: boolean;
}

type TagNodeType = {
  label: string;
  color: string;
  textColor?: string;
  usageCount: number;
  selected?: boolean;
};

function TagNodeComponent({ data }: NodeProps & { data: TagNodeType }) {
  const textColor = data.textColor ?? getTextColorForBg(data.color);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-notion-text-secondary !border-notion-border"
      />
      <div
        className={`px-3 py-1.5 rounded-lg border-2 shadow-sm cursor-grab active:cursor-grabbing transition-shadow ${
          data.selected ? "ring-2 ring-notion-accent ring-offset-1" : ""
        }`}
        style={{
          backgroundColor: `${data.color}E6`,
          borderColor: `${data.color}CC`,
          color: textColor,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold truncate max-w-[100px]">
            {data.label}
          </span>
          {data.usageCount > 0 && (
            <span
              className="text-[9px] opacity-70 tabular-nums"
              style={{ color: textColor }}
            >
              {data.usageCount}
            </span>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-notion-text-secondary !border-notion-border"
      />
    </>
  );
}

export const TagNode = memo(TagNodeComponent);
