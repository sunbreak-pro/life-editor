import { useState } from "react";
import {
  Check,
  Circle,
  Flame,
  Play,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode, RoutineStack } from "../../types/routine";

interface RoutineSetStepperProps {
  stack: RoutineStack;
  routines: RoutineNode[];
  todayKey: string;
  logSet: Map<string, Set<string>>;
  statsMap: Map<string, number>;
  onToggle: (routineId: string) => void;
  onDelete: () => void;
  onStartTimer?: (routineId: string, title: string) => void;
}

export function RoutineSetStepper({
  stack,
  routines,
  todayKey,
  logSet,
  statsMap,
  onToggle,
  onDelete,
  onStartTimer,
}: RoutineSetStepperProps) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const stackRoutines = stack.items
    .map((item) => routines.find((r) => r.id === item.routineId))
    .filter(Boolean) as RoutineNode[];

  const completed = stackRoutines.filter(
    (r) => logSet.get(r.id)?.has(todayKey) ?? false,
  ).length;
  const total = stackRoutines.length;

  const nextRoutine = stackRoutines.find(
    (r) => !(logSet.get(r.id)?.has(todayKey) ?? false),
  );

  if (total === 0) return null;

  return (
    <div className="border border-notion-border rounded-lg bg-notion-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-notion-border/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-notion-text">
            {stack.name}
          </span>
          <span className="text-xs text-notion-text-secondary bg-notion-bg-secondary px-1.5 py-0.5 rounded">
            {completed}/{total}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-notion-hover text-notion-text-secondary transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-notion-bg border border-notion-border rounded-lg shadow-lg py-1">
                <button
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-notion-hover transition-colors flex items-center gap-2"
                >
                  <Trash2 size={12} />
                  {t("routine.delete")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="px-4 py-4">
        <div className="flex items-center overflow-x-auto pb-2 scrollbar-thin">
          {stackRoutines.map((routine, i) => {
            const isDone = logSet.get(routine.id)?.has(todayKey) ?? false;
            const isNext = routine.id === nextRoutine?.id;
            const streak = statsMap.get(routine.id) ?? 0;

            return (
              <div key={routine.id} className="flex items-center shrink-0">
                {/* Step card */}
                <button
                  onClick={() => onToggle(routine.id)}
                  className={`w-20 h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all relative ${
                    isDone
                      ? "bg-green-500/10 border-green-500/30"
                      : isNext
                        ? "bg-notion-accent/10 border-notion-accent/40"
                        : "bg-notion-bg-secondary border-notion-border"
                  }`}
                >
                  {/* Status icon */}
                  <div className="absolute top-1.5 right-1.5">
                    {isDone ? (
                      <Check
                        size={12}
                        className="text-green-600"
                        strokeWidth={3}
                      />
                    ) : isNext ? (
                      <Circle
                        size={10}
                        className="text-notion-accent"
                        fill="currentColor"
                      />
                    ) : (
                      <Circle
                        size={10}
                        className="text-notion-text-secondary/40"
                      />
                    )}
                  </div>

                  {/* Title */}
                  <span
                    className={`text-xs text-center leading-tight line-clamp-2 px-1 ${
                      isDone
                        ? "text-green-600"
                        : isNext
                          ? "text-notion-accent"
                          : "text-notion-text-secondary"
                    }`}
                  >
                    {routine.title}
                  </span>

                  {/* Streak */}
                  {streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                      <Flame size={10} />
                      {streak}
                    </span>
                  )}
                </button>

                {/* Arrow connector */}
                {i < stackRoutines.length - 1 && (
                  <div className="flex items-center mx-1 shrink-0">
                    <div
                      className={`w-4 h-0.5 ${
                        isDone &&
                        (logSet.get(stackRoutines[i + 1]?.id)?.has(todayKey) ??
                          false)
                          ? "bg-green-500/30"
                          : "bg-notion-border"
                      }`}
                    />
                    <div
                      className={`w-0 h-0 border-t-[3px] border-b-[3px] border-l-[4px] border-t-transparent border-b-transparent ${
                        isDone &&
                        (logSet.get(stackRoutines[i + 1]?.id)?.has(todayKey) ??
                          false)
                          ? "border-l-green-500/30"
                          : "border-l-notion-border"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Start next button */}
        {nextRoutine && onStartTimer && (
          <div className="flex justify-end mt-3">
            <button
              onClick={() => onStartTimer(nextRoutine.id, nextRoutine.title)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-notion-accent bg-notion-accent/10 hover:bg-notion-accent/20 rounded-lg transition-colors"
            >
              <Play size={11} fill="currentColor" />
              {t("routine.startRoutine", { title: nextRoutine.title })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
