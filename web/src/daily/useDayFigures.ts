import { useEffect, useMemo, useState } from "react";
import {
  eveningDayCounts,
  getDayStartHour,
  goalsMovedToday,
  useGoalLinkSnapshot,
  useSyncDomains,
  type DataService,
  type ScheduleItem,
  type TimerSession,
  type TodoNode,
} from "@life-editor/shared";

/*
 * The four numbers under the Daily body (#2123, D-20261006-main-7): the
 * day's events, its todo rate, its work time and the goals it moved.
 *
 * Counted by the evening paper's own functions (eveningDayCounts /
 * goalsMovedToday) so the two screens cannot disagree — the plan forbids a
 * second way of counting them (D-20261006-main-3). This hook only gathers the
 * day's rows for them.
 *
 * DataService is optional because DailyView's own `dataService` prop is:
 * without it there is nothing to count and the figures stay null. Re-fetches
 * on the domains it reads (rules/frontend.md §Sync); the goals and their links
 * come through useGoalLinkSnapshot, which watches `goals` itself. Its todo
 * tree is ours (`NO_TREE` keeps it from reading a second one) — goalsMovedToday
 * takes the todos separately.
 */

export interface DayFigures {
  events: number;
  todosDone: number;
  todosTotal: number;
  /** Unrounded minutes. */
  workMinutes: number;
  /** Null until the goals land (or when their read failed). */
  goalsMoved: number | null;
}

interface Loaded {
  date: string;
  scheduleItems: ScheduleItem[];
  todos: TodoNode[];
  sessions: TimerSession[];
}

const NO_TREE: readonly TodoNode[] = [];

export function useDayFigures(
  ds: DataService | undefined,
  date: string,
): DayFigures | null {
  const syncVersion = useSyncDomains("schedule", "todos", "sessions");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const goalSnapshot = useGoalLinkSnapshot(ds ?? null, {
    active: ds !== undefined,
    todos: NO_TREE,
  });

  useEffect(() => {
    if (ds === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const [scheduleItems, todos, sessions] = await Promise.all([
          ds.fetchScheduleItemsByDate(date),
          ds.fetchTodoTree(),
          ds.fetchTimerSessions(),
        ]);
        if (!cancelled) setLoaded({ date, scheduleItems, todos, sessions });
      } catch (err: unknown) {
        // A read for a passive summary: keep whatever was shown, no toast.
        console.error("[DailyView] day figures fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ds, date, syncVersion]);

  const goalState = goalSnapshot.state;
  return useMemo(() => {
    // The rows carry the date they answer for, so a day switch shows no
    // numbers until the new day resolves — never the previous day's.
    if (loaded === null || loaded.date !== date) return null;
    const dayStartHour = getDayStartHour();
    const counts = eveningDayCounts({
      dateKey: date,
      dayStartHour,
      scheduleItems: loaded.scheduleItems,
      todos: loaded.todos,
      sessions: loaded.sessions,
    });
    return {
      events: counts.events,
      todosDone: counts.todosDone,
      todosTotal: counts.todosTotal,
      workMinutes: counts.workMinutes,
      goalsMoved:
        goalState === null
          ? null
          : goalsMovedToday({
              goals: goalState.goals,
              links: goalState.links,
              todos: loaded.todos,
              dateKey: date,
              dayStartHour,
            }).length,
    };
  }, [loaded, date, goalState]);
}
