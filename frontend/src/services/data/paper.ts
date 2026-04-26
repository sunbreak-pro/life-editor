import type { PaperBoard, PaperEdge, PaperNode } from "../../types/paperBoard";
import { tauriInvoke } from "../bridge";

export const paperApi = {
  fetchPaperBoards(): Promise<PaperBoard[]> {
    return tauriInvoke("db_paper_boards_fetch_all");
  },
  fetchPaperBoardById(id: string): Promise<PaperBoard | null> {
    return tauriInvoke("db_paper_boards_fetch_by_id", { id });
  },
  fetchPaperBoardByNoteId(noteId: string): Promise<PaperBoard | null> {
    return tauriInvoke("db_paper_boards_fetch_by_note_id", {
      noteId,
    });
  },
  createPaperBoard(
    name: string,
    linkedNoteId?: string | null,
  ): Promise<PaperBoard> {
    return tauriInvoke("db_paper_boards_create", {
      name,
      linkedNoteId,
    });
  },
  updatePaperBoard(
    id: string,
    updates: Partial<
      Pick<
        PaperBoard,
        | "name"
        | "linkedNoteId"
        | "viewportX"
        | "viewportY"
        | "viewportZoom"
        | "order"
      >
    >,
  ): Promise<PaperBoard> {
    return tauriInvoke("db_paper_boards_update", { id, updates });
  },
  deletePaperBoard(id: string): Promise<void> {
    return tauriInvoke("db_paper_boards_delete", { id });
  },
  fetchPaperNodeCountsByBoard(): Promise<Record<string, number>> {
    return tauriInvoke("db_paper_nodes_fetch_node_counts");
  },
  fetchPaperNodesByBoard(boardId: string): Promise<PaperNode[]> {
    return tauriInvoke("db_paper_nodes_fetch_by_board", {
      boardId,
    });
  },
  createPaperNode(params: {
    id?: string;
    boardId: string;
    nodeType: PaperNode["nodeType"];
    positionX: number;
    positionY: number;
    width?: number;
    height?: number;
    zIndex?: number;
    parentNodeId?: string | null;
    refEntityId?: string | null;
    refEntityType?: string | null;
    textContent?: string | null;
    frameColor?: string | null;
    frameLabel?: string | null;
    label?: string | null;
    hidden?: boolean;
  }): Promise<PaperNode> {
    return tauriInvoke("db_paper_nodes_create", { params });
  },
  updatePaperNode(
    id: string,
    updates: Partial<
      Pick<
        PaperNode,
        | "positionX"
        | "positionY"
        | "width"
        | "height"
        | "zIndex"
        | "parentNodeId"
        | "textContent"
        | "frameColor"
        | "frameLabel"
        | "label"
        | "hidden"
      >
    >,
  ): Promise<PaperNode> {
    return tauriInvoke("db_paper_nodes_update", { id, updates });
  },
  bulkUpdatePaperNodePositions(
    updates: Array<{
      id: string;
      positionX: number;
      positionY: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return tauriInvoke("db_paper_nodes_bulk_update_positions", { updates });
  },
  bulkUpdatePaperNodeZIndices(
    updates: Array<{
      id: string;
      zIndex: number;
      parentNodeId: string | null;
    }>,
  ): Promise<void> {
    return tauriInvoke("db_paper_nodes_bulk_update_z_indices", { updates });
  },
  deletePaperNode(id: string): Promise<void> {
    return tauriInvoke("db_paper_nodes_delete", { id });
  },
  fetchPaperEdgesByBoard(boardId: string): Promise<PaperEdge[]> {
    return tauriInvoke("db_paper_edges_fetch_by_board", {
      boardId,
    });
  },
  createPaperEdge(params: {
    boardId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    label?: string | null;
    styleJson?: string | null;
  }): Promise<PaperEdge> {
    return tauriInvoke("db_paper_edges_create", { params });
  },
  deletePaperEdge(id: string): Promise<void> {
    return tauriInvoke("db_paper_edges_delete", { id });
  },
};
