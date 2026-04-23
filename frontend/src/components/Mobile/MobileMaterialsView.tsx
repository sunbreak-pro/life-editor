import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MobileDailyView } from "./MobileDailyView";
import { MobileNoteView } from "./MobileNoteView";

type MaterialsTab = "daily" | "notes";

export function MobileMaterialsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MaterialsTab>("daily");

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab bar */}
      <div className="flex shrink-0 border-b border-notion-border">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === "daily"
              ? "border-b-2 border-notion-accent text-notion-accent"
              : "text-notion-text-secondary"
          }`}
        >
          {t("mobile.tabs.daily", "Daily")}
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
            activeTab === "notes"
              ? "border-b-2 border-notion-accent text-notion-accent"
              : "text-notion-text-secondary"
          }`}
        >
          {t("mobile.tabs.notes", "Notes")}
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {activeTab === "daily" ? <MobileDailyView /> : <MobileNoteView />}
      </div>
    </div>
  );
}
