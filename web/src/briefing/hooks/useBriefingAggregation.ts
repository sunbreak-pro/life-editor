import { useCallback, useMemo } from "react";
import {
  dateKeyOfInstant,
  extractBriefing,
  pickAddableTodos,
  todoScheduleSlot,
  todosToCalendarChips,
  useTranslation,
  type BriefingCarryoverEntry,
  type BriefingData,
  type BriefingScheduleEntry,
  type BriefingTodoEntry,
  type EveningScheduleEntry,
  type EveningTodoEntry,
  type ItemCreateOption,
  type NoteNode,
  type ScheduleItem,
  type TimerSession,
  type TodoNode,
  type TodoStatus,
  type TodayTodoRow,
  type WikiTagConnectionUnified,
} from "@life-editor/shared";

/*
 * Briefing's AGGREGATION half (#892 — split out of useBriefingData, zero
 * behavior change): fetched rows in, the paper's blocks out. Pure derivation —
 * it holds no state and makes no DataService call, so every rule about what
 * belongs on today's paper lives in one place and is testable by handing it a
 * list (web/tests/briefingDataAggregation.test.tsx).
 */

/*
 * LOCAL "YYYY-MM-DD" from a stored scheduledAt (#413 fix). This used to slice
 * the first 10 chars, which reads the UTC day: in JST an all-day todo staged
 * at local midnight is stored as `…T15:00:00Z` on the PREVIOUS date, so the
 * paper filed every such todo under 持ち越し「2日目」 instead of 今日の Todo
 * — including the ones the new rightSidebar tray adds. The tray itself keys
 * on the LOCAL day (todosToCalendarChips), and now so does the paper.
 */
const dateKeyOf = dateKeyOfInstant;

/** Whole-day difference between two "YYYY-MM-DD" keys (b - a). */
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export interface BriefingAggregationInput {
  todayKey: string;
  scheduleItems: ScheduleItem[];
  tomorrowItems: ScheduleItem[];
  todoNodes: TodoNode[];
  sessions: TimerSession[];
  dailyContent: string | null;
  notes: NoteNode[];
  connections: WikiTagConnectionUnified[];
}

export interface BriefingAggregation {
  data: BriefingData;
  dateLine: string;
  remainingTodos: EveningTodoEntry[];
  upcoming: EveningScheduleEntry[];
  noteOptions: ItemCreateOption[];
  todoPlaced: TodayTodoRow[];
  todoUnplaced: TodayTodoRow[];
  todoAddable: ReturnType<typeof pickAddableTodos>;
}

export function useBriefingAggregation({
  todayKey,
  scheduleItems,
  tomorrowItems,
  todoNodes,
  sessions,
  dailyContent,
  notes,
  connections,
}: BriefingAggregationInput): BriefingAggregation {
  const { t, i18n } = useTranslation();

  const noteTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      if (n.isDeleted !== true) map.set(n.id, n.title || "");
    }
    return map;
  }, [notes]);

  /** Titles of notes linked to an item (either link direction). */
  const purposesOf = useCallback(
    (itemId: string): string[] => {
      const titles: string[] = [];
      for (const link of connections) {
        const other =
          link.fromItemId === itemId
            ? link.toItemId
            : link.toItemId === itemId
              ? link.fromItemId
              : null;
        if (other === null) continue;
        const title = noteTitleById.get(other);
        if (title !== undefined && title !== "") titles.push(title);
      }
      return titles;
    },
    [connections, noteTitleById],
  );

  const schedule = useMemo<BriefingScheduleEntry[]>(
    () =>
      scheduleItems
        .filter((s) => s.isDeleted !== true && s.isDismissed !== true)
        .sort((a, b) => {
          const aAll = a.isAllDay === true ? 0 : 1;
          const bAll = b.isAllDay === true ? 0 : 1;
          if (aAll !== bAll) return aAll - bAll;
          return a.startTime.localeCompare(b.startTime);
        })
        .map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          completed: s.completed,
          isRoutine: s.routineId !== null,
          isAllDay: s.isAllDay === true,
        })),
    [scheduleItems],
  );

  const liveTodos = useMemo(
    () => todoNodes.filter((n) => n.type === "task" && n.isDeleted !== true),
    [todoNodes],
  );

  // Not started / In progress / Done by todo id (#796). The paper's rows and
  // the tray's chips both flattened status to a boolean; this is what they read
  // it back from, so neither has to carry its own copy of the rule.
  const statusById = useMemo(() => {
    const map = new Map<string, TodoStatus>();
    for (const n of liveTodos) map.set(n.id, n.status ?? "NOT_STARTED");
    return map;
  }, [liveTodos]);

  /*
   * HH:MM for the paper's todo rows (#1369). The paper used to drop the clock
   * a todo was placed at, so a 09:00 todo and a someday-today todo printed
   * identically — the reader had to open Schedule to tell them apart.
   *
   * `todoScheduleSlot` is the same selector the calendar chips and the tray
   * read, so "is this todo timed, and at what?" is answered once: it folds
   * an unparseable instant and a degenerate span into the all-day case, which
   * is why the paper cannot print "Invalid Date" or an inverted span here. An
   * all-day slot's "00:00" is deliberately NOT surfaced — midnight is the
   * placeholder the grid draws all-day bands with, not a time the todo has —
   * so those rows pass "" and keep the empty column they have always had.
   */
  const todayTodos = useMemo<BriefingTodoEntry[]>(
    () =>
      liveTodos
        .filter((n) => dateKeyOf(n.scheduledAt) === todayKey)
        .map((n) => {
          const slot = todoScheduleSlot(n);
          return {
            id: n.id,
            title: n.title,
            status: n.status ?? "NOT_STARTED",
            startTime: slot !== null && !slot.isAllDay ? slot.startTime : "",
            purposes: purposesOf(n.id),
          };
        }),
    [liveTodos, todayKey, purposesOf],
  );

  const carryover = useMemo<BriefingCarryoverEntry[]>(
    () =>
      liveTodos
        .filter((n) => {
          const key = dateKeyOf(n.scheduledAt);
          if (key === null || key >= todayKey) return false;
          if (n.status !== "DONE") return true;
          return (
            n.completedAt !== undefined &&
            Date.parse(n.completedAt) >= Date.parse(`${todayKey}T00:00:00`)
          );
        })
        .map((n) => ({
          node: n,
          days: daysBetween(dateKeyOf(n.scheduledAt) ?? todayKey, todayKey),
        }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5)
        .map(({ node, days }) => ({
          id: node.id,
          title: node.title,
          daysLabel: t("briefing.carryoverDays", { count: days + 1 }),
          completed: node.status === "DONE",
        })),
    [liveTodos, todayKey, t],
  );

  const dateLine = useMemo(() => {
    const locale = i18n.language.startsWith("ja") ? "ja-JP" : "en-US";
    return new Date(`${todayKey}T00:00:00`).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [todayKey, i18n.language]);

  const data = useMemo<BriefingData>(
    () => ({
      dateLine,
      briefing: extractBriefing(dailyContent),
      schedule,
      todos: todayTodos,
      carryover,
      sessions,
      todoNodes: liveTodos,
    }),
    [
      dateLine,
      dailyContent,
      schedule,
      todayTodos,
      carryover,
      sessions,
      liveTodos,
    ],
  );

  //「残りの Todo」— today's unfinished + open carryover, each carrying its real
  // Not started / In progress / Done status (#796).
  //
  // A row moved to DONE **today** stays on the list (struck through) instead of
  // vanishing under the finger that tapped it: a control you cannot see the
  // result of is not a control, and taking a mis-tap back must not mean going
  // to another screen. Same "completed today still counts" rule the carryover
  // block already used, so a todo closed yesterday is still gone.
  const remainingTodos = useMemo<EveningTodoEntry[]>(() => {
    const dayStart = Date.parse(`${todayKey}T00:00:00`);
    return [
      ...liveTodos
        .filter((n) => dateKeyOf(n.scheduledAt) === todayKey)
        .filter(
          (n) =>
            n.status !== "DONE" ||
            (n.completedAt !== undefined &&
              Date.parse(n.completedAt) >= dayStart),
        )
        .map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status ?? "NOT_STARTED",
        })),
      ...carryover.map((item) => ({
        id: item.id,
        title: item.title,
        meta: item.daysLabel,
        status: statusById.get(item.id) ?? "NOT_STARTED",
      })),
    ];
  }, [liveTodos, todayKey, carryover, statusById]);

  //「今後の予定」— the rest of today (from now) + all of tomorrow.
  const upcoming = useMemo<EveningScheduleEntry[]>(() => {
    const now = new Date();
    const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    const todayRest = schedule
      .filter((s) => !s.completed && (s.isAllDay || s.startTime >= nowHHMM))
      .map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        isAllDay: s.isAllDay,
        isTomorrow: false,
      }));
    const tomorrow = tomorrowItems
      .filter((s) => s.isDeleted !== true && s.isDismissed !== true)
      .sort((a, b) => {
        const aAll = a.isAllDay === true ? 0 : 1;
        const bAll = b.isAllDay === true ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        return a.startTime.localeCompare(b.startTime);
      })
      .map((s) => ({
        id: s.id,
        title: s.title,
        startTime: s.startTime,
        isAllDay: s.isAllDay === true,
        isTomorrow: true,
      }));
    return [...todayRest, ...tomorrow];
  }, [schedule, tomorrowItems]);

  /** The pool the create panel's "existing note" picker offers (live, newest first). */
  const noteOptions = useMemo<ItemCreateOption[]>(
    () =>
      notes
        .filter((n) => n.isDeleted !== true)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  // ── Today's Todo tray (rightSidebar — #413) ──────────────────────────
  // The SAME <TodayTodoTray> the Schedule rightSidebar mounts (#298), backed
  // by the same pure selectors: today's todo chips split into placed (has a
  // time) and unplaced (all-day candidate), plus pickAddableTodos for the
  // "add from todos" picker. One implementation, two hosts — a second copy
  // here would drift the moment one side is fixed.
  //
  // "Today" here is Briefing's own todayKey (todayDateKey — day-start-hour
  // aware, #373), NOT Schedule's plain calendar key: the tray sits beside the
  // paper's 今日の Todo list and has to agree with it. The two definitions
  // differ only between midnight and the configured day-start hour.
  const todayChips = useMemo(
    () => todosToCalendarChips(liveTodos, todayKey, todayKey),
    [liveTodos, todayKey],
  );
  // The chips carry a completed flag, not the three-way status the tray now
  // shows (#796) — read it back off the todo the chip came from (statusById).
  const todoPlaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => !c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          timeLabel: c.startTime,
          completed: c.completed,
          status: statusById.get(c.id) ?? "NOT_STARTED",
        })),
    [todayChips, statusById],
  );
  const todoUnplaced = useMemo<TodayTodoRow[]>(
    () =>
      todayChips
        .filter((c) => c.isAllDay)
        .map((c) => ({
          id: c.id,
          title: c.title,
          completed: c.completed,
          status: statusById.get(c.id) ?? "NOT_STARTED",
        })),
    [todayChips, statusById],
  );
  const todoAddable = useMemo(() => pickAddableTodos(liveTodos), [liveTodos]);

  return {
    data,
    dateLine,
    remainingTodos,
    upcoming,
    noteOptions,
    todoPlaced,
    todoUnplaced,
    todoAddable,
  };
}
