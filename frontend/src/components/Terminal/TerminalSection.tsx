import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import {
  Plus,
  Columns2,
  Rows2,
  Power,
  Terminal as TerminalIcon,
} from "lucide-react";
import { SplitLayout } from "./SplitLayout";
import { TerminalTabBar } from "./TerminalTabBar";
import { useTerminalLayout } from "../../hooks/useTerminalLayout";
import { countLeaves, findLeaf } from "../../utils/terminalLayout";
import type { TerminalCommandHandle } from "../Layout/Layout";

const MAX_PANES = 4;
const MAX_TABS = 4;

interface TerminalSectionProps {
  isActive: boolean;
  commandRef?: MutableRefObject<TerminalCommandHandle | null>;
}

export function TerminalSection({
  isActive,
  commandRef,
}: TerminalSectionProps) {
  const layout = useTerminalLayout();
  const panelRef = useRef<HTMLDivElement>(null);

  // Expose active session ID for external command sending
  useEffect(() => {
    if (commandRef) {
      commandRef.current = {
        getActiveSessionId: () => {
          const tab = layout.activeTab;
          if (!tab) return null;
          const leaf = findLeaf(tab.root, tab.activePaneId);
          return leaf?.sessionId ?? null;
        },
      };
    }
    return () => {
      if (commandRef) commandRef.current = null;
    };
  }, [commandRef, layout.activeTab]);

  // Open the panel on first activation
  useEffect(() => {
    if (isActive && !layout.state) {
      layout.openPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Trigger xterm resize when section becomes active or active tab changes
  useEffect(() => {
    if (isActive && layout.state) {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    }
  }, [isActive, layout.state, layout.state?.activeTabId]);

  // Panel-level keyboard shortcuts (capture phase) — only when section is active
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey) return;

      const panel = panelRef.current;
      if (!panel || !panel.contains(document.activeElement)) return;

      if (e.code === "KeyW" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.closeActivePane();
        return;
      }

      if (e.code === "KeyT" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.addTab();
        return;
      }

      if (e.code === "KeyD" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.splitVertical();
        return;
      }

      if (e.code === "KeyD" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        layout.splitHorizontal();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isActive, layout]);

  const activeTab = layout.activeTab;
  const paneCount = activeTab ? countLeaves(activeTab.root) : 0;
  const canAddPane = paneCount < MAX_PANES;
  const canAddTab = (layout.state?.tabs.length ?? 0) < MAX_TABS;

  return (
    <div ref={panelRef} className="flex flex-col h-full bg-[#11111b]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 h-9 shrink-0 bg-[#181825] border-b border-[#313244]">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-[#cdd6f4]" />
          <span className="text-xs font-medium text-[#cdd6f4]">Terminal</span>
          {paneCount > 1 && (
            <span className="text-[10px] text-[#6c7086]">
              {paneCount}/{MAX_PANES}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => layout.addTab()}
            disabled={!canAddTab}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="New tab (⌘T)"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => layout.splitVertical()}
            disabled={!canAddPane}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Split vertical (⌘D)"
          >
            <Columns2 size={14} />
          </button>
          <button
            onClick={() => layout.splitHorizontal()}
            disabled={!canAddPane}
            className="p-0.5 text-[#6c7086] hover:text-[#cdd6f4] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Split horizontal (⌘⇧D)"
          >
            <Rows2 size={14} />
          </button>
          <div className="w-px h-3 bg-[#313244] mx-0.5" />
          <button
            onClick={() => layout.closePanel()}
            className="p-0.5 text-[#6c7086] hover:text-red-400 transition-colors"
            title="Kill terminal"
          >
            <Power size={14} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {layout.state && (
        <TerminalTabBar
          tabs={layout.state.tabs}
          activeTabId={layout.state.activeTabId}
          onSwitchTab={layout.switchTab}
          onCloseTab={layout.closeTab}
          onAddTab={() => layout.addTab()}
          canAddTab={canAddTab}
        />
      )}

      {/* Terminal content — render all tabs, hide non-active with display:none */}
      {layout.state &&
        layout.state.tabs.map((tab) => (
          <div
            key={tab.id}
            className="flex-1 min-h-0"
            style={{
              display: tab.id === layout.state!.activeTabId ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <SplitLayout
              node={tab.root}
              activePaneId={tab.activePaneId}
              onPaneFocus={layout.setActivePaneId}
              onSizesChange={layout.updateSizes}
            />
          </div>
        ))}
    </div>
  );
}
