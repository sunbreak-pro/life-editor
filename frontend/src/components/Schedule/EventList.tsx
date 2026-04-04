import { useEffect, useMemo } from "react";
import { CalendarClock, Check, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../types/schedule";
import { useScheduleContext } from "../../hooks/useScheduleContext";

interface EventListProps {
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  filter: "incomplete" | "completed";
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString("default", { weekday: "short" });
  return `${dateStr} (${weekday})`;
}

export function EventList({
  selectedEventId,
  onSelectEvent,
  filter,
}: EventListProps) {
  const { t } = useTranslation();
  const { events, loadEvents, eventsVersion, toggleComplete } =
    useScheduleContext();

  useEffect(() => {
    loadEvents();
  }, [loadEvents, eventsVersion]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) =>
      filter === "completed" ? e.completed : !e.completed,
    );
  }, [events, filter]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ScheduleItem[]>();
    for (const event of filteredEvents) {
      const existing = groups.get(event.date);
      if (existing) existing.push(event);
      else groups.set(event.date, [event]);
    }
    return groups;
  }, [filteredEvents]);

  if (filteredEvents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-notion-text-secondary">
          {t("events.noEvents", "No events")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {[...groupedEvents.entries()].map(([date, items]) => (
        <div key={date}>
          <div className="px-3 py-1.5 text-[10px] font-medium text-notion-text-secondary uppercase tracking-wide bg-notion-bg-secondary/50 sticky top-0">
            {formatDateHeading(date)}
          </div>
          {items.map((event) => (
            <button
              key={event.id}
              onClick={() => onSelectEvent(event.id)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors border-l-2 ${
                selectedEventId === event.id
                  ? "bg-notion-accent/5 border-l-notion-accent"
                  : "border-l-transparent hover:bg-notion-hover"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleComplete(event.id);
                }}
                className="shrink-0 text-notion-text-secondary hover:text-notion-accent transition-colors"
              >
                {event.completed ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Circle size={14} />
                )}
              </button>
              <CalendarClock
                size={12}
                className="shrink-0 text-purple-500 opacity-60"
              />
              <span
                className={`flex-1 truncate ${
                  event.completed
                    ? "text-notion-text-secondary line-through"
                    : "text-notion-text"
                }`}
              >
                {event.title}
              </span>
              {!event.isAllDay && (
                <span className="text-[10px] text-notion-text-secondary shrink-0">
                  {event.startTime}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
