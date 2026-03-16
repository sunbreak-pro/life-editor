import { ipcMain } from "electron";
import { loggedHandler } from "./handlerUtil";
import type { PaperBoardRepository } from "../database/paperBoardRepository";
import type { PaperNode } from "../types";

export function registerPaperBoardHandlers(repo: PaperBoardRepository): void {
  // --- Boards ---
  ipcMain.handle(
    "db:paperBoards:fetchAll",
    loggedHandler("PaperBoards", "fetchAll", () => {
      return repo.fetchAllBoards();
    }),
  );

  ipcMain.handle(
    "db:paperBoards:fetchById",
    loggedHandler("PaperBoards", "fetchById", (_event, id: string) => {
      return repo.fetchBoardById(id);
    }),
  );

  ipcMain.handle(
    "db:paperBoards:fetchByNoteId",
    loggedHandler("PaperBoards", "fetchByNoteId", (_event, noteId: string) => {
      return repo.fetchBoardByNoteId(noteId);
    }),
  );

  ipcMain.handle(
    "db:paperBoards:create",
    loggedHandler(
      "PaperBoards",
      "create",
      (_event, name: string, linkedNoteId?: string | null) => {
        return repo.createBoard(name, linkedNoteId);
      },
    ),
  );

  ipcMain.handle(
    "db:paperBoards:update",
    loggedHandler(
      "PaperBoards",
      "update",
      (_event, id: string, updates: Record<string, unknown>) => {
        return repo.updateBoard(id, updates);
      },
    ),
  );

  ipcMain.handle(
    "db:paperBoards:delete",
    loggedHandler("PaperBoards", "delete", (_event, id: string) => {
      repo.deleteBoard(id);
    }),
  );

  // --- Nodes ---
  ipcMain.handle(
    "db:paperNodes:fetchByBoard",
    loggedHandler("PaperNodes", "fetchByBoard", (_event, boardId: string) => {
      return repo.fetchNodesByBoard(boardId);
    }),
  );

  ipcMain.handle(
    "db:paperNodes:create",
    loggedHandler(
      "PaperNodes",
      "create",
      (_event, params: Record<string, unknown>) => {
        return repo.createNode(params as Parameters<typeof repo.createNode>[0]);
      },
    ),
  );

  ipcMain.handle(
    "db:paperNodes:update",
    loggedHandler(
      "PaperNodes",
      "update",
      (_event, id: string, updates: Record<string, unknown>) => {
        return repo.updateNode(
          id,
          updates as Parameters<typeof repo.updateNode>[1],
        );
      },
    ),
  );

  ipcMain.handle(
    "db:paperNodes:bulkUpdatePositions",
    loggedHandler(
      "PaperNodes",
      "bulkUpdatePositions",
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
    ),
  );

  ipcMain.handle(
    "db:paperNodes:delete",
    loggedHandler("PaperNodes", "delete", (_event, id: string) => {
      repo.deleteNode(id);
    }),
  );

  // --- Edges ---
  ipcMain.handle(
    "db:paperEdges:fetchByBoard",
    loggedHandler("PaperEdges", "fetchByBoard", (_event, boardId: string) => {
      return repo.fetchEdgesByBoard(boardId);
    }),
  );

  ipcMain.handle(
    "db:paperEdges:create",
    loggedHandler(
      "PaperEdges",
      "create",
      (_event, params: Record<string, unknown>) => {
        return repo.createEdge(params as Parameters<typeof repo.createEdge>[0]);
      },
    ),
  );

  ipcMain.handle(
    "db:paperEdges:delete",
    loggedHandler("PaperEdges", "delete", (_event, id: string) => {
      repo.deleteEdge(id);
    }),
  );
}
