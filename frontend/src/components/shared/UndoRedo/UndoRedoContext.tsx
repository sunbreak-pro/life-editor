import { createContext, useRef, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { UndoDomain, UndoCommand } from "./types";
import { UndoRedoManager } from "./UndoRedoManager";

export interface UndoRedoContextValue {
  push: (domain: UndoDomain, command: UndoCommand) => void;
  undo: (domain: UndoDomain) => Promise<void>;
  redo: (domain: UndoDomain) => Promise<void>;
  canUndo: (domain: UndoDomain) => boolean;
  canRedo: (domain: UndoDomain) => boolean;
  clear: (domain: UndoDomain) => void;
  setActiveDomain: (domain: UndoDomain | null) => void;
  getActiveDomain: () => UndoDomain | null;
}

export const UndoRedoContext = createContext<UndoRedoContextValue | null>(null);

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<UndoRedoManager | null>(null);
  const activeDomainRef = useRef<UndoDomain | null>(null);
  const [, setVersion] = useState(0);

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
  }, []);

  const getActiveDomain = useCallback(() => activeDomainRef.current, []);

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
    }),
    [
      push,
      undo,
      redo,
      canUndo,
      canRedo,
      clear,
      setActiveDomain,
      getActiveDomain,
    ],
  );

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  );
}
