import { useState, useCallback, useRef } from "react";
import { isApiConfigured } from "./config/api";
import { ConnectionSetup } from "./components/Mobile/ConnectionSetup";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileMemoView } from "./components/Mobile/MobileMemoView";
import { MobileNoteView } from "./components/Mobile/MobileNoteView";
import { MobileTaskView } from "./components/Mobile/MobileTaskView";
import { MobileScheduleView } from "./components/Mobile/MobileScheduleView";
import { useRealtimeSync, type ChangeEvent } from "./hooks/useRealtimeSync";

const TAB_ENTITY_MAP: Record<MobileTab, string[]> = {
  memos: ["memo", "timeMemo"],
  notes: [
    "note",
    "noteConnection",
    "wikiTag",
    "wikiTagGroup",
    "wikiTagConnection",
  ],
  tasks: ["task"],
  schedule: ["scheduleItem", "routine", "routineTag", "calendar"],
};

export function MobileApp() {
  const [connected, setConnected] = useState(isApiConfigured());
  const [activeTab, setActiveTab] = useState<MobileTab>("memos");
  const [refreshKey, setRefreshKey] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleChange = useCallback((event: ChangeEvent) => {
    const relevantEntities = TAB_ENTITY_MAP[activeTabRef.current];
    if (relevantEntities?.includes(event.entity)) {
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const connectionState = useRealtimeSync(handleChange);

  if (!connected) {
    return <ConnectionSetup onConnected={() => setConnected(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "memos":
        return <MobileMemoView key={refreshKey} />;
      case "notes":
        return <MobileNoteView key={refreshKey} />;
      case "tasks":
        return <MobileTaskView key={refreshKey} />;
      case "schedule":
        return <MobileScheduleView key={refreshKey} />;
      default:
        return null;
    }
  };

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionState={connectionState}
    >
      {renderContent()}
    </MobileLayout>
  );
}
