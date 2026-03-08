import type { TerminalLeaf, TerminalLayoutNode } from "../types/terminalLayout";

let paneCounter = 0;

export function createLeaf(sessionId: string): TerminalLeaf {
  return {
    type: "leaf",
    id: `pane-${Date.now()}-${paneCounter++}`,
    sessionId,
  };
}

export function createInitialLayout(sessionId: string): TerminalLayoutNode {
  return createLeaf(sessionId);
}

export function collectLeaves(node: TerminalLayoutNode): TerminalLeaf[] {
  if (node.type === "leaf") return [node];
  return node.children.flatMap(collectLeaves);
}

export function countLeaves(node: TerminalLayoutNode): number {
  if (node.type === "leaf") return 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

export function findLeaf(
  node: TerminalLayoutNode,
  paneId: string,
): TerminalLeaf | null {
  if (node.type === "leaf") return node.id === paneId ? node : null;
  for (const child of node.children) {
    const found = findLeaf(child, paneId);
    if (found) return found;
  }
  return null;
}

let splitCounter = 0;

export function splitPane(
  root: TerminalLayoutNode,
  targetPaneId: string,
  newLeaf: TerminalLeaf,
  direction: "horizontal" | "vertical",
): TerminalLayoutNode {
  if (root.type === "leaf") {
    if (root.id === targetPaneId) {
      return {
        type: "split",
        id: `split-${Date.now()}-${splitCounter++}`,
        direction,
        children: [root, newLeaf],
        sizes: [50, 50],
      };
    }
    return root;
  }

  return {
    ...root,
    children: root.children.map((child) =>
      splitPane(child, targetPaneId, newLeaf, direction),
    ),
  };
}

export function removePane(
  root: TerminalLayoutNode,
  targetPaneId: string,
): TerminalLayoutNode | null {
  if (root.type === "leaf") {
    return root.id === targetPaneId ? null : root;
  }

  const newChildren: TerminalLayoutNode[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    const result =
      child.type === "leaf"
        ? child.id === targetPaneId
          ? null
          : child
        : removePane(child, targetPaneId);
    if (result) {
      newChildren.push(result);
      newSizes.push(root.sizes[i]);
    }
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  const totalSize = newSizes.reduce((a, b) => a + b, 0);
  const normalizedSizes = newSizes.map((s) => (s / totalSize) * 100);

  return { ...root, children: newChildren, sizes: normalizedSizes };
}

export function updateSplitSizes(
  root: TerminalLayoutNode,
  splitId: string,
  sizes: number[],
): TerminalLayoutNode {
  if (root.type === "leaf") return root;

  if (root.id === splitId) {
    return { ...root, sizes };
  }

  return {
    ...root,
    children: root.children.map((child) =>
      updateSplitSizes(child, splitId, sizes),
    ),
  };
}
