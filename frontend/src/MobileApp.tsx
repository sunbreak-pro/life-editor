import { useState } from "react";
import { isApiConfigured } from "./config/api";
import { ConnectionSetup } from "./components/Mobile/ConnectionSetup";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileMemoView } from "./components/Mobile/MobileMemoView";
import { MobileNoteView } from "./components/Mobile/MobileNoteView";
import { MobileTaskView } from "./components/Mobile/MobileTaskView";
import { MobileScheduleView } from "./components/Mobile/MobileScheduleView";

export function MobileApp() {
  const [connected, setConnected] = useState(isApiConfigured());
  const [activeTab, setActiveTab] = useState<MobileTab>("memos");

  if (!connected) {
    return <ConnectionSetup onConnected={() => setConnected(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "memos":
        return <MobileMemoView />;
      case "notes":
        return <MobileNoteView />;
      case "tasks":
        return <MobileTaskView />;
      case "schedule":
        return <MobileScheduleView />;
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
