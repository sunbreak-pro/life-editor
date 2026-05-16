export type PaperNodeType = "card" | "text" | "frame";

export interface PaperBoard {
  id: string;
  name: string;
  linkedNoteId: string | null;
  viewportX: number;
  viewportY: number;
  viewportZoom: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaperNode {
  id: string;
  boardId: string;
  nodeType: PaperNodeType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  zIndex: number;
  parentNodeId: string | null;
  refEntityId: string | null;
  refEntityType: string | null;
  textContent: string | null;
  frameColor: string | null;
  frameLabel: string | null;
  label: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaperEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  styleJson: string | null;
  createdAt: string;
}
