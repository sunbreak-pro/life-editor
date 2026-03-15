import { useState, useEffect, useCallback } from "react";
import type { WikiTagConnection } from "../types/wikiTag";
import { getDataService } from "../services";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useWikiTagConnections() {
  const { push } = useUndoRedo();
  const [connections, setConnections] = useState<WikiTagConnection[]>([]);

  const reload = useCallback(async () => {
    const ds = getDataService();
    const fetched = await ds.fetchWikiTagConnections();
    setConnections(fetched);
  }, []);

  useEffect(() => {
    const ds = getDataService();
    ds.fetchWikiTagConnections().then((fetched) => setConnections(fetched));
  }, []);

  const createConnection = useCallback(
    async (sourceTagId: string, targetTagId: string) => {
      const ds = getDataService();
      const conn = await ds.createWikiTagConnection(sourceTagId, targetTagId);
      setConnections((prev) => [...prev, conn]);

      push("wikiTag", {
        label: "createConnection",
        undo: async () => {
          await ds.deleteWikiTagConnection(conn.id);
          setConnections((prev) => prev.filter((c) => c.id !== conn.id));
        },
        redo: async () => {
          const restored = await ds.createWikiTagConnection(
            sourceTagId,
            targetTagId,
          );
          setConnections((prev) => [...prev, restored]);
        },
      });

      return conn;
    },
    [push],
  );

  const deleteConnection = useCallback(
    async (id: string) => {
      const ds = getDataService();
      const conn = connections.find((c) => c.id === id);
      await ds.deleteWikiTagConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));

      if (conn) {
        push("wikiTag", {
          label: "deleteConnection",
          undo: async () => {
            const restored = await ds.createWikiTagConnection(
              conn.sourceTagId,
              conn.targetTagId,
            );
            setConnections((prev) => [...prev, restored]);
          },
          redo: async () => {
            await ds.deleteWikiTagConnectionByPair(
              conn.sourceTagId,
              conn.targetTagId,
            );
            setConnections((prev) =>
              prev.filter(
                (c) =>
                  !(
                    (c.sourceTagId === conn.sourceTagId &&
                      c.targetTagId === conn.targetTagId) ||
                    (c.sourceTagId === conn.targetTagId &&
                      c.targetTagId === conn.sourceTagId)
                  ),
              ),
            );
          },
        });
      }
    },
    [connections, push],
  );

  const deleteConnectionByPair = useCallback(
    async (sourceTagId: string, targetTagId: string) => {
      const ds = getDataService();
      const conn = connections.find(
        (c) =>
          (c.sourceTagId === sourceTagId && c.targetTagId === targetTagId) ||
          (c.sourceTagId === targetTagId && c.targetTagId === sourceTagId),
      );
      await ds.deleteWikiTagConnectionByPair(sourceTagId, targetTagId);
      setConnections((prev) =>
        prev.filter(
          (c) =>
            !(
              (c.sourceTagId === sourceTagId &&
                c.targetTagId === targetTagId) ||
              (c.sourceTagId === targetTagId && c.targetTagId === sourceTagId)
            ),
        ),
      );

      if (conn) {
        push("wikiTag", {
          label: "deleteConnection",
          undo: async () => {
            const restored = await ds.createWikiTagConnection(
              conn.sourceTagId,
              conn.targetTagId,
            );
            setConnections((prev) => [...prev, restored]);
          },
          redo: async () => {
            await ds.deleteWikiTagConnectionByPair(sourceTagId, targetTagId);
            setConnections((prev) =>
              prev.filter(
                (c) =>
                  !(
                    (c.sourceTagId === sourceTagId &&
                      c.targetTagId === targetTagId) ||
                    (c.sourceTagId === targetTagId &&
                      c.targetTagId === sourceTagId)
                  ),
              ),
            );
          },
        });
      }
    },
    [connections, push],
  );

  return {
    connections,
    reload,
    createConnection,
    deleteConnection,
    deleteConnectionByPair,
  };
}
