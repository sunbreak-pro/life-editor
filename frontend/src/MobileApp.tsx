import { useState } from "react";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileMaterialsView } from "./components/Mobile/MobileMaterialsView";
import { MobileCalendarView } from "./components/Mobile/MobileCalendarView";
import { MobileWorkView } from "./components/Mobile/MobileWorkView";
import { MobileSettingsView } from "./components/Mobile/MobileSettingsView";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<MobileTab>("schedule");

  const renderContent = () => {
    switch (activeTab) {
      case "schedule":
        return <MobileCalendarView />;
      case "work":
        return <MobileWorkView />;
      case "materials":
        return <MobileMaterialsView />;
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
