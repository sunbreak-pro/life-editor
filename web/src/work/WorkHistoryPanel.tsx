import { useMemo, useState } from "react";
import {
  WorkHistoryList,
  useDomainLoad,
  useSyncDomains,
  useTranslation,
  formatDateKey,
  pickWorkHistoryDay,
  pickWorkHistoryDays,
  todayCalendarKey,
  type DataService,
  type ScheduleItem,
  type TodoNode,
  type WikiTagAssignmentUnified,
  type WikiTagUnified,
  type WorkHistoryDay,
  type WorkHistoryEntry,
  type WorkHistoryGroup,
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
 *
 * `variant="rows"` is the Mobile drawer (#2054): the same rows in plan A's flat
 * layout, and TWO days — today and yesterday, each under its own heading
 * (D-20261003-work-2, `pickWorkHistoryDays`). The Desktop card keeps the one
 * latest day. Either way the whole log is already read, so the second day
 * costs no extra fetch — only a wider event range for its names.
 */

/** The picker's forward window (WorkScreen's EVENT_WINDOW_DAYS). */
const EVENT_LOOKUP_DAYS = 7;

interface HistoryData {
  /** Newest first. Empty when nothing has ever been worked. */
  days: WorkHistoryDay[];
  todos: TodoNode[];
  events: ScheduleItem[];
  tags: WikiTagUnified[];
  assignments: WikiTagAssignmentUnified[];
}

const EMPTY: HistoryData = {
  days: [],
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
  variant = "card",
}: {
  dataService: DataService;
  /** card = the Desktop panel; rows = the Mobile drawer (#2054). */
  variant?: "card" | "rows";
}) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<HistoryData>(EMPTY);
  // Every domain the load reads (rules/frontend.md §Sync): the log, and the
  // three places a row's name and tags come from.
  const version = useSyncDomains("sessions", "todos", "schedule", "tags");
  const todayKey = todayCalendarKey();
  // The failed-read state's retry (#2054) re-runs the load by moving the
  // version on: `useDomainLoad` restarts on any version change, and the sum
  // only ever grows, so a retry never lands on a version it already settled.
  const [reloadTick, setReloadTick] = useState(0);
  // `refetchReportsLoading` is off, so a retry would otherwise look like
  // nothing happened: this flag is raised by the button and dropped when the
  // load it started settles, either way.
  const [retrying, setRetrying] = useState(false);

  const { isLoading, error } = useDomainLoad<HistoryData>({
    domain: "Work history",
    dataService: ds,
    version: version + reloadTick,
    anchor: todayKey,
    // A session closing while the tab is open must not blank the list.
    refetchReportsLoading: false,
    load: (service) => readHistory(service).finally(() => setRetrying(false)),
    apply: setData,
    fallbackMessage: "Failed to load work history",
  });

  async function readHistory(service: DataService): Promise<HistoryData> {
    const sessions = await service.fetchTimerSessions();
    const days =
      variant === "rows"
        ? pickWorkHistoryDays(sessions, todayKey)
        : [pickWorkHistoryDay(sessions, todayKey)].filter(
            (day): day is WorkHistoryDay => day !== null,
          );
    if (days.length === 0) return EMPTY;
    // Newest first, so the oldest day opens the range and the newest day's
    // picker window closes it.
    const [todos, events, tags, assignments] = await Promise.all([
      service.fetchTodoTree(),
      service.fetchScheduleItemsByDateRange(
        days[days.length - 1].dateKey,
        addDaysKey(days[0].dateKey, EVENT_LOOKUP_DAYS),
      ),
      service.listAllWikiTagsUnified(),
      service.listAllTagAssignments(),
    ]);
    return { days, todos, events, tags, assignments };
  }

  const groups = useMemo<WorkHistoryGroup[]>(() => {
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

    const toEntry = (
      s: WorkHistoryDay["sessions"][number],
    ): WorkHistoryEntry => {
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
    };

    const yesterdayKey = addDaysKey(todayKey, -1);
    return data.days.map((day) => ({
      key: day.dateKey,
      heading:
        day.dateKey === todayKey
          ? t("work.history.today")
          : // "Yesterday" on the Mobile drawer, which reads the days as a
            // pair; the Desktop card keeps the dated heading it always had.
            day.dateKey === yesterdayKey && variant === "rows"
            ? t("work.history.yesterday")
            : t("work.history.latestDay", {
                date: formatFullDay(i18n.language, day.dateKey),
              }),
      entries: day.sessions.map(toEntry),
    }));
  }, [data, t, i18n.language, todayKey, variant]);

  return (
    <WorkHistoryList
      entries={groups[0]?.entries ?? []}
      groups={variant === "rows" ? groups : undefined}
      loading={isLoading}
      variant={variant}
      loadFailed={error !== null}
      onRetry={() => {
        setRetrying(true);
        setReloadTick((n) => n + 1);
      }}
      retrying={retrying}
      labels={{
        heading: groups[0]?.heading ?? "",
        empty:
          variant === "rows"
            ? t("work.history.emptyBody")
            : t("work.history.empty"),
        emptyTitle: t("work.history.emptyTitle"),
        noTarget: t("work.history.noTarget"),
        listLabel: t("work.sidebarTabs.history"),
        loadFailedTitle: t("work.history.loadFailedTitle"),
        loadFailedBody: t("work.history.loadFailedBody"),
        retry: t("work.history.retry"),
        retrying: t("common.loading"),
      }}
    />
  );
}
