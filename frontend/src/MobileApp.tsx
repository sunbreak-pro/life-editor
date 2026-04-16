import { useState } from "react";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileMaterialsView } from "./components/Mobile/MobileMaterialsView";
import { MobileCalendarView } from "./components/Mobile/MobileCalendarView";
import { MobileWorkView } from "./components/Mobile/MobileWorkView";
import { MobileSettingsView } from "./components/Mobile/MobileSettingsView";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("materials");

  const renderContent = () => {
    switch (activeTab) {
      case "materials":
        return <MobileMaterialsView />;
      case "calendar":
        return <MobileCalendarView />;
      case "work":
        return <MobileWorkView />;
      case "settings":
        return <MobileSettingsView />;
      default:
        return null;
    }
  };

  return (
    <MobileLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </MobileLayout>
  );
}
