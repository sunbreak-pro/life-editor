import { useState, useCallback } from "react";
import type { TerminalPanelState, TerminalTab } from "../types/terminalLayout";
import {
  createLeaf,
  createInitialLayout,
  collectLeaves,
  countLeaves,
  splitPane,
  removePane,
  updateSplitSizes,
} from "../utils/terminalLayout";
import { terminalCreate, terminalDestroy } from "../services/terminalBridge";

const MAX_PANES = 4;
const MAX_TABS = 4;

let tabCounter = 0;

function createTab(sessionId: string): TerminalTab {
  const leaf = createInitialLayout(sessionId);
  tabCounter++;
  return {
    id: `tab-${Date.now()}-${tabCounter}`,
    label: `Tab ${tabCounter}`,
    root: leaf,
    activePaneId: leaf.type === "leaf" ? leaf.id : "",
  };
}

function getActiveTab(state: TerminalPanelState): TerminalTab | undefined {
  return state.tabs.find((t) => t.id === state.activeTabId);
}

function updateActiveTab(
  state: TerminalPanelState,
  updater: (tab: TerminalTab) => TerminalTab,
): TerminalPanelState {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === state.activeTabId ? updater(t) : t)),
  };
}

export interface UseTerminalLayoutReturn {
  state: TerminalPanelState | null;
  activePaneId: string | null;
  activeTab: TerminalTab | undefined;
  openPanel: () => Promise<void>;
  closePanel: () => void;
  addTab: () => Promise<void>;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  addPane: () => Promise<void>;
  splitVertical: () => Promise<void>;
  splitHorizontal: () => Promise<void>;
  closeActivePane: () => void;
  setActivePaneId: (id: string) => void;
  updateSizes: (splitId: string, sizes: number[]) => void;
}

export function useTerminalLayout(): UseTerminalLayoutReturn {
  const [state, setState] = useState<TerminalPanelState | null>(null);

  const activeTabData = state ? getActiveTab(state) : undefined;
  const activePaneId = activeTabData?.activePaneId ?? null;

  const openPanel = useCallback(async () => {
    const sessionId = await terminalCreate().catch(() => null);
    if (!sessionId) return;
    tabCounter = 0;
    const tab = createTab(sessionId);
    setState({
      tabs: [tab],
      activeTabId: tab.id,
    });
  }, []);

  const closePanel = useCallback(() => {
    if (!state) return;
    for (const tab of state.tabs) {
      const leaves = collectLeaves(tab.root);
      for (const leaf of leaves) {
        terminalDestroy(leaf.sessionId).catch(() => {});
      }
    }
    setState(null);
  }, [state]);

  const addTab = useCallback(async () => {
    if (!state) return;
    if (state.tabs.length >= MAX_TABS) return;

    const sessionId = await terminalCreate().catch(() => null);
    if (!sessionId) return;

    const tab = createTab(sessionId);
    setState({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    });
  }, [state]);

  const closeTab = useCallback(
    (tabId: string) => {
      if (!state) return;
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Destroy all PTY sessions in this tab
      const leaves = collectLeaves(tab.root);
      for (const leaf of leaves) {
        terminalDestroy(leaf.sessionId).catch(() => {});
      }

      const remaining = state.tabs.filter((t) => t.id !== tabId);
      if (remaining.length === 0) {
        setState(null);
        return;
      }

      // If closing the active tab, switch to adjacent
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === tabId) {
        const closedIndex = state.tabs.findIndex((t) => t.id === tabId);
        const nextIndex = Math.min(closedIndex, remaining.length - 1);
        newActiveTabId = remaining[nextIndex].id;
      }

      setState({
        tabs: remaining,
        activeTabId: newActiveTabId,
      });
    },
    [state],
  );

  const switchTab = useCallback(
    (tabId: string) => {
      if (!state) return;
      setState({ ...state, activeTabId: tabId });
    },
    [state],
  );

  const doSplit = useCallback(
    async (direction: "horizontal" | "vertical") => {
      if (!state) return;
      const tab = getActiveTab(state);
      if (!tab) return;
      if (countLeaves(tab.root) >= MAX_PANES) return;

      const sessionId = await terminalCreate().catch(() => null);
      if (!sessionId) return;

      const newLeaf = createLeaf(sessionId);
      const newRoot = splitPane(tab.root, tab.activePaneId, newLeaf, direction);
      setState(
        updateActiveTab(state, (t) => ({
          ...t,
          root: newRoot,
          activePaneId: newLeaf.id,
        })),
      );
    },
    [state],
  );

  const addPane = useCallback(() => doSplit("horizontal"), [doSplit]);

  const splitVertical = useCallback(() => doSplit("horizontal"), [doSplit]);

  const splitHorizontal = useCallback(() => doSplit("vertical"), [doSplit]);

  const closeActivePane = useCallback(() => {
    if (!state) return;
    const tab = getActiveTab(state);
    if (!tab) return;

    const leaf = collectLeaves(tab.root).find((l) => l.id === tab.activePaneId);
    if (leaf) {
      terminalDestroy(leaf.sessionId).catch(() => {});
    }

    const newRoot = removePane(tab.root, tab.activePaneId);
    if (!newRoot) {
      // Last pane in tab — close the tab
      const remaining = state.tabs.filter((t) => t.id !== tab.id);
      if (remaining.length === 0) {
        setState(null);
        return;
      }
      const closedIndex = state.tabs.findIndex((t) => t.id === tab.id);
      const nextIndex = Math.min(closedIndex, remaining.length - 1);
      setState({
        tabs: remaining,
        activeTabId: remaining[nextIndex].id,
      });
      return;
    }

    const remainingLeaves = collectLeaves(newRoot);
    setState(
      updateActiveTab(state, (t) => ({
        ...t,
        root: newRoot,
        activePaneId: remainingLeaves[0]?.id ?? "",
      })),
    );
  }, [state]);

  const setActivePaneId = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      return updateActiveTab(prev, (t) => ({ ...t, activePaneId: id }));
    });
  }, []);

  const updateSizesCallback = useCallback(
    (splitId: string, sizes: number[]) => {
      setState((prev) => {
        if (!prev) return prev;
        return updateActiveTab(prev, (t) => ({
          ...t,
          root: updateSplitSizes(t.root, splitId, sizes),
        }));
      });
    },
    [],
  );

  return {
    state,
    activePaneId,
    activeTab: activeTabData,
    openPanel,
    closePanel,
    addTab,
    closeTab,
    switchTab,
    addPane,
    splitVertical,
    splitHorizontal,
    closeActivePane,
    setActivePaneId,
    updateSizes: updateSizesCallback,
  };
}
