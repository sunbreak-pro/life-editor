import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ArrowDownAZ, ArrowUpAZ, Tag } from "lucide-react";
import { RoundedCheckbox } from "../shared/RoundedCheckbox";
import { useTranslation } from "react-i18next";
import type { ScheduleItem } from "../../types/schedule";
import { useScheduleItemsContext } from "../../hooks/useScheduleItemsContext";
import { useCalendarTagsContextOptional } from "../../hooks/useCalendarTagsContextOptional";

type SortAxis = "date-desc" | "date-asc" | "title-asc" | "tag";

const SORT_STORAGE_KEY = "eventsListSort";

const SORT_OPTIONS: ReadonlyArray<{
  id: SortAxis;
  labelKey: string;
  fallback: string;
  icon: typeof CalendarClock;
}> = [
  {
    id: "date-desc",
    labelKey: "events.sort.dateDesc",
    fallback: "Newest first",
    icon: CalendarClock,
  },
  {
    id: "date-asc",
    labelKey: "events.sort.dateAsc",
    fallback: "Oldest first",
    icon: CalendarClock,
  },
  {
    id: "title-asc",
    labelKey: "events.sort.titleAsc",
    fallback: "Title (A-Z)",
    icon: ArrowDownAZ,
  },
  {
    id: "tag",
    labelKey: "events.sort.tagGroup",
    fallback: "Group by tag",
    icon: Tag,
  },
];

interface EventListProps {
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  filter: "incomplete" | "completed";
  searchQuery?: string;
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekday = d.toLocaleDateString("default", { weekday: "short" });
  return `${dateStr} (${weekday})`;
}

function readStoredSort(): SortAxis {
  if (typeof window === "undefined") return "date-desc";
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY) as SortAxis;
    if (
      raw === "date-desc" ||
      raw === "date-asc" ||
      raw === "title-asc" ||
      raw === "tag"
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "date-desc";
}

export function EventList({
  selectedEventId,
  onSelectEvent,
  filter,
  searchQuery,
}: EventListProps) {
  const { t } = useTranslation();
  const { events, loadEvents, eventsVersion, toggleComplete } =
    useScheduleItemsContext();
  const calendarCtx = useCalendarTagsContextOptional();
  const calendarTags = calendarCtx?.calendarTags ?? [];
  const getTagForEntity = useMemo(
    () =>
      calendarCtx?.getTagForEntity ??
      ((_t: "task" | "schedule_item", _id: string): number | null => null),
    [calendarCtx],
  );
  const activeFilterTagId = calendarCtx?.activeFilterTagId ?? null;

  const [sortAxis, setSortAxisState] = useState<SortAxis>(() =>
    readStoredSort(),
  );
  const setSortAxis = (axis: SortAxis) => {
    setSortAxisState(axis);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, axis);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadEvents();
  }, [loadEvents, eventsVersion]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery?.toLowerCase().trim();
    return events.filter((e) => {
      if (filter === "completed" ? !e.completed : e.completed) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      // CalendarTag filter (set in CalendarTagsPanel)
      if (activeFilterTagId === "untagged") {
        if (getTagForEntity("schedule_item", e.id) !== null) return false;
      } else if (typeof activeFilterTagId === "number") {
        if (getTagForEntity("schedule_item", e.id) !== activeFilterTagId)
          return false;
      }
      return true;
    });
  }, [events, filter, searchQuery, activeFilterTagId, getTagForEntity]);

  const tagById = useMemo(() => {
    const map = new Map<number, (typeof calendarTags)[number]>();
    for (const tag of calendarTags) map.set(tag.id, tag);
    return map;
  }, [calendarTags]);

  // Group keying depends on sort axis
  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: ScheduleItem[] }> =
      [];

    if (sortAxis === "tag") {
      const buckets = new Map<string, ScheduleItem[]>();
      for (const e of filteredEvents) {
        const tagId = getTagForEntity("schedule_item", e.id);
        const key = tagId == null ? "__untagged__" : `tag-${tagId}`;
        const arr = buckets.get(key) ?? [];
        arr.push(e);
        buckets.set(key, arr);
      }
      // Order: real tags by their `order`, untagged last
      const orderedKeys = [
        ...calendarTags
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => `tag-${t.id}`)
          .filter((k) => buckets.has(k)),
        ...(buckets.has("__untagged__") ? ["__untagged__"] : []),
      ];
      for (const key of orderedKeys) {
        const items = buckets.get(key) ?? [];
        items.sort((a, b) => b.date.localeCompare(a.date));
        const label =
          key === "__untagged__"
            ? t("calendarTags.untagged", "Untagged")
            : (tagById.get(Number(key.replace("tag-", "")))?.name ?? "Tag");
        groups.push({ key, label, items });
      }
      return groups;
    }

    if (sortAxis === "title-asc") {
      const items = filteredEvents
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title));
      groups.push({
        key: "all",
        label: t("events.sort.titleAsc", "Title (A-Z)"),
        items,
      });
      return groups;
    }

    // date-asc / date-desc: group by date
    const buckets = new Map<string, ScheduleItem[]>();
    for (const e of filteredEvents) {
      const arr = buckets.get(e.date) ?? [];
      arr.push(e);
      buckets.set(e.date, arr);
    }
    const dateKeys = [...buckets.keys()].sort((a, b) =>
      sortAxis === "date-asc" ? a.localeCompare(b) : b.localeCompare(a),
    );
    for (const date of dateKeys) {
      const items = buckets.get(date) ?? [];
      groups.push({ key: date, label: formatDateHeading(date), items });
    }
    return groups;
  }, [filteredEvents, sortAxis, getTagForEntity, calendarTags, tagById, t]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sort toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-notion-border/60 shrink-0">
        <ArrowUpAZ size={11} className="text-notion-text-secondary shrink-0" />
        <select
          value={sortAxis}
          onChange={(e) => setSortAxis(e.target.value as SortAxis)}
          className="text-[11px] bg-transparent text-notion-text outline-none cursor-pointer"
          aria-label={t("events.sort.label", "Sort by")}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(opt.labelKey, opt.fallback)}
            </option>
          ))}
        </select>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-notion-text-secondary">
            {t("events.noEvents", "No events")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {grouped.map((group) => (
            <div key={group.key}>
              <div className="px-3 py-1.5 text-[10px] font-medium text-notion-text-secondary uppercase tracking-wide bg-notion-bg-secondary/50 sticky top-0">
                {group.label}
              </div>
              {group.items.map((event) => (
                <div
                  key={event.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectEvent(event.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectEvent(event.id);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors border-l-2 cursor-pointer ${
                    selectedEventId === event.id
                      ? "bg-notion-accent/5 border-l-notion-accent"
                      : "border-l-transparent hover:bg-notion-hover"
                  }`}
                >
                  <RoundedCheckbox
                    checked={event.completed}
                    onChange={() => toggleComplete(event.id)}
                    size={14}
                  />
                  <CalendarClock
                    size={12}
                    className="shrink-0 text-purple-500 opacity-60"
                  />
                  {(() => {
                    const tagId = getTagForEntity("schedule_item", event.id);
                    if (tagId == null) return null;
                    const tag = tagById.get(tagId);
                    if (!tag) return null;
                    return (
                      <span
                        className="w-2 h-2 rounded-full ring-1 ring-notion-border shrink-0"
                        style={{ backgroundColor: tag.color }}
                        title={tag.name}
                      />
                    );
                  })()}
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
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
