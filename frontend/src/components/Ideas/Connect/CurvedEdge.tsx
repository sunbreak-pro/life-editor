import { getStraightPath, type EdgeProps } from "@xyflow/react";

type CurvedEdgeData = {
  curveOffset?: number;
  connectionType?: string;
  connectionId?: string;
  tagId?: string;
};

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

  let path: string;
  if (offset === 0) {
    [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  } else {
    const mx = (sourceX + targetX) / 2;
    const my = (sourceY + targetY) / 2;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular offset
    const cx = mx + (-dy / len) * offset;
    const cy = my + (dx / len) * offset;
    path = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
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
