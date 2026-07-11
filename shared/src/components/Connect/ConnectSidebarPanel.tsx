import type { ReactNode } from "react";
import { SlidersHorizontal, ArrowLeft } from "lucide-react";
import type { ConnectGraphLabels } from "./labels";

export type ConnectSidebarTab = "settings" | "backlinks";

interface ConnectSidebarPanelProps {
  labels: ConnectGraphLabels;
  activeTab: ConnectSidebarTab;
  onTabChange: (tab: ConnectSidebarTab) => void;
  /** backlink count for the tab badge */
  backlinkCount: number;
  /**
   * Graph actions (count / reheat / fit / clear-filters) shown ABOVE the
   * settings content — the v2-adoption home for what the retired ConnectHeader
   * used to hold. Only rendered on the settings tab.
   */
  settingsHeader?: ReactNode;
  settingsContent: ReactNode;
  backlinksContent: ReactNode;
}

/*
 * rightSidebar body for Connect (App Shell Turn 2). Rendered via
 * <RightSidebarPortal> into the shared "詳細" panel, BELOW the shell's fixed
 * 48px header. Owns the "Graph settings / Backlinks" tab row (tab STATE lives
 * in ConnectGraphView) and swaps the well content. Pure presentation — copy
 * injected already-translated (§6.4), lumen-* tokens (§5).
 */
export function ConnectSidebarPanel({
  labels,
  activeTab,
  onTabChange,
  backlinkCount,
  settingsHeader,
  settingsContent,
  backlinksContent,
}: ConnectSidebarPanelProps) {
  const tabClass = (active: boolean) =>
    "flex items-center gap-1.5 -mb-px border-b-2 pb-2 text-[13px] focus-visible:outline-none " +
    (active
      ? "border-lumen-accent font-medium text-lumen-text"
      : "border-transparent text-lumen-text-secondary hover:text-lumen-text");

  return (
    <div className="flex flex-col">
      <div
        role="tablist"
        aria-label={labels.title}
        className="flex items-stretch gap-4 border-b border-lumen-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "settings"}
          onClick={() => onTabChange("settings")}
          className={tabClass(activeTab === "settings")}
        >
          <SlidersHorizontal size={13} />
          {labels.settingsTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "backlinks"}
          onClick={() => onTabChange("backlinks")}
          className={tabClass(activeTab === "backlinks")}
        >
          <ArrowLeft size={13} />
          {labels.backlinksTab}
          <span className="inline-flex h-4 items-center rounded-lumen-sm bg-lumen-accent-subtle px-1.5 font-mono text-[10px] font-semibold text-lumen-accent tabular-nums">
            {backlinkCount}
          </span>
        </button>
      </div>

      <div className="pt-4">
        {activeTab === "settings" ? (
          <div className="space-y-4">
            {settingsHeader}
            {settingsContent}
          </div>
        ) : (
          backlinksContent
        )}
      </div>
    </div>
  );
}
