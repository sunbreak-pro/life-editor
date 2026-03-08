export interface TerminalLeaf {
  type: "leaf";
  id: string;
  sessionId: string;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: TerminalLayoutNode[];
  sizes: number[];
}

export type TerminalLayoutNode = TerminalLeaf | SplitNode;

export interface TerminalPanelState {
  root: TerminalLayoutNode;
  activePaneId: string;
}
