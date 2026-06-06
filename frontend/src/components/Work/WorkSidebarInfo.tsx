import { useEffect, useState } from "react";
import { Timer, Target, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTimerContext } from "../../hooks/useTimerContext";
import { getDataService } from "../../services";

export function WorkSidebarInfo() {
  const { t } = useTranslation();
  const timer = useTimerContext();

  // Today's sessions
  const [todaySummary, setTodaySummary] = useState({
    sessions: 0,
    totalMinutes: 0,
  });

  useEffect(() => {
    let cancelled = false;
    getDataService()
      .fetchTimerSessions()
      .then((sessions) => {
        if (cancelled) return;
        const todayStr = new Date().toISOString().substring(0, 10);
        const todaySessions = sessions.filter(
          (s) =>
            s.sessionType === "WORK" &&
            s.completed &&
            s.startedAt &&
            String(s.startedAt).substring(0, 10) === todayStr,
        );
        const totalMinutes = todaySessions.reduce(
          (acc, s) => acc + (s.duration ?? 0),
          0,
        );
        setTodaySummary({
          sessions: todaySessions.length,
          totalMinutes: Math.round(totalMinutes / 60),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [timer.completedSessions]);

  // Work time calculations
  const goalMinutes = timer.targetSessions * timer.workDurationMinutes;
  const sessionPercent = Math.min(
    100,
    (todaySummary.sessions / timer.targetSessions) * 100,
  );

  return (
    <div className="p-3 space-y-4">
      {/* Section 1: Pomodoro Settings (inline editable) */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 font-semibold text-notion-text-secondary text-scaling-xs uppercase tracking-wider px-1 opacity-80">
          <Timer size={14} className="opacity-70" />
          {t("work.sidebar.pomodoroSettings")}
        </h4>
        <div className="space-y-1.5 bg-notion-hover/30 rounded-lg p-2.5">
          <div className="flex justify-between items-center text-scaling-sm px-1">
            <span className="text-notion-text-secondary">Work</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  timer.setWorkDurationMinutes(timer.workDurationMinutes - 5)
                }
                disabled={timer.isRunning || timer.workDurationMinutes <= 5}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="text-notion-text font-medium min-w-[2.5rem] text-center">
                {timer.workDurationMinutes}m
              </span>
              <button
                onClick={() =>
                  timer.setWorkDurationMinutes(timer.workDurationMinutes + 5)
                }
                disabled={timer.isRunning || timer.workDurationMinutes >= 240}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center text-scaling-sm px-1">
            <span className="text-notion-text-secondary">Break</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  timer.setBreakDurationMinutes(timer.breakDurationMinutes - 5)
                }
                disabled={timer.isRunning || timer.breakDurationMinutes <= 5}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="text-notion-text font-medium min-w-[2.5rem] text-center">
                {timer.breakDurationMinutes}m
              </span>
              <button
                onClick={() =>
                  timer.setBreakDurationMinutes(timer.breakDurationMinutes + 5)
                }
                disabled={timer.isRunning || timer.breakDurationMinutes >= 60}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center text-scaling-sm px-1">
            <span className="text-notion-text-secondary">Long Break</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  timer.setLongBreakDurationMinutes(
                    timer.longBreakDurationMinutes - 5,
                  )
                }
                disabled={
                  timer.isRunning || timer.longBreakDurationMinutes <= 5
                }
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="text-notion-text font-medium min-w-[2.5rem] text-center">
                {timer.longBreakDurationMinutes}m
              </span>
              <button
                onClick={() =>
                  timer.setLongBreakDurationMinutes(
                    timer.longBreakDurationMinutes + 5,
                  )
                }
                disabled={
                  timer.isRunning || timer.longBreakDurationMinutes >= 120
                }
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-notion-border" />

      {/* Section 2: Work Time */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 font-semibold text-notion-text-secondary text-scaling-xs uppercase tracking-wider px-1 opacity-80">
          <Target size={14} className="opacity-70" />
          {t("work.sidebar.workTime")}
        </h4>
        <div className="space-y-2.5 bg-notion-hover/30 rounded-lg p-2.5">
          {/* Target sessions */}
          <div className="flex justify-between items-center text-scaling-sm px-1">
            <span className="text-notion-text-secondary">
              {t("work.sidebar.targetSessions")}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  timer.setTargetSessions(timer.targetSessions - 1)
                }
                disabled={timer.targetSessions <= 1}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Minus size={12} />
              </button>
              <span className="text-notion-text font-medium min-w-[1.5rem] text-center">
                {timer.targetSessions}
              </span>
              <button
                onClick={() =>
                  timer.setTargetSessions(timer.targetSessions + 1)
                }
                disabled={timer.targetSessions >= 20}
                className="p-0.5 text-notion-text-secondary hover:text-notion-text disabled:opacity-30 rounded transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Goal time (auto-calculated) */}
          <div className="flex justify-between items-center text-scaling-sm px-1">
            <span className="text-notion-text-secondary">
              {t("work.sidebar.goalTime")}
            </span>
            <span className="text-notion-text font-medium">{goalMinutes}m</span>
          </div>

          {/* Progress */}
          <div className="space-y-1 px-1">
            <div className="flex justify-between items-center text-scaling-xs">
              <span className="text-notion-text-secondary">
                {t("work.sidebar.sessionsProgress", {
                  completed: todaySummary.sessions,
                  target: timer.targetSessions,
                })}
              </span>
              <span className="text-notion-text-secondary">
                {t("work.sidebar.timeProgress", {
                  actual: todaySummary.totalMinutes,
                  goal: goalMinutes,
                })}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-notion-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-notion-accent rounded-full transition-all duration-300"
                style={{ width: `${sessionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
