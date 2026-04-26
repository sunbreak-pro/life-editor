import { useState } from "react";
import { CalendarClock, CheckCircle2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionTabs } from "../shared/SectionTabs";
import type { TabItem } from "../shared/SectionTabs";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useResizablePanel } from "../../hooks/useResizablePanel";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { EventList } from "./EventList";
import { EventDetailPanel } from "./EventDetailPanel";
import { EventQuickCreatePopover } from "./EventQuickCreatePopover";

type EventFilterTab = "incomplete" | "completed";

const EVENT_FILTER_TABS: readonly TabItem<EventFilterTab>[] = [
  {
    id: "incomplete",
    labelKey: "events.filterIncomplete",
    icon: CalendarClock,
  },
  { id: "completed", labelKey: "events.filterCompleted", icon: CheckCircle2 },
];

interface ScheduleEventsContentProps {
  sidebarSearchQuery?: string;
}

export function ScheduleEventsContent({
  sidebarSearchQuery,
}: ScheduleEventsContentProps) {
  const { t } = useTranslation();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showCreatePopover, setShowCreatePopover] = useState(false);
  const [activeTab, setActiveTab] = useLocalStorage<EventFilterTab>(
    STORAGE_KEYS.EVENTS_FILTER_TAB,
    "incomplete",
  );

  const { width, dragWidth, handleMouseDown, containerRef } = useResizablePanel(
    {
      storageKey: STORAGE_KEYS.SCHEDULE_EVENTS_LEFT_WIDTH,
      defaultWidth: 340,
      minWidth: 250,
      maxWidth: 600,
    },
  );

  const currentWidth = dragWidth ?? width;

  return (
    <div ref={containerRef} className="h-full flex min-h-0">
      {/* Left column: Event List */}
      <div
        className="flex flex-col border-r border-notion-border shrink-0 relative"
        style={{ width: currentWidth }}
      >
        <div className="flex items-center border-b border-notion-border relative">
          <SectionTabs
            tabs={EVENT_FILTER_TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            size="sm"
            noBorder
          />
          <button
            onClick={() => setShowCreatePopover(!showCreatePopover)}
            className="ml-auto mr-2 p-1 text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover rounded-md transition-colors"
            title={t("events.createEvent")}
          >
            <Plus size={14} />
          </button>
          {showCreatePopover && (
            <EventQuickCreatePopover
              onClose={() => setShowCreatePopover(false)}
            />
          )}
        </div>
        <EventList
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          filter={activeTab}
          searchQuery={sidebarSearchQuery}
        />

        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-notion-accent/30 transition-colors z-10"
        />
      </div>

      {/* Right column: Detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <EventDetailPanel selectedEventId={selectedEventId} />
      </div>
    </div>
  );
}
