import { useTranslation } from "react-i18next";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { LogViewer } from "./LogViewer";

export function DeveloperTools() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8" data-section-id="devtools">
      <h3 className="text-lg font-semibold text-notion-text">
        {t("settings.developerTools")}
      </h3>
      <PerformanceMonitor />
      <div className="border-t border-notion-border" />
      <LogViewer />
    </div>
  );
}
