import { useState, useMemo, useCallback } from "react";
import { Plus, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { useTimerContext } from "../../hooks/useTimerContext";
import { RoutineItemCard } from "./RoutineItemCard";
import { RoutineCreateDialog } from "./RoutineCreateDialog";
import { RoutineStatsPanel } from "./RoutineStatsPanel";
import { RoutineStackCard } from "./RoutineStackCard";
import { RoutineStackDialog } from "./RoutineStackDialog";
import { MilestoneToast } from "./MilestoneToast";
import type { RoutineNode, TimeSlot } from "../../types/routine";

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TIME_SLOT_ORDER: TimeSlot[] = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
];

function isDayApplicable(routine: RoutineNode, date: Date): boolean {
  if (routine.frequencyType === "daily") return true;
  if (routine.frequencyType === "custom") {
    return routine.frequencyDays.includes(date.getDay());
  }
  return true;
}

export function RoutineSection() {
  const { t } = useTranslation();
  const ctx = useRoutineContext();
  const timer = useTimerContext();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<RoutineNode | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showStackDialog, setShowStackDialog] = useState(false);
  const [milestoneInfo, setMilestoneInfo] = useState<{
    title: string;
    days: number;
  } | null>(null);

  const todayKey = getTodayKey();
  const today = new Date(todayKey + "T00:00:00");

  // Group routines by timeSlot
  const groupedRoutines = useMemo(() => {
    const groups = new Map<TimeSlot, RoutineNode[]>();
    for (const slot of TIME_SLOT_ORDER) {
      groups.set(slot, []);
    }
    for (const r of ctx.routines) {
      const slot = r.timeSlot || "anytime";
      groups.get(slot)!.push(r);
    }
    return groups;
  }, [ctx.routines]);

  // Today's progress
  const todayProgress = useMemo(() => {
    let completed = 0;
    let total = 0;
    for (const r of ctx.routines) {
      if (!isDayApplicable(r, today)) continue;
      total++;
      if (ctx.logs.some((l) => l.routineId === r.id && l.date === todayKey))
        completed++;
    }
    return { completed, total };
  }, [ctx.routines, ctx.logs, todayKey, today]);

  const handleToggleToday = useCallback(
    (routineId: string) => {
      const wasToggledOn = ctx.toggleLog(routineId, todayKey);
      if (wasToggledOn) {
        const routine = ctx.routines.find((r) => r.id === routineId);
        if (routine) {
          const stats = ctx.getStatsForRoutine(routine);
          const newStreak = stats.currentStreak + 1;
          const milestones = [7, 30, 100, 365];
          for (const m of milestones) {
            if (newStreak === m) {
              setMilestoneInfo({ title: routine.title, days: m });
              setTimeout(() => setMilestoneInfo(null), 4000);
              break;
            }
          }
        }
      }
    },
    [ctx, todayKey],
  );

  const handleEditSubmit = useCallback(
    (data: {
      title: string;
      frequencyType: RoutineNode["frequencyType"];
      frequencyDays: number[];
      timesPerWeek?: number;
      timeSlot: TimeSlot;
      soundPresetId?: string;
    }) => {
      if (!editTarget) return;
      ctx.updateRoutine(editTarget.id, data);
      setEditTarget(null);
    },
    [editTarget, ctx],
  );

  const handleStartTimer = useCallback(
    (routineId: string, title: string) => {
      timer.startRoutineTimer(routineId, title);
    },
    [timer],
  );

  const logSet = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of ctx.logs) {
      let s = map.get(l.routineId);
      if (!s) {
        s = new Set();
        map.set(l.routineId, s);
      }
      s.add(l.date);
    }
    return map;
  }, [ctx.logs]);

  const hasRoutines = ctx.routines.length > 0;
  const nonEmptySlots = TIME_SLOT_ORDER.filter(
    (slot) => (groupedRoutines.get(slot)?.length ?? 0) > 0,
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-notion-border shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-notion-text">
            {t("routine.title")}
          </h2>
          {hasRoutines && (
            <span className="text-xs text-notion-text-secondary bg-notion-bg-secondary px-2 py-0.5 rounded-full">
              {todayProgress.completed}/{todayProgress.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasRoutines && (
            <button
              onClick={() => setShowStats(!showStats)}
              className={`p-1.5 rounded-md transition-colors ${
                showStats
                  ? "bg-notion-accent/10 text-notion-accent"
                  : "text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text"
              }`}
              title={t("routine.stats")}
            >
              <BarChart3 size={16} />
            </button>
          )}
          <button
            onClick={() => setShowCreateDialog(true)}
            className="p-1.5 rounded-md text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
            title={t("routine.addRoutine")}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showStats && hasRoutines ? (
          <RoutineStatsPanel />
        ) : !hasRoutines ? (
          <div className="flex items-center justify-center h-40 text-sm text-notion-text-secondary">
            {t("routine.noRoutines")}
          </div>
        ) : (
          <div className="px-4 py-3 space-y-5">
            {/* Today's routines grouped by time slot */}
            {nonEmptySlots.map((slot) => {
              const items = groupedRoutines.get(slot)!;
              return (
                <div key={slot}>
                  <h3 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wider mb-2 px-1">
                    {t(`routine.timeSlot.${slot}`)}
                  </h3>
                  <div className="space-y-1">
                    {items.map((routine) => {
                      const stats = ctx.getStatsForRoutine(routine);
                      const todayCompleted =
                        logSet.get(routine.id)?.has(todayKey) ?? false;
                      const todayApplicable = isDayApplicable(routine, today);
                      return (
                        <RoutineItemCard
                          key={routine.id}
                          routine={routine}
                          stats={stats}
                          todayCompleted={todayCompleted}
                          todayApplicable={todayApplicable}
                          onToggleToday={() => handleToggleToday(routine.id)}
                          onEdit={() => setEditTarget(routine)}
                          onDelete={() => ctx.deleteRoutine(routine.id)}
                          onStartTimer={() =>
                            handleStartTimer(routine.id, routine.title)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Habit Stacks */}
            {ctx.stacks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wider">
                    {t("routine.habitStacks")}
                  </h3>
                  <button
                    onClick={() => setShowStackDialog(true)}
                    className="text-xs text-notion-text-secondary hover:text-notion-text transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  {ctx.stacks.map((stack) => (
                    <RoutineStackCard
                      key={stack.id}
                      stack={stack}
                      routines={ctx.routines}
                      todayKey={todayKey}
                      logSet={logSet}
                      onToggle={handleToggleToday}
                      onDelete={() => ctx.deleteStack(stack.id)}
                      onStartTimer={handleStartTimer}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Add Stack button (when no stacks exist) */}
            {ctx.stacks.length === 0 && ctx.routines.length >= 2 && (
              <button
                onClick={() => setShowStackDialog(true)}
                className="w-full py-2 text-xs text-notion-text-secondary hover:text-notion-text border border-dashed border-notion-border rounded-lg hover:bg-notion-hover/50 transition-colors"
              >
                + {t("routine.createStack")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreateDialog && (
        <RoutineCreateDialog
          onSubmit={(data) => {
            ctx.createRoutine(
              data.title,
              data.frequencyType,
              data.frequencyDays,
              data.timesPerWeek,
              data.timeSlot,
              data.soundPresetId,
            );
            setShowCreateDialog(false);
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
      {editTarget && (
        <RoutineCreateDialog
          onSubmit={handleEditSubmit}
          onClose={() => setEditTarget(null)}
          initial={{
            title: editTarget.title,
            frequencyType: editTarget.frequencyType,
            frequencyDays: editTarget.frequencyDays,
            timesPerWeek: editTarget.timesPerWeek,
            timeSlot: editTarget.timeSlot,
            soundPresetId: editTarget.soundPresetId,
          }}
        />
      )}
      {showStackDialog && (
        <RoutineStackDialog
          routines={ctx.routines}
          onSubmit={(name, routineIds) => {
            const id = ctx.createStack(name);
            for (const rid of routineIds) {
              ctx.addStackItem(id, rid);
            }
            setShowStackDialog(false);
          }}
          onClose={() => setShowStackDialog(false)}
        />
      )}
      {milestoneInfo && (
        <MilestoneToast
          title={milestoneInfo.title}
          days={milestoneInfo.days}
          onDismiss={() => setMilestoneInfo(null)}
        />
      )}
    </div>
  );
}
