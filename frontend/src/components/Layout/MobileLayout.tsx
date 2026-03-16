import { type ReactNode } from "react";
import type { SectionId } from "../../types/taskTree";
import { useTranslation } from "react-i18next";
import type { ConnectionState } from "../../hooks/useRealtimeSync";

type MobileTab = "memos" | "notes" | "tasks" | "schedule";

interface MobileLayoutProps {
  children: ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  connectionState?: ConnectionState;
}

const TAB_TO_SECTION: Record<MobileTab, SectionId> = {
  memos: "ideas",
  notes: "ideas",
  tasks: "tasks",
  schedule: "schedule",
};

const CONNECTION_COLORS: Record<ConnectionState, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  disconnected: "bg-red-500",
};

export function MobileLayout({
  children,
  activeTab,
  onTabChange,
  connectionState = "disconnected",
}: MobileLayoutProps) {
  const { t } = useTranslation();

  const tabs: Array<{ id: MobileTab; label: string; icon: string }> = [
    { id: "memos", label: t("mobile.tabs.memos", "Memos"), icon: "📝" },
    { id: "notes", label: t("mobile.tabs.notes", "Notes"), icon: "📒" },
    { id: "tasks", label: t("mobile.tabs.tasks", "Tasks"), icon: "✓" },
    {
      id: "schedule",
      label: t("mobile.tabs.schedule", "Schedule"),
      icon: "📅",
    },
  ];

  return (
    <div className="flex h-dvh flex-col bg-notion-bg-primary">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center border-b border-notion-border px-4">
        <h1 className="text-lg font-semibold text-notion-text-primary">
          Life Editor
        </h1>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${CONNECTION_COLORS[connectionState]}`}
          />
          <span className="text-xs text-notion-text-secondary">
            {connectionState === "connected"
              ? "Live"
              : connectionState === "connecting"
                ? "..."
                : "Offline"}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="flex shrink-0 border-t border-notion-border bg-notion-bg-primary">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? "text-notion-accent"
                : "text-notion-text-secondary"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export { TAB_TO_SECTION };
export type { MobileTab };
