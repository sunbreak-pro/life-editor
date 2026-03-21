import {
  forceSimulation,
  forceCenter,
  forceManyBody,
  forceLink,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

interface ForceNode extends SimulationNodeDatum {
  id: string;
}

export function computeForceLayout(
  nodeIds: string[],
  links: Array<{ source: string; target: string }>,
  options?: {
    chargeStrength?: number;
    linkDistance?: number;
    iterations?: number;
  },
): Record<string, { x: number; y: number }> {
  const {
    chargeStrength = -120,
    linkDistance = 80,
    iterations = 300,
  } = options ?? {};

  const nodes: ForceNode[] = nodeIds.map((id) => ({ id }));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const simLinks: SimulationLinkDatum<ForceNode>[] = links
    .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
    .map((l) => ({
      source: nodeMap.get(l.source)!,
      target: nodeMap.get(l.target)!,
    }));

  const simulation = forceSimulation(nodes)
    .force("center", forceCenter(0, 0))
    .force("charge", forceManyBody().strength(chargeStrength))
    .force(
      "link",
      forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(simLinks).distance(
        linkDistance,
      ),
    )
    .force("collide", forceCollide(25))
    .stop();

  simulation.tick(iterations);

  const result: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    result[node.id] = { x: node.x ?? 0, y: node.y ?? 0 };
  }
  return result;
}
