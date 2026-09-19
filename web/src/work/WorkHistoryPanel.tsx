import { useMemo, useState } from "react";
import {
  WorkHistoryList,
  useDomainLoad,
  useSyncDomains,
  useTranslation,
  formatDateKey,
  pickWorkHistoryDay,
  todayCalendarKey,
  type DataService,
  type ScheduleItem,
  type TodoNode,
  type WikiTagAssignmentUnified,
  type WikiTagUnified,
  type WorkHistoryDay,
  type WorkHistoryEntry,
} from "@life-editor/shared";
import { formatFullDay } from "../schedule/scheduleCopy";

/*
 * Host for the Work sidebar's "history" tab (#1666). Mounted only while that
 * tab is the active one, so the full session log is not read by a user who
 * never opens it — `fetchTimerSessions` pages through every row ever logged.
 *
 * The read is two steps inside ONE load (one loading flag, see WorkScreen's
 * note on why two loads flicker): the log first, to find the day to show, then
 * the names for that day — todos, the events that day's picker could have
 * offered, and the tag graph. The event range mirrors the picker's own window
 * (the day itself plus seven): a session can only have been attributed to an
 * event that was on offer when it started.
 */

/** The picker's forward window (WorkScreen's EVENT_WINDOW_DAYS). */
const EVENT_LOOKUP_DAYS = 7;

interface HistoryData {
  day: WorkHistoryDay | null;
  todos: TodoNode[];
  events: ScheduleItem[];
  tags: WikiTagUnified[];
  assignments: WikiTagAssignmentUnified[];
}

const EMPTY: HistoryData = {
  day: null,
  todos: [],
  events: [],
  tags: [],
  assignments: [],
};

/** "HH:MM" in local time. */
function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return formatDateKey(new Date(y, m - 1, d + days));
}

export function WorkHistoryPanel({
  dataService: ds,
}: {
  dataService: DataService;
}) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<HistoryData>(EMPTY);
  // Every domain the load reads (rules/frontend.md §Sync): the log, and the
  // three places a row's name and tags come from.
  const version = useSyncDomains("sessions", "todos", "schedule", "tags");
  const todayKey = todayCalendarKey();

  const { isLoading } = useDomainLoad<HistoryData>({
    domain: "Work history",
    dataService: ds,
    version,
    anchor: todayKey,
    // A session closing while the tab is open must not blank the list.
    refetchReportsLoading: false,
    load: async (service) => {
      const day = pickWorkHistoryDay(
        await service.fetchTimerSessions(),
        todayKey,
      );
      if (!day) return EMPTY;
      const [todos, events, tags, assignments] = await Promise.all([
        service.fetchTodoTree(),
        service.fetchScheduleItemsByDateRange(
          day.dateKey,
          addDaysKey(day.dateKey, EVENT_LOOKUP_DAYS),
        ),
        service.listAllWikiTagsUnified(),
        service.listAllTagAssignments(),
      ]);
      return { day, todos, events, tags, assignments };
    },
    apply: setData,
    fallbackMessage: "Failed to load work history",
  });

  const entries = useMemo<WorkHistoryEntry[]>(() => {
    const { day } = data;
    if (!day) return [];
    const todoTitles = new Map(data.todos.map((n) => [n.id, n.title]));
    const eventTitles = new Map(data.events.map((e) => [e.id, e.title]));
    const tagsById = new Map(
      data.tags.filter((tag) => !tag.isDeleted).map((tag) => [tag.id, tag]),
    );
    const tagIdsByItem = new Map<string, string[]>();
    for (const a of data.assignments) {
      if (a.isDeleted) continue;
      const list = tagIdsByItem.get(a.itemId);
      if (list) list.push(a.tagId);
      else tagIdsByItem.set(a.itemId, [a.tagId]);
    }

    return day.sessions.map((s) => {
      const end =
        s.completedAt ?? new Date(s.startedAt.getTime() + s.duration * 1000);
      const targetId = s.todoId || s.eventId || null;
      const kind = s.todoId ? "todo" : "event";
      const title = targetId
        ? (kind === "todo" ? todoTitles : eventTitles).get(targetId)
        : undefined;
      return {
        id: String(s.id),
        timeRange: `${clockTime(s.startedAt)}–${clockTime(end)}`,
        durationLabel: t("work.history.minutes", {
          minutes: Math.max(1, Math.round(s.duration / 60)),
        }),
        target: targetId
          ? { kind, title: title || t("common.untitled") }
          : null,
        tags: targetId
          ? (tagIdsByItem.get(targetId) ?? [])
              .map((id) => tagsById.get(id))
              .filter((tag): tag is WikiTagUnified => tag !== undefined)
              .map((tag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                icon: tag.icon,
              }))
          : [],
      };
    });
  }, [data, t]);

  const heading = data.day
    ? data.day.dateKey === todayKey
      ? t("work.history.today")
      : t("work.history.latestDay", {
          date: formatFullDay(i18n.language, data.day.dateKey),
        })
    : "";

  return (
    <WorkHistoryList
      entries={entries}
      loading={isLoading}
      labels={{
        heading,
        empty: t("work.history.empty"),
        noTarget: t("work.history.noTarget"),
        listLabel: t("work.sidebarTabs.history"),
      }}
    />
  );
}
