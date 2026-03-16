import { memo, useState } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";

interface PaperEdgeData {
  onDelete?: (edgeId: string) => void;
}

function PaperCustomEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps & { data?: PaperEdgeData }) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wider invisible hitbox */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20} />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: hovered ? "var(--color-notion-accent)" : undefined,
        }}
      />
      {hovered && data?.onDelete && (
        <foreignObject
          x={labelX - 10}
          y={labelY - 10}
          width={20}
          height={20}
          className="overflow-visible"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(id);
            }}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-sm"
          >
            <X size={10} />
          </button>
        </foreignObject>
      )}
    </g>
  );
}

export const PaperCustomEdge = memo(PaperCustomEdgeInner);
