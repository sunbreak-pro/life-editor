import { useRef, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { UndoDomain, UndoCommand } from "../utils/undoRedo/types";
import { UndoRedoManager } from "../utils/undoRedo/UndoRedoManager";
import { UndoRedoContext } from "./UndoRedoContextValue";
import type { UndoRedoContextValue } from "./UndoRedoContextValue";

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<UndoRedoManager | null>(null);
  const activeDomainRef = useRef<UndoDomain | null>(null);
  const activeDomainsRef = useRef<UndoDomain[] | null>(null);
  const activeEditorRef = useRef<Editor | null>(null);
  const [version, setVersion] = useState(0);

  if (!managerRef.current) {
    const mgr = new UndoRedoManager();
    mgr.setListener(() => setVersion((v) => v + 1));
    managerRef.current = mgr;
  }
  const manager = managerRef.current;

  const push = useCallback(
    (domain: UndoDomain, command: UndoCommand) => {
      manager.push(domain, command);
    },
    [manager],
  );

  const undo = useCallback(
    async (domain: UndoDomain) => {
      await manager.undo(domain);
    },
    [manager],
  );

  const redo = useCallback(
    async (domain: UndoDomain) => {
      await manager.redo(domain);
    },
    [manager],
  );

  const canUndo = useCallback(
    (domain: UndoDomain) => manager.canUndo(domain),
    [manager],
  );

  const canRedo = useCallback(
    (domain: UndoDomain) => manager.canRedo(domain),
    [manager],
  );

  const clear = useCallback(
    (domain: UndoDomain) => {
      manager.clear(domain);
    },
    [manager],
  );

  const setActiveDomain = useCallback((domain: UndoDomain | null) => {
    activeDomainRef.current = domain;
    activeDomainsRef.current = domain ? [domain] : null;
  }, []);

  const getActiveDomain = useCallback(() => activeDomainRef.current, []);

  const undoLatest = useCallback(
    async (domains: UndoDomain[]) => {
      await manager.undoLatest(domains);
    },
    [manager],
  );

  const redoLatest = useCallback(
    async (domains: UndoDomain[]) => {
      await manager.redoLatest(domains);
    },
    [manager],
  );

  const canUndoAny = useCallback(
    (domains: UndoDomain[]) => manager.canUndoAny(domains),
    [manager],
  );

  const canRedoAny = useCallback(
    (domains: UndoDomain[]) => manager.canRedoAny(domains),
    [manager],
  );

  const setActiveDomains = useCallback((domains: UndoDomain[] | null) => {
    activeDomainsRef.current = domains;
    activeDomainRef.current = domains?.[0] ?? null;
  }, []);

  const getActiveDomains = useCallback(() => activeDomainsRef.current, []);

  const setActiveEditor = useCallback((editor: Editor | null) => {
    activeEditorRef.current = editor;
    setVersion((v) => v + 1);
  }, []);

  const getActiveEditor = useCallback(() => activeEditorRef.current, []);

  const value = useMemo<UndoRedoContextValue>(
    () => ({
      push,
      undo,
      redo,
      canUndo,
      canRedo,
      clear,
      setActiveDomain,
      getActiveDomain,
      undoLatest,
      redoLatest,
      canUndoAny,
      canRedoAny,
      setActiveDomains,
      getActiveDomains,
      setActiveEditor,
      getActiveEditor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      push,
      undo,
      redo,
      canUndo,
      canRedo,
      clear,
      setActiveDomain,
      getActiveDomain,
      undoLatest,
      redoLatest,
      canUndoAny,
      canRedoAny,
      setActiveDomains,
      getActiveDomains,
      setActiveEditor,
      getActiveEditor,
      version,
    ],
  );

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  );
}
