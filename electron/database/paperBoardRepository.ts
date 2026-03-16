import type Database from "better-sqlite3";
import type { PaperBoard, PaperNode, PaperEdge } from "../types";

// --- Row types (snake_case) ---

interface BoardRow {
  id: string;
  name: string;
  linked_note_id: string | null;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  order: number;
  created_at: string;
  updated_at: string;
}

interface NodeRow {
  id: string;
  board_id: string;
  node_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  z_index: number;
  parent_node_id: string | null;
  ref_entity_id: string | null;
  ref_entity_type: string | null;
  text_content: string | null;
  frame_color: string | null;
  frame_label: string | null;
  created_at: string;
  updated_at: string;
}

interface EdgeRow {
  id: string;
  board_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  target_handle: string | null;
  label: string | null;
  style_json: string | null;
  created_at: string;
}

// --- Row → Domain converters ---

function rowToBoard(row: BoardRow): PaperBoard {
  return {
    id: row.id,
    name: row.name,
    linkedNoteId: row.linked_note_id,
    viewportX: row.viewport_x,
    viewportY: row.viewport_y,
    viewportZoom: row.viewport_zoom,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToNode(row: NodeRow): PaperNode {
  return {
    id: row.id,
    boardId: row.board_id,
    nodeType: row.node_type as PaperNode["nodeType"],
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    zIndex: row.z_index,
    parentNodeId: row.parent_node_id,
    refEntityId: row.ref_entity_id,
    refEntityType: row.ref_entity_type,
    textContent: row.text_content,
    frameColor: row.frame_color,
    frameLabel: row.frame_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEdge(row: EdgeRow): PaperEdge {
  return {
    id: row.id,
    boardId: row.board_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    sourceHandle: row.source_handle,
    targetHandle: row.target_handle,
    label: row.label,
    styleJson: row.style_json,
    createdAt: row.created_at,
  };
}

// --- Repository factory ---

export function createPaperBoardRepository(db: Database.Database) {
  const stmts = {
    // Boards
    fetchAllBoards: db.prepare(
      `SELECT * FROM paper_boards ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchBoardById: db.prepare(`SELECT * FROM paper_boards WHERE id = ?`),
    fetchBoardByNoteId: db.prepare(
      `SELECT * FROM paper_boards WHERE linked_note_id = ?`,
    ),
    insertBoard: db.prepare(`
      INSERT INTO paper_boards (id, name, linked_note_id, viewport_x, viewport_y, viewport_zoom, "order", created_at, updated_at)
      VALUES (@id, @name, @linked_note_id, @viewport_x, @viewport_y, @viewport_zoom, @order, @created_at, @updated_at)
    `),
    updateBoard: db.prepare(`
      UPDATE paper_boards
      SET name = @name, linked_note_id = @linked_note_id,
          viewport_x = @viewport_x, viewport_y = @viewport_y, viewport_zoom = @viewport_zoom,
          "order" = @order, updated_at = @updated_at
      WHERE id = @id
    `),
    deleteBoard: db.prepare(`DELETE FROM paper_boards WHERE id = ?`),

    // Nodes
    fetchNodesByBoard: db.prepare(
      `SELECT * FROM paper_nodes WHERE board_id = ? ORDER BY z_index ASC`,
    ),
    fetchNodeById: db.prepare(`SELECT * FROM paper_nodes WHERE id = ?`),
    insertNode: db.prepare(`
      INSERT INTO paper_nodes (id, board_id, node_type, position_x, position_y, width, height, z_index, parent_node_id, ref_entity_id, ref_entity_type, text_content, frame_color, frame_label, created_at, updated_at)
      VALUES (@id, @board_id, @node_type, @position_x, @position_y, @width, @height, @z_index, @parent_node_id, @ref_entity_id, @ref_entity_type, @text_content, @frame_color, @frame_label, @created_at, @updated_at)
    `),
    updateNode: db.prepare(`
      UPDATE paper_nodes
      SET position_x = @position_x, position_y = @position_y, width = @width, height = @height,
          z_index = @z_index, parent_node_id = @parent_node_id,
          text_content = @text_content, frame_color = @frame_color, frame_label = @frame_label,
          updated_at = @updated_at
      WHERE id = @id
    `),
    updateNodePosition: db.prepare(`
      UPDATE paper_nodes SET position_x = @position_x, position_y = @position_y, parent_node_id = @parent_node_id, updated_at = @updated_at WHERE id = @id
    `),
    deleteNode: db.prepare(`DELETE FROM paper_nodes WHERE id = ?`),

    // Edges
    fetchEdgesByBoard: db.prepare(
      `SELECT * FROM paper_edges WHERE board_id = ? ORDER BY created_at ASC`,
    ),
    insertEdge: db.prepare(`
      INSERT INTO paper_edges (id, board_id, source_node_id, target_node_id, source_handle, target_handle, label, style_json, created_at)
      VALUES (@id, @board_id, @source_node_id, @target_node_id, @source_handle, @target_handle, @label, @style_json, @created_at)
    `),
    deleteEdge: db.prepare(`DELETE FROM paper_edges WHERE id = ?`),
  };

  const bulkUpdatePositionsTx = db.transaction(
    (
      updates: Array<{
        id: string;
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      }>,
    ) => {
      const now = new Date().toISOString();
      for (const u of updates) {
        stmts.updateNodePosition.run({
          id: u.id,
          position_x: u.positionX,
          position_y: u.positionY,
          parent_node_id: u.parentNodeId,
          updated_at: now,
        });
      }
    },
  );

  return {
    // --- Boards ---
    fetchAllBoards(): PaperBoard[] {
      return (stmts.fetchAllBoards.all() as BoardRow[]).map(rowToBoard);
    },

    fetchBoardById(id: string): PaperBoard | null {
      const row = stmts.fetchBoardById.get(id) as BoardRow | undefined;
      return row ? rowToBoard(row) : null;
    },

    fetchBoardByNoteId(noteId: string): PaperBoard | null {
      const row = stmts.fetchBoardByNoteId.get(noteId) as BoardRow | undefined;
      return row ? rowToBoard(row) : null;
    },

    createBoard(name: string, linkedNoteId?: string | null): PaperBoard {
      const now = new Date().toISOString();
      const id = `pb-${crypto.randomUUID()}`;
      const maxOrder =
        (
          db.prepare(`SELECT MAX("order") as m FROM paper_boards`).get() as {
            m: number | null;
          }
        ).m ?? -1;
      stmts.insertBoard.run({
        id,
        name,
        linked_note_id: linkedNoteId ?? null,
        viewport_x: 0,
        viewport_y: 0,
        viewport_zoom: 1,
        order: maxOrder + 1,
        created_at: now,
        updated_at: now,
      });
      return rowToBoard(stmts.fetchBoardById.get(id) as BoardRow);
    },

    updateBoard(
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
    ): PaperBoard {
      const existing = stmts.fetchBoardById.get(id) as BoardRow;
      if (!existing) throw new Error(`Board not found: ${id}`);
      const now = new Date().toISOString();
      stmts.updateBoard.run({
        id,
        name: updates.name ?? existing.name,
        linked_note_id:
          updates.linkedNoteId !== undefined
            ? updates.linkedNoteId
            : existing.linked_note_id,
        viewport_x: updates.viewportX ?? existing.viewport_x,
        viewport_y: updates.viewportY ?? existing.viewport_y,
        viewport_zoom: updates.viewportZoom ?? existing.viewport_zoom,
        order: updates.order ?? existing.order,
        updated_at: now,
      });
      return rowToBoard(stmts.fetchBoardById.get(id) as BoardRow);
    },

    deleteBoard(id: string): void {
      stmts.deleteBoard.run(id);
    },

    // --- Nodes ---
    fetchNodesByBoard(boardId: string): PaperNode[] {
      return (stmts.fetchNodesByBoard.all(boardId) as NodeRow[]).map(rowToNode);
    },

    createNode(params: {
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
    }): PaperNode {
      const now = new Date().toISOString();
      const id = `pn-${crypto.randomUUID()}`;
      stmts.insertNode.run({
        id,
        board_id: params.boardId,
        node_type: params.nodeType,
        position_x: params.positionX,
        position_y: params.positionY,
        width: params.width ?? 200,
        height: params.height ?? 100,
        z_index: params.zIndex ?? 0,
        parent_node_id: params.parentNodeId ?? null,
        ref_entity_id: params.refEntityId ?? null,
        ref_entity_type: params.refEntityType ?? null,
        text_content: params.textContent ?? null,
        frame_color: params.frameColor ?? null,
        frame_label: params.frameLabel ?? null,
        created_at: now,
        updated_at: now,
      });
      return rowToNode(stmts.fetchNodeById.get(id) as NodeRow);
    },

    updateNode(
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
        >
      >,
    ): PaperNode {
      const existing = stmts.fetchNodeById.get(id) as NodeRow;
      if (!existing) throw new Error(`Node not found: ${id}`);
      const now = new Date().toISOString();
      stmts.updateNode.run({
        id,
        position_x: updates.positionX ?? existing.position_x,
        position_y: updates.positionY ?? existing.position_y,
        width: updates.width ?? existing.width,
        height: updates.height ?? existing.height,
        z_index: updates.zIndex ?? existing.z_index,
        parent_node_id:
          updates.parentNodeId !== undefined
            ? updates.parentNodeId
            : existing.parent_node_id,
        text_content:
          updates.textContent !== undefined
            ? updates.textContent
            : existing.text_content,
        frame_color:
          updates.frameColor !== undefined
            ? updates.frameColor
            : existing.frame_color,
        frame_label:
          updates.frameLabel !== undefined
            ? updates.frameLabel
            : existing.frame_label,
        updated_at: now,
      });
      return rowToNode(stmts.fetchNodeById.get(id) as NodeRow);
    },

    bulkUpdatePositions(
      updates: Array<{
        id: string;
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      }>,
    ): void {
      bulkUpdatePositionsTx(updates);
    },

    deleteNode(id: string): void {
      stmts.deleteNode.run(id);
    },

    // --- Edges ---
    fetchEdgesByBoard(boardId: string): PaperEdge[] {
      return (stmts.fetchEdgesByBoard.all(boardId) as EdgeRow[]).map(rowToEdge);
    },

    createEdge(params: {
      boardId: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
      label?: string | null;
      styleJson?: string | null;
    }): PaperEdge {
      const now = new Date().toISOString();
      const id = `pe-${crypto.randomUUID()}`;
      stmts.insertEdge.run({
        id,
        board_id: params.boardId,
        source_node_id: params.sourceNodeId,
        target_node_id: params.targetNodeId,
        source_handle: params.sourceHandle ?? null,
        target_handle: params.targetHandle ?? null,
        label: params.label ?? null,
        style_json: params.styleJson ?? null,
        created_at: now,
      });
      return rowToEdge(
        stmts.fetchEdgesByBoard
          .all(params.boardId)
          .find((r: any) => r.id === id) as EdgeRow,
      );
    },

    deleteEdge(id: string): void {
      stmts.deleteEdge.run(id);
    },
  };
}

export type PaperBoardRepository = ReturnType<
  typeof createPaperBoardRepository
>;
