import { useMemo } from "react";
import { Flame, Trophy, BarChart3 } from "lucide-react";
import type { TimerSession } from "../../types/timer";
import type { TaskNode } from "../../types/taskTree";
import type { ScheduleItem } from "../../types/schedule";
import type { NoteNode } from "../../types/note";
import type { RoutineNode } from "../../types/routine";
import { formatDateKey } from "../../utils/dateKey";
import {
  aggregateByDay,
  aggregateRoutineCompletion,
  computeWorkStreak,
  getWorkSessions,
} from "../../utils/analyticsAggregation";
import { EmptyState } from "./EmptyState";
import type { AnalyticsLabels } from "./labels";

/*
 * Mobile (<768px) Analytics — a single Consumption scroll (design 1l–1o). No
 * tabs, no heatmap/timeline, no period switch: the range is a fixed last-30-day
 * window (the host's default preset). Order: 今日 → ストリーク → 今週 → stat 2×2
 * → ルーチン上位3. Pure presentation: copy arrives already-translated (§6.4),
 * lumen-* tokens only (§5).
 */
interface MobileAnalyticsViewProps {
  sessions: TimerSession[];
  nodes: TaskNode[];
  todayItems: ScheduleItem[];
  /** Schedule items for the default (30d) range — routine rate + top routines. */
  scheduleItems: ScheduleItem[];
  notes: NoteNode[];
  routines: RoutineNode[];
  loading: boolean;
  labels: AnalyticsLabels;
}

const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isEmpty(p: MobileAnalyticsViewProps): boolean {
  return (
    p.sessions.length === 0 &&
    p.nodes.length === 0 &&
    p.routines.length === 0 &&
    p.notes.length === 0 &&
    p.scheduleItems.length === 0 &&
    p.todayItems.length === 0
  );
}

export function MobileAnalyticsView(
  props: MobileAnalyticsViewProps,
): React.JSX.Element {
  const { sessions, nodes, todayItems, scheduleItems, notes, routines, labels } =
    props;

  const model = useMemo(() => {
    const todayStr = formatDateKey(new Date());

    // Today
    const todaySessions = sessions.filter(
      (s) => formatDateKey(new Date(s.startedAt)) === todayStr,
    );
    const todayWorkMinutes = getWorkSessions(todaySessions).reduce(
      (sum, s) => sum + (s.duration ?? 0) / 60,
      0,
    );
    const pomodoroCount = todaySessions.filter(
      (s) => s.sessionType === "WORK" && s.completed,
    ).length;
    const completedToday = nodes.filter(
      (n) =>
        n.type === "task" &&
        n.completedAt &&
        n.completedAt.substring(0, 10) === todayStr,
    ).length;

    // Streak
    const streak = computeWorkStreak(sessions);

    // This week (Mon–Sun)
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = formatDateKey(monday);
    const weekEnd = formatDateKey(sunday);
    const weekWork = getWorkSessions(sessions).filter((s) => {
      const d = formatDateKey(new Date(s.startedAt));
      return d >= weekStart && d <= weekEnd;
    });
    const weekMinutes = weekWork.reduce(
      (sum, s) => sum + (s.duration ?? 0) / 60,
      0,
    );
    const weekCompleted = nodes.filter((n) => {
      if (n.type !== "task" || !n.completedAt) return false;
      const d = n.completedAt.substring(0, 10);
      return d >= weekStart && d <= weekEnd;
    }).length;
    const weekBars = aggregateByDay(sessions, 7);
    const weekMax = Math.max(...weekBars.map((b) => b.totalMinutes), 1);

    // Tasks / notes / routine rate
    const tasks = nodes.filter((n) => n.type === "task");
    const completedTasks = tasks.filter((n) => n.status === "DONE").length;
    const todayEventsCompleted = todayItems.filter((i) => i.completed).length;
    const activeNotes = notes.filter((n) => !n.isDeleted && n.type === "note");
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = formatDateKey(weekAgo);
    const notesThisWeek = activeNotes.filter(
      (n) => n.createdAt.substring(0, 10) >= weekAgoStr,
    ).length;

    const rangeItems = scheduleItems.filter((i) => !i.isDeleted);
    const routineItems = rangeItems.filter((i) => i.routineId);
    const routineCompleted = routineItems.filter((i) => i.completed).length;
    const routineRate =
      routineItems.length > 0
        ? Math.round((routineCompleted / routineItems.length) * 100)
        : 0;

    const topRoutines = aggregateRoutineCompletion(rangeItems, routines)
      .slice()
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3);

    return {
      todayWorkMinutes,
      pomodoroCount,
      completedToday,
      streak,
      weekMinutes,
      weekCompleted,
      weekBars,
      weekMax,
      totalTasks: tasks.length,
      completedTasks,
      todayEvents: todayItems.length,
      todayEventsCompleted,
      totalNotes: activeNotes.length,
      notesThisWeek,
      routineRate,
      topRoutines,
    };
  }, [sessions, nodes, todayItems, scheduleItems, notes, routines]);

  if (props.loading) {
    return <MobileSkeleton title={labels.title} />;
  }

  if (isEmpty(props)) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-shrink-0 px-4 pb-1 pt-2">
          <h2 className="text-xl font-semibold text-lumen-text">
            {labels.title}
          </h2>
        </div>
        <EmptyState
          icon={<BarChart3 size={26} />}
          title={labels.emptyMobile.title}
          description={labels.emptyMobile.description}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex-shrink-0 px-4 pb-1 pt-2">
        <h2 className="text-xl font-semibold text-lumen-text">
          {labels.title}
        </h2>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
        {/* Today (highlighted accent card) */}
        <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-accent bg-lumen-accent-subtle p-4">
          <span className="text-sm font-semibold text-lumen-accent">
            {labels.todayCard.title}
          </span>
          <div className="grid grid-cols-3 gap-2">
            <MiniCol
              value={labels.formatHours(model.todayWorkMinutes)}
              label={labels.todayCard.workTime}
            />
            <MiniCol
              value={String(model.completedToday)}
              label={labels.todayCard.completedTasks}
            />
            <MiniCol
              value={String(model.pomodoroCount)}
              label={labels.todayCard.pomodoroCount}
            />
          </div>
        </div>

        {/* Streak */}
        <div className="grid grid-cols-2 gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-progress-bg text-lumen-chip-progress-fg">
              <Flame size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold tabular-nums text-lumen-text">
                {model.streak.currentStreak}
              </p>
              <p className="text-xs text-lumen-text-secondary">
                {labels.streak.current}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-lumen-border pl-3">
            <span className="grid h-[34px] w-[34px] flex-shrink-0 place-items-center rounded-lumen-md bg-lumen-chip-mint-bg text-lumen-chip-mint-fg">
              <Trophy size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold tabular-nums text-lumen-text">
                {model.streak.longestStreak}
              </p>
              <p className="text-xs text-lumen-text-secondary">
                {labels.streak.longest}
              </p>
            </div>
          </div>
        </div>

        {/* This week + mini bars */}
        <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-lumen-text">
              {labels.mobile.weekTitle}
            </span>
            <span className="text-xs text-lumen-text-tertiary">
              {labels.weekly.workTimeLabel}{" "}
              {labels.formatHours(model.weekMinutes)} ·{" "}
              {labels.weekly.completedLabel} {model.weekCompleted}
            </span>
          </div>
          <div className="flex h-20 items-end gap-2">
            {model.weekBars.map((b) => {
              const isMax = b.totalMinutes === model.weekMax;
              const dowKey =
                DOW_KEYS[new Date(b.date + "T00:00:00").getDay()] ?? "mon";
              return (
                <div
                  key={b.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  {isMax && b.totalMinutes > 0 && (
                    <span className="text-[9px] tabular-nums text-lumen-text-secondary">
                      {(b.totalMinutes / 60).toFixed(1)}h
                    </span>
                  )}
                  <div
                    className="w-full rounded-t-sm bg-lumen-accent"
                    style={{
                      height: `${Math.max(
                        4,
                        (b.totalMinutes / model.weekMax) * 56,
                      )}px`,
                    }}
                  />
                  <span className="text-[10px] text-lumen-text-tertiary">
                    {labels.heatmap.days[dowKey]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat 2×2 */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            value={model.totalTasks}
            label={labels.overview.tasks}
            subtitle={`${model.completedTasks} ${labels.overview.completed}`}
          />
          <StatBox
            value={model.todayEvents}
            label={labels.overview.events}
            subtitle={`${model.todayEventsCompleted} ${labels.overview.completed}`}
          />
          <StatBox
            value={`${model.routineRate}%`}
            label={labels.mobile.routineTitle}
            valueClassName="text-lumen-accent-secondary"
          />
          <StatBox
            value={model.totalNotes}
            label={labels.overview.notes}
            subtitle={`+${model.notesThisWeek} ${labels.overview.thisWeek}`}
          />
        </div>

        {/* Routine top 3 */}
        {model.topRoutines.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-lumen-text">
                {labels.mobile.routineTitle}
              </span>
              <span className="text-xs text-lumen-text-tertiary">
                {labels.mobile.top3}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {model.topRoutines.map((r) => (
                <div
                  key={r.routineId}
                  className="grid grid-cols-[96px_1fr_40px] items-center gap-2.5"
                >
                  <span className="truncate text-xs text-lumen-text">
                    {r.routineTitle}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-lumen-surface-sunken">
                    <span
                      className="block h-full bg-lumen-accent-secondary"
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums text-lumen-text">
                    {r.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCol({
  value,
  label,
}: {
  value: string;
  label: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg font-semibold tabular-nums text-lumen-text">
        {value}
      </span>
      <span className="text-xs text-lumen-accent">{label}</span>
    </div>
  );
}

function StatBox({
  value,
  label,
  subtitle,
  valueClassName,
}: {
  value: string | number;
  label: string;
  subtitle?: string;
  valueClassName?: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary p-3">
      <span
        className={`text-lg font-semibold tabular-nums ${
          valueClassName ?? "text-lumen-text"
        }`}
      >
        {value}
      </span>
      <span className="text-xs text-lumen-text-secondary">{label}</span>
      {subtitle && (
        <span className="text-xs text-lumen-text-tertiary">{subtitle}</span>
      )}
    </div>
  );
}

function MobileSkeleton({ title }: { title: string }): React.JSX.Element {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="flex-shrink-0 px-4 pb-1 pt-2">
        <h2 className="text-xl font-semibold text-lumen-text">{title}</h2>
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
        <div className="h-24 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="h-20 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="h-32 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lumen-lg border border-lumen-border bg-lumen-bg-secondary"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
