import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Calendar, Timer, Settings } from "lucide-react";

export type MobileTab = "schedule" | "work" | "materials" | "settings";

interface MobileLayoutProps {
  children: ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export function MobileLayout({
  children,
  activeTab,
  onTabChange,
}: MobileLayoutProps) {
  const { t } = useTranslation();

  const tabs: Array<{
    id: MobileTab;
    label: string;
    icon: typeof FileText;
  }> = [
    {
      id: "schedule",
      label: t("mobile.tabs.schedule", "Schedule"),
      icon: Calendar,
    },
    { id: "work", label: t("mobile.tabs.work", "Work"), icon: Timer },
    {
      id: "materials",
      label: t("mobile.tabs.materials", "Materials"),
      icon: FileText,
    },
    {
      id: "settings",
      label: t("mobile.tabs.settings", "Settings"),
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-dvh flex-col bg-notion-bg-primary pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Header */}
      <header
        className="flex shrink-0 items-center border-b border-notion-border px-4 pt-[env(safe-area-inset-top)]"
        style={{ minHeight: "calc(3rem + env(safe-area-inset-top, 0px))" }}
      >
        <h1 className="text-lg font-semibold text-notion-text-primary">
          Life Editor
        </h1>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="flex shrink-0 border-t border-notion-border bg-notion-bg-primary pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? "text-notion-accent" : "text-notion-text-secondary"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
