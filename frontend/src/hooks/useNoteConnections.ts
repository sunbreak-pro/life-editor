import { useState, useEffect, useCallback } from "react";
import type { NoteConnection } from "../types/wikiTag";
import { getDataService } from "../services";
import { useUndoRedo } from "../components/shared/UndoRedo";

export function useNoteConnections() {
  const { push } = useUndoRedo();
  const [connections, setConnections] = useState<NoteConnection[]>([]);

  const reload = useCallback(async () => {
    const ds = getDataService();
    const fetched = await ds.fetchNoteConnections();
    setConnections(fetched);
  }, []);

  useEffect(() => {
    const ds = getDataService();
    ds.fetchNoteConnections().then((fetched) => setConnections(fetched));
  }, []);

  const createConnection = useCallback(
    async (sourceNoteId: string, targetNoteId: string) => {
      const ds = getDataService();
      const conn = await ds.createNoteConnection(sourceNoteId, targetNoteId);
      setConnections((prev) => [...prev, conn]);

      push("wikiTag", {
        label: "createNoteConnection",
        undo: async () => {
          await ds.deleteNoteConnection(conn.id);
          setConnections((prev) => prev.filter((c) => c.id !== conn.id));
        },
        redo: async () => {
          const restored = await ds.createNoteConnection(
            sourceNoteId,
            targetNoteId,
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
      await ds.deleteNoteConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));

      if (conn) {
        push("wikiTag", {
          label: "deleteNoteConnection",
          undo: async () => {
            const restored = await ds.createNoteConnection(
              conn.sourceNoteId,
              conn.targetNoteId,
            );
            setConnections((prev) => [...prev, restored]);
          },
          redo: async () => {
            await ds.deleteNoteConnectionByPair(
              conn.sourceNoteId,
              conn.targetNoteId,
            );
            setConnections((prev) =>
              prev.filter(
                (c) =>
                  !(
                    (c.sourceNoteId === conn.sourceNoteId &&
                      c.targetNoteId === conn.targetNoteId) ||
                    (c.sourceNoteId === conn.targetNoteId &&
                      c.targetNoteId === conn.sourceNoteId)
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
    async (sourceNoteId: string, targetNoteId: string) => {
      const ds = getDataService();
      const conn = connections.find(
        (c) =>
          (c.sourceNoteId === sourceNoteId &&
            c.targetNoteId === targetNoteId) ||
          (c.sourceNoteId === targetNoteId && c.targetNoteId === sourceNoteId),
      );
      await ds.deleteNoteConnectionByPair(sourceNoteId, targetNoteId);
      setConnections((prev) =>
        prev.filter(
          (c) =>
            !(
              (c.sourceNoteId === sourceNoteId &&
                c.targetNoteId === targetNoteId) ||
              (c.sourceNoteId === targetNoteId &&
                c.targetNoteId === sourceNoteId)
            ),
        ),
      );

      if (conn) {
        push("wikiTag", {
          label: "deleteNoteConnection",
          undo: async () => {
            const restored = await ds.createNoteConnection(
              conn.sourceNoteId,
              conn.targetNoteId,
            );
            setConnections((prev) => [...prev, restored]);
          },
          redo: async () => {
            await ds.deleteNoteConnectionByPair(sourceNoteId, targetNoteId);
            setConnections((prev) =>
              prev.filter(
                (c) =>
                  !(
                    (c.sourceNoteId === sourceNoteId &&
                      c.targetNoteId === targetNoteId) ||
                    (c.sourceNoteId === targetNoteId &&
                      c.targetNoteId === sourceNoteId)
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
    noteConnections: connections,
    reload,
    createNoteConnection: createConnection,
    deleteNoteConnection: deleteConnection,
    deleteNoteConnectionByPair: deleteConnectionByPair,
  };
}
