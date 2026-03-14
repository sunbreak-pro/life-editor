/** Layout template functions for Connect graph */

export function applyPolygonLayout(
  nodeIds: string[],
  center: { x: number; y: number },
  radius: number,
): Record<string, { x: number; y: number }> {
  const n = nodeIds.length;
  if (n === 0) return {};
  if (n === 1) return { [nodeIds[0]]: center };

  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions[nodeIds[i]] = {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }
  return positions;
}

export function applyLineLayout(
  nodeIds: string[],
  start: { x: number; y: number },
  spacing: number,
  direction: "horizontal" | "vertical" = "horizontal",
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (let i = 0; i < nodeIds.length; i++) {
    positions[nodeIds[i]] = {
      x: start.x + (direction === "horizontal" ? i * spacing : 0),
      y: start.y + (direction === "vertical" ? i * spacing : 0),
    };
  }
  return positions;
}
