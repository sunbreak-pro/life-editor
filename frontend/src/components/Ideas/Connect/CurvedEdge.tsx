import type { EdgeProps } from "@xyflow/react";

type CurvedEdgeData = {
  curveOffset?: number;
  connectionType?: string;
  connectionId?: string;
  tagId?: string;
};

const NODE_RADIUS = 5; // w-2.5 = 10px / 2

export function CurvedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}: EdgeProps & { data?: CurvedEdgeData }) {
  const offset = data?.curveOffset ?? 0;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  let sx: number, sy: number, tx: number, ty: number;
  if (dist < NODE_RADIUS * 2) {
    sx = sourceX;
    sy = sourceY;
    tx = targetX;
    ty = targetY;
  } else {
    sx = sourceX + (dx / dist) * NODE_RADIUS;
    sy = sourceY + (dy / dist) * NODE_RADIUS;
    tx = targetX - (dx / dist) * NODE_RADIUS;
    ty = targetY - (dy / dist) * NODE_RADIUS;
  }

  let path: string;
  if (offset === 0) {
    path = `M ${sx} ${sy} L ${tx} ${ty}`;
  } else {
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const edgeDx = tx - sx;
    const edgeDy = ty - sy;
    const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
    const cx = mx + (-edgeDy / edgeLen) * offset;
    const cy = my + (edgeDx / edgeLen) * offset;
    path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
  }

  return (
    <path
      d={path}
      style={style}
      fill="none"
      markerEnd={markerEnd}
      className="react-flow__edge-path"
    />
  );
}
