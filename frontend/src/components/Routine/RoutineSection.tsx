import { useState, useMemo, useCallback } from "react";
import { Plus, BarChart3, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRoutineContext } from "../../hooks/useRoutineContext";
import { useTimerContext } from "../../hooks/useTimerContext";
import { RoutineItemCard } from "./RoutineItemCard";
import { RoutineCreateDialog } from "./RoutineCreateDialog";
import { RoutineStatsPanel } from "./RoutineStatsPanel";
import { RoutineSetStepper } from "./RoutineSetStepper";
import { RoutineStackDialog } from "./RoutineStackDialog";
import { TimeSlotSettingsDialog } from "./TimeSlotSettingsDialog";
import { MilestoneToast } from "./MilestoneToast";
import {
  loadTimeSlotConfig,
  saveTimeSlotConfig,
} from "./routineTimeSlotConfig";
import type { TimeSlotConfig } from "./routineTimeSlotConfig";
import type { RoutineNode, TimeSlot } from "../../types/routine";
import { getTodayKey } from "../../utils/dateKey";

type TabSlot = "morning" | "afternoon" | "evening";
const TAB_SLOTS: TabSlot[] = ["morning", "afternoon", "evening"];

const TAB_EMOJI: Record<TabSlot, string> = {
  morning: "\u{1F305}",
  afternoon: "\u2600\uFE0F",
  evening: "\u{1F319}",
};

function normalizeTimeSlot(slot: TimeSlot): TabSlot {
  if (slot === "anytime") return "morning";
  return slot;
}

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
  const [showTimeSlotSettings, setShowTimeSlotSettings] = useState(false);
  const [timeSlotConfig, setTimeSlotConfig] =
    useState<TimeSlotConfig>(loadTimeSlotConfig);
  const [activeTab, setActiveTab] = useState<TabSlot>("morning");
  const [milestoneInfo, setMilestoneInfo] = useState<{
    title: string;
    days: number;
  } | null>(null);

  const todayKey = getTodayKey();
  const today = new Date(todayKey + "T00:00:00");

  // Set of routine IDs that belong to a stack
  const stackRoutineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const stack of ctx.stacks) {
      for (const item of stack.items) {
        ids.add(item.routineId);
      }
    }
    return ids;
  }, [ctx.stacks]);

  // Filter routines by active tab (with anytime -> morning fallback)
  const tabRoutines = useMemo(() => {
    return ctx.routines.filter(
      (r) => normalizeTimeSlot(r.timeSlot) === activeTab,
    );
  }, [ctx.routines, activeTab]);

  // Stacks that have at least one routine in the active tab
  const tabStacks = useMemo(() => {
    return ctx.stacks.filter((stack) =>
      stack.items.some((item) => {
        const routine = ctx.routines.find((r) => r.id === item.routineId);
        return routine && normalizeTimeSlot(routine.timeSlot) === activeTab;
      }),
    );
  }, [ctx.stacks, ctx.routines, activeTab]);

  // Standalone routines (not in any stack) in the active tab
  const standaloneRoutines = useMemo(() => {
    return tabRoutines.filter((r) => !stackRoutineIds.has(r.id));
  }, [tabRoutines, stackRoutineIds]);

  // Today's progress (all routines)
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

  // Streak map for stepper display
  const statsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of ctx.routines) {
      const stats = ctx.getStatsForRoutine(r);
      map.set(r.id, stats.currentStreak);
    }
    return map;
  }, [ctx.routines, ctx]);

  const handleSaveTimeSlotConfig = useCallback((config: TimeSlotConfig) => {
    saveTimeSlotConfig(config);
    setTimeSlotConfig(config);
  }, []);

  const hasRoutines = ctx.routines.length > 0;

  const formatTimeRange = (slot: TabSlot): string => {
    const cfg = timeSlotConfig[slot];
    return `${cfg.start}\u2013${cfg.end}`;
  };

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
            <>
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
              <button
                onClick={() => setShowTimeSlotSettings(true)}
                className="p-1.5 rounded-md text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
                title={t("routine.timeSlotSettings")}
              >
                <Settings size={16} />
              </button>
            </>
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

      {/* Tab Bar */}
      {hasRoutines && !showStats && (
        <div className="flex border-b border-notion-border shrink-0">
          {TAB_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => setActiveTab(slot)}
              className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === slot
                  ? "text-notion-accent"
                  : "text-notion-text-secondary hover:text-notion-text"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span>{TAB_EMOJI[slot]}</span>
                <span>{t(`routine.timeSlot.${slot}`)}</span>
                <span className="text-notion-text-secondary/60">
                  {formatTimeRange(slot)}
                </span>
              </span>
              {activeTab === slot && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-notion-accent rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showStats && hasRoutines ? (
          <RoutineStatsPanel />
        ) : !hasRoutines ? (
          <div className="flex items-center justify-center h-40 text-sm text-notion-text-secondary">
            {t("routine.noRoutines")}
          </div>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {/* Routine Sets (Steppers) */}
            {tabStacks.map((stack) => (
              <RoutineSetStepper
                key={stack.id}
                stack={stack}
                routines={ctx.routines}
                todayKey={todayKey}
                logSet={logSet}
                statsMap={statsMap}
                onToggle={handleToggleToday}
                onDelete={() => ctx.deleteStack(stack.id)}
                onStartTimer={handleStartTimer}
              />
            ))}

            {/* Standalone Routines */}
            {standaloneRoutines.length > 0 && (
              <div>
                {tabStacks.length > 0 && (
                  <h3 className="text-xs font-medium text-notion-text-secondary uppercase tracking-wider mb-2 px-1">
                    {t("routine.standalone")}
                  </h3>
                )}
                <div className="space-y-1">
                  {standaloneRoutines.map((routine) => {
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
            )}

            {/* Empty tab state */}
            {tabStacks.length === 0 && standaloneRoutines.length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-notion-text-secondary">
                {t("routine.noRoutinesInSlot")}
              </div>
            )}

            {/* Create Stack button */}
            {ctx.routines.length >= 2 && (
              <button
                onClick={() => setShowStackDialog(true)}
                className="w-full py-2 text-xs text-notion-text-secondary hover:text-notion-text border border-dashed border-notion-border rounded-lg hover:bg-notion-hover/50 transition-colors"
              >
                + {t("routine.createSet")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreateDialog && (
        <RoutineCreateDialog
          stacks={ctx.stacks}
          onSubmit={(data) => {
            const id = ctx.createRoutine(
              data.title,
              data.frequencyType,
              data.frequencyDays,
              data.timesPerWeek,
              data.timeSlot,
              data.soundPresetId,
            );
            if (data.stackId && id) {
              ctx.addStackItem(data.stackId, id);
            }
            setShowCreateDialog(false);
          }}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
      {editTarget && (
        <RoutineCreateDialog
          stacks={ctx.stacks}
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
      {showTimeSlotSettings && (
        <TimeSlotSettingsDialog
          config={timeSlotConfig}
          onSave={handleSaveTimeSlotConfig}
          onClose={() => setShowTimeSlotSettings(false)}
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
