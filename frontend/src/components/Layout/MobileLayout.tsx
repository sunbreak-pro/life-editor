import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Calendar, Timer, Settings } from "lucide-react";

export type MobileTab = "materials" | "calendar" | "work" | "settings";

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
      id: "materials",
      label: t("mobile.tabs.materials", "Materials"),
      icon: FileText,
    },
    {
      id: "calendar",
      label: t("mobile.tabs.calendar", "Calendar"),
      icon: Calendar,
    },
    { id: "work", label: t("mobile.tabs.work", "Work"), icon: Timer },
    {
      id: "settings",
      label: t("mobile.tabs.settings", "Settings"),
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-dvh flex-col bg-notion-bg-primary">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center border-b border-notion-border px-4">
        <h1 className="text-lg font-semibold text-notion-text-primary">
          Life Editor
        </h1>
      </header>

      {/* Main content */}
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="flex shrink-0 border-t border-notion-border bg-notion-bg-primary">
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
