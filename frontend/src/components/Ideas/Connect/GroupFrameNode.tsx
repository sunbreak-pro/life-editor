import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

type GroupFrameNodeType = {
  name: string;
  width: number;
  height: number;
};

function GroupFrameNodeComponent({
  data,
}: NodeProps & { data: GroupFrameNodeType }) {
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
        className="absolute -top-5 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-notion-bg border border-notion-border"
        style={{ color: "var(--notion-text-secondary)" }}
      >
        {data.name}
      </div>
    </div>
  );
}

export const GroupFrameNode = memo(GroupFrameNodeComponent);
