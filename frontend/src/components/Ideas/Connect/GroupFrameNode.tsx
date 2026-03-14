import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

type GroupFrameNodeType = {
  name: string;
  width: number;
  height: number;
  tags?: Array<{ id: string; name: string; color: string }>;
};

function GroupFrameNodeComponent({
  data,
}: NodeProps & { data: GroupFrameNodeType }) {
  const tags = data.tags || [];
  const displayTags = tags.slice(0, 5);
  const overflow = tags.length - 5;

  return (
    <div
      className="rounded-xl border-2 border-dashed pointer-events-none"
      style={{
        width: data.width,
        height: data.height,
        borderColor: "var(--notion-border)",
        backgroundColor: "rgba(99, 102, 241, 0.04)",
      }}
    >
      <div
        className="absolute -top-5 left-2 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-notion-bg border border-notion-border"
        style={{ color: "var(--notion-text-secondary)" }}
      >
        <span>{data.name}</span>
        {displayTags.map((tag) => (
          <span
            key={tag.id}
            className="text-[8px] px-1.5 py-0.5 rounded-full text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[8px] text-notion-text-secondary">
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}

export const GroupFrameNode = memo(GroupFrameNodeComponent);
