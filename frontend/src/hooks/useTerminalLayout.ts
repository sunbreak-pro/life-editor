import { useState, useCallback } from "react";
import type { TerminalPanelState } from "../types/terminalLayout";
import {
  createLeaf,
  createInitialLayout,
  collectLeaves,
  countLeaves,
  splitPane,
  removePane,
  updateSplitSizes,
} from "../utils/terminalLayout";

const MAX_PANES = 4;

export interface UseTerminalLayoutReturn {
  state: TerminalPanelState | null;
  activePaneId: string | null;
  openPanel: () => Promise<void>;
  closePanel: () => void;
  addPane: () => Promise<void>;
  splitVertical: () => Promise<void>;
  splitHorizontal: () => Promise<void>;
  closeActivePane: () => void;
  setActivePaneId: (id: string) => void;
  updateSizes: (splitId: string, sizes: number[]) => void;
}

export function useTerminalLayout(): UseTerminalLayoutReturn {
  const [state, setState] = useState<TerminalPanelState | null>(null);

  const activePaneId = state?.activePaneId ?? null;

  const openPanel = useCallback(async () => {
    const sessionId =
      await window.electronAPI?.invoke<string>("terminal:create");
    if (!sessionId) return;
    const leaf = createInitialLayout(sessionId);
    setState({
      root: leaf,
      activePaneId: leaf.type === "leaf" ? leaf.id : "",
    });
  }, []);

  const closePanel = useCallback(() => {
    if (!state) return;
    const leaves = collectLeaves(state.root);
    for (const leaf of leaves) {
      window.electronAPI
        ?.invoke("terminal:destroy", leaf.sessionId)
        .catch(() => {});
    }
    setState(null);
  }, [state]);

  const doSplit = useCallback(
    async (direction: "horizontal" | "vertical") => {
      if (!state) return;
      if (countLeaves(state.root) >= MAX_PANES) return;

      const sessionId =
        await window.electronAPI?.invoke<string>("terminal:create");
      if (!sessionId) return;

      const newLeaf = createLeaf(sessionId);
      const newRoot = splitPane(
        state.root,
        state.activePaneId,
        newLeaf,
        direction,
      );
      setState({ root: newRoot, activePaneId: newLeaf.id });
    },
    [state],
  );

  const addPane = useCallback(() => doSplit("horizontal"), [doSplit]);

  const splitVertical = useCallback(() => doSplit("horizontal"), [doSplit]);

  const splitHorizontal = useCallback(() => doSplit("vertical"), [doSplit]);

  const closeActivePane = useCallback(() => {
    if (!state) return;

    const leaf = collectLeaves(state.root).find(
      (l) => l.id === state.activePaneId,
    );
    if (leaf) {
      window.electronAPI
        ?.invoke("terminal:destroy", leaf.sessionId)
        .catch(() => {});
    }

    const newRoot = removePane(state.root, state.activePaneId);
    if (!newRoot) {
      setState(null);
      return;
    }

    const remaining = collectLeaves(newRoot);
    setState({
      root: newRoot,
      activePaneId: remaining[0]?.id ?? "",
    });
  }, [state]);

  const setActivePaneId = useCallback((id: string) => {
    setState((prev) => (prev ? { ...prev, activePaneId: id } : prev));
  }, []);

  const updateSizesCallback = useCallback(
    (splitId: string, sizes: number[]) => {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          root: updateSplitSizes(prev.root, splitId, sizes),
        };
      });
    },
    [],
  );

  return {
    state,
    activePaneId,
    openPanel,
    closePanel,
    addPane,
    splitVertical,
    splitHorizontal,
    closeActivePane,
    setActivePaneId,
    updateSizes: updateSizesCallback,
  };
}
