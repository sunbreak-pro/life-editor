import { useState, useCallback, useRef } from "react";
import { isApiConfigured } from "./config/api";
import { ConnectionSetup } from "./components/Mobile/ConnectionSetup";
import { MobileLayout, type MobileTab } from "./components/Layout/MobileLayout";
import { MobileMaterialsView } from "./components/Mobile/MobileMaterialsView";
import { MobileCalendarView } from "./components/Mobile/MobileCalendarView";
import { MobileWorkView } from "./components/Mobile/MobileWorkView";
import { MobileSettingsView } from "./components/Mobile/MobileSettingsView";
import { useRealtimeSync, type ChangeEvent } from "./hooks/useRealtimeSync";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const TAB_ENTITY_MAP: Record<MobileTab, string[]> = {
  materials: [
    "memo",
    "timeMemo",
    "note",
    "noteConnection",
    "wikiTag",
    "wikiTagGroup",
    "wikiTagConnection",
  ],
  calendar: ["task", "scheduleItem", "routine", "routineTag", "calendar"],
  work: ["task", "timerSession"],
  settings: [],
};

interface MobileAppProps {
  local?: boolean;
}

export function MobileApp({ local = false }: MobileAppProps) {
  const [connected, setConnected] = useState(local || isApiConfigured());
  const [activeTab, setActiveTab] = useState<MobileTab>("materials");
  const [refreshKey, setRefreshKey] = useState(0);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleChange = useCallback((event: ChangeEvent) => {
    const relevantEntities = TAB_ENTITY_MAP[activeTabRef.current];
    if (relevantEntities?.includes(event.entity)) {
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const realtimeState = useRealtimeSync(handleChange);
  const onlineStatus = useOnlineStatus();

  const connectionState = local ? "connected" : realtimeState;
  const syncStatus = local ? ("idle" as const) : onlineStatus.syncStatus;
  const pendingCount = local ? 0 : onlineStatus.pendingCount;

  if (!connected) {
    return <ConnectionSetup onConnected={() => setConnected(true)} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "materials":
        return <MobileMaterialsView key={refreshKey} />;
      case "calendar":
        return <MobileCalendarView key={refreshKey} />;
      case "work":
        return <MobileWorkView key={refreshKey} />;
      case "settings":
        return (
          <MobileSettingsView
            onDisconnect={() => setConnected(false)}
            local={local}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MobileLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      connectionState={connectionState}
      syncStatus={syncStatus}
      pendingCount={pendingCount}
    >
      {renderContent()}
    </MobileLayout>
  );
}
