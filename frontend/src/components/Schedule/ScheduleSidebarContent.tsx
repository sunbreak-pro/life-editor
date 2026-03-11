import { useState } from "react";
import type { ReactNode } from "react";
import { AchievementPanel } from "../Tasks/Schedule/Routine/AchievementPanel";
import { AchievementDetailsOverlay } from "../Tasks/Schedule/Routine/AchievementDetailsOverlay";
import type { RoutineStats } from "../../types/schedule";

interface ScheduleSidebarContentProps {
  routineStats: RoutineStats | null;
  children: ReactNode;
}

export function ScheduleSidebarContent({
  routineStats,
  children,
}: ScheduleSidebarContentProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>

      {routineStats && (
        <div className="px-3 py-2 border-t border-notion-border mt-auto shrink-0">
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        </div>
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
