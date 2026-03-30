import { query, mutation } from "./handlerUtil";
import type { PaperBoardRepository } from "../database/paperBoardRepository";

export function registerPaperBoardHandlers(repo: PaperBoardRepository): void {
  // --- Boards ---
  query("db:paperBoards:fetchAll", "PaperBoards", "fetchAll", () => {
    return repo.fetchAllBoards();
  });

  query(
    "db:paperBoards:fetchById",
    "PaperBoards",
    "fetchById",
    (_event, id: string) => {
      return repo.fetchBoardById(id);
    },
  );

  query(
    "db:paperBoards:fetchByNoteId",
    "PaperBoards",
    "fetchByNoteId",
    (_event, noteId: string) => {
      return repo.fetchBoardByNoteId(noteId);
    },
  );

  mutation(
    "db:paperBoards:create",
    "PaperBoards",
    "create",
    "paperBoard",
    "create",
    (_event, name: string, linkedNoteId?: string | null) => {
      return repo.createBoard(name, linkedNoteId);
    },
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:paperBoards:update",
    "PaperBoards",
    "update",
    "paperBoard",
    "update",
    (_event, id: string, updates: Record<string, unknown>) => {
      return repo.updateBoard(id, updates);
    },
  );

  mutation(
    "db:paperBoards:delete",
    "PaperBoards",
    "delete",
    "paperBoard",
    "delete",
    (_event, id: string) => {
      repo.deleteBoard(id);
    },
  );

  query(
    "db:paperNodes:fetchNodeCounts",
    "PaperNodes",
    "fetchNodeCounts",
    () => {
      return repo.fetchNodeCountsByBoard();
    },
  );

  // --- Nodes ---
  query(
    "db:paperNodes:fetchByBoard",
    "PaperNodes",
    "fetchByBoard",
    (_event, boardId: string) => {
      return repo.fetchNodesByBoard(boardId);
    },
  );

  mutation(
    "db:paperNodes:create",
    "PaperNodes",
    "create",
    "paperNode",
    "create",
    (_event, params: Record<string, unknown>) => {
      return repo.createNode(params as Parameters<typeof repo.createNode>[0]);
    },
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:paperNodes:update",
    "PaperNodes",
    "update",
    "paperNode",
    "update",
    (_event, id: string, updates: Record<string, unknown>) => {
      return repo.updateNode(
        id,
        updates as Parameters<typeof repo.updateNode>[1],
      );
    },
  );

  mutation(
    "db:paperNodes:bulkUpdatePositions",
    "PaperNodes",
    "bulkUpdatePositions",
    "paperNode",
    "bulk",
    (
      _event,
      updates: Array<{
        id: string;
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      }>,
    ) => {
      repo.bulkUpdatePositions(updates);
    },
    () => undefined,
  );

  mutation(
    "db:paperNodes:bulkUpdateZIndices",
    "PaperNodes",
    "bulkUpdateZIndices",
    "paperNode",
    "bulk",
    (
      _event,
      updates: Array<{
        id: string;
        zIndex: number;
        parentNodeId: string | null;
      }>,
    ) => {
      repo.bulkUpdateZIndices(updates);
    },
    () => undefined,
  );

  mutation(
    "db:paperNodes:delete",
    "PaperNodes",
    "delete",
    "paperNode",
    "delete",
    (_event, id: string) => {
      repo.deleteNode(id);
    },
  );

  // --- Edges ---
  query(
    "db:paperEdges:fetchByBoard",
    "PaperEdges",
    "fetchByBoard",
    (_event, boardId: string) => {
      return repo.fetchEdgesByBoard(boardId);
    },
  );

  mutation(
    "db:paperEdges:create",
    "PaperEdges",
    "create",
    "paperEdge",
    "create",
    (_event, params: Record<string, unknown>) => {
      return repo.createEdge(params as Parameters<typeof repo.createEdge>[0]);
    },
    (_args, result) => (result as { id?: string })?.id,
  );

  mutation(
    "db:paperEdges:delete",
    "PaperEdges",
    "delete",
    "paperEdge",
    "delete",
    (_event, id: string) => {
      repo.deleteEdge(id);
    },
  );
}
