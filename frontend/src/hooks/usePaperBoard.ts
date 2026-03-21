import { useState, useEffect, useCallback, useRef } from "react";
import type {
  PaperBoard,
  PaperNode,
  PaperEdge,
  PaperNodeType,
} from "../types/paperBoard";
import { getDataService } from "../services";
import { STORAGE_KEYS } from "../constants/storageKeys";

export function usePaperBoard() {
  const [boards, setBoards] = useState<PaperBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.PAPER_ACTIVE_BOARD_ID) || null;
  });
  const [nodes, setNodes] = useState<PaperNode[]>([]);
  const [edges, setEdges] = useState<PaperEdge[]>([]);
  const [boardNodeCounts, setBoardNodeCounts] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedBoardRef = useRef<string | null>(null);

  // Persist active board id
  useEffect(() => {
    if (activeBoardId) {
      localStorage.setItem(STORAGE_KEYS.PAPER_ACTIVE_BOARD_ID, activeBoardId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.PAPER_ACTIVE_BOARD_ID);
    }
  }, [activeBoardId]);

  // Load boards and node counts
  useEffect(() => {
    const ds = getDataService();
    Promise.all([ds.fetchPaperBoards(), ds.fetchPaperNodeCountsByBoard()])
      .then(([fetched, counts]) => {
        setBoards(fetched);
        setBoardNodeCounts(counts);
        // Auto-select first board if no active board or invalid
        if (fetched.length > 0) {
          const exists = fetched.some((b) => b.id === activeBoardId);
          if (!exists) {
            setActiveBoardId(fetched[0].id);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load boards");
        setLoading(false);
      });
  }, []);

  // Load nodes/edges when active board changes
  useEffect(() => {
    if (!activeBoardId || loadedBoardRef.current === activeBoardId) return;
    loadedBoardRef.current = activeBoardId;
    const ds = getDataService();
    Promise.all([
      ds.fetchPaperNodesByBoard(activeBoardId),
      ds.fetchPaperEdgesByBoard(activeBoardId),
    ])
      .then(([n, e]) => {
        setNodes(n);
        setEdges(e);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load board data",
        );
      });
  }, [activeBoardId]);

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;

  // --- Board CRUD ---
  const createBoard = useCallback(
    async (name: string, linkedNoteId?: string | null) => {
      const ds = getDataService();
      const board = await ds.createPaperBoard(name, linkedNoteId);
      setBoards((prev) => [...prev, board]);
      setActiveBoardId(board.id);
      return board;
    },
    [],
  );

  const updateBoard = useCallback(
    async (
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
    ) => {
      const ds = getDataService();
      const updated = await ds.updatePaperBoard(id, updates);
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    },
    [],
  );

  const boardsRef = useRef(boards);
  boardsRef.current = boards;

  const deleteBoard = useCallback(async (id: string) => {
    const ds = getDataService();
    await ds.deletePaperBoard(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
    if (boardsRef.current.find((b) => b.id === id)) {
      const remaining = boardsRef.current.filter((b) => b.id !== id);
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  }, []);

  const saveViewport = useCallback(
    async (x: number, y: number, zoom: number) => {
      if (!activeBoardId) return;
      const ds = getDataService();
      const updated = await ds.updatePaperBoard(activeBoardId, {
        viewportX: x,
        viewportY: y,
        viewportZoom: zoom,
      });
      setBoards((prev) =>
        prev.map((b) => (b.id === activeBoardId ? updated : b)),
      );
    },
    [activeBoardId],
  );

  // --- Node CRUD ---
  const createNode = useCallback(
    async (params: {
      boardId: string;
      nodeType: PaperNodeType;
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
    }) => {
      const ds = getDataService();
      const node = await ds.createPaperNode(params);
      setNodes((prev) => [...prev, node]);
      setBoardNodeCounts((prev) => ({
        ...prev,
        [params.boardId]: (prev[params.boardId] ?? 0) + 1,
      }));
      return node;
    },
    [],
  );

  const updateNode = useCallback(
    async (
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
    ) => {
      const ds = getDataService();
      const updated = await ds.updatePaperNode(id, updates);
      setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      return updated;
    },
    [],
  );

  const bulkUpdatePositions = useCallback(
    async (
      updates: Array<{
        id: string;
        positionX: number;
        positionY: number;
        parentNodeId: string | null;
      }>,
    ) => {
      const ds = getDataService();
      await ds.bulkUpdatePaperNodePositions(updates);
      // Optimistic update
      setNodes((prev) => {
        const updateMap = new Map(updates.map((u) => [u.id, u]));
        return prev.map((n) => {
          const u = updateMap.get(n.id);
          if (!u) return n;
          return {
            ...n,
            positionX: u.positionX,
            positionY: u.positionY,
            parentNodeId: u.parentNodeId,
          };
        });
      });
    },
    [],
  );

  const deleteNode = useCallback(
    async (id: string) => {
      const ds = getDataService();
      // Find boardId before deleting for count update
      const deletedNode = nodes.find((n) => n.id === id);
      await ds.deletePaperNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
      // Also remove edges connected to this node
      setEdges((prev) =>
        prev.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id),
      );
      if (deletedNode) {
        setBoardNodeCounts((prev) => ({
          ...prev,
          [deletedNode.boardId]: Math.max(
            0,
            (prev[deletedNode.boardId] ?? 0) - 1,
          ),
        }));
      }
    },
    [nodes],
  );

  // --- Edge CRUD ---
  const createEdge = useCallback(
    async (params: {
      boardId: string;
      sourceNodeId: string;
      targetNodeId: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
      label?: string | null;
      styleJson?: string | null;
    }) => {
      const ds = getDataService();
      const edge = await ds.createPaperEdge(params);
      setEdges((prev) => [...prev, edge]);
      return edge;
    },
    [],
  );

  const deleteEdge = useCallback(async (id: string) => {
    const ds = getDataService();
    await ds.deletePaperEdge(id);
    setEdges((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // --- Note link board ---
  const openBoardForNote = useCallback(
    async (noteId: string, noteName: string) => {
      const ds = getDataService();
      let board = await ds.fetchPaperBoardByNoteId(noteId);
      if (!board) {
        board = await ds.createPaperBoard(noteName, noteId);
        setBoards((prev) => [...prev, board!]);
      }
      setActiveBoardId(board.id);
      loadedBoardRef.current = null; // Force reload
      return board;
    },
    [],
  );

  // Reload board data (after switching)
  const reloadBoardData = useCallback(async () => {
    if (!activeBoardId) return;
    loadedBoardRef.current = null;
    const ds = getDataService();
    const [n, e] = await Promise.all([
      ds.fetchPaperNodesByBoard(activeBoardId),
      ds.fetchPaperEdgesByBoard(activeBoardId),
    ]);
    setNodes(n);
    setEdges(e);
    loadedBoardRef.current = activeBoardId;
  }, [activeBoardId]);

  return {
    boards,
    activeBoard,
    activeBoardId,
    boardNodeCounts,
    setActiveBoardId: useCallback((id: string | null) => {
      setActiveBoardId(id);
      loadedBoardRef.current = null;
    }, []),
    nodes,
    edges,
    loading,
    error,
    createBoard,
    updateBoard,
    deleteBoard,
    saveViewport,
    createNode,
    updateNode,
    bulkUpdatePositions,
    deleteNode,
    createEdge,
    deleteEdge,
    openBoardForNote,
    reloadBoardData,
  };
}
