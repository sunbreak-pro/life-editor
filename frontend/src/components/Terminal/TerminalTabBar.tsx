import { Plus, X } from "lucide-react";
import type { TerminalTab } from "../../types/terminalLayout";

interface TerminalTabBarProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  canAddTab: boolean;
}

export function TerminalTabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  canAddTab,
}: TerminalTabBarProps) {
  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center bg-[#11111b] border-b border-[#313244] px-1 h-7 shrink-0 gap-px">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 px-2 h-6 rounded text-xs cursor-pointer transition-colors ${
              isActive
                ? "bg-[#313244] text-[#cdd6f4]"
                : "text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#1e1e2e]"
            }`}
            onClick={() => onSwitchTab(tab.id)}
          >
            <span className="truncate max-w-[80px]">{tab.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
      {canAddTab && (
        <button
          onClick={onAddTab}
          className="p-0.5 ml-1 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          title="New tab"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
