import { Check, Flame, Play, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode, RoutineStack } from "../../types/routine";

interface RoutineStackCardProps {
  stack: RoutineStack;
  routines: RoutineNode[];
  todayKey: string;
  logSet: Map<string, Set<string>>;
  onToggle: (routineId: string) => void;
  onDelete: () => void;
  onStartTimer?: (routineId: string, title: string) => void;
}

export function RoutineStackCard({
  stack,
  routines,
  todayKey,
  logSet,
  onToggle,
  onDelete,
  onStartTimer,
}: RoutineStackCardProps) {
  const { t } = useTranslation();

  const stackRoutines = stack.items
    .map((item) => routines.find((r) => r.id === item.routineId))
    .filter(Boolean) as RoutineNode[];

  const completed = stackRoutines.filter(
    (r) => logSet.get(r.id)?.has(todayKey) ?? false,
  ).length;
  const total = stackRoutines.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  // Find the next uncompleted routine
  const nextRoutine = stackRoutines.find(
    (r) => !(logSet.get(r.id)?.has(todayKey) ?? false),
  );

  return (
    <div className="border border-notion-border rounded-lg p-3 bg-notion-bg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-orange-500" />
          <span className="text-sm font-medium text-notion-text">
            {stack.name}
          </span>
          <span className="text-xs text-notion-text-secondary">
            ({completed}/{total})
          </span>
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-notion-text-secondary hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-notion-bg-secondary rounded-full mb-2">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Routine list */}
      <div className="flex flex-wrap gap-1.5">
        {stackRoutines.map((routine, i) => {
          const isDone = logSet.get(routine.id)?.has(todayKey) ?? false;
          const isNext = routine.id === nextRoutine?.id;
          return (
            <button
              key={routine.id}
              onClick={() => !isDone && onToggle(routine.id)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                isDone
                  ? "bg-green-500/10 text-green-600 line-through"
                  : isNext
                    ? "bg-notion-accent/10 text-notion-accent border border-notion-accent/30"
                    : "bg-notion-bg-secondary text-notion-text-secondary"
              }`}
            >
              <span className="text-[10px] text-notion-text-secondary/50">
                {i + 1}.
              </span>
              {isDone && <Check size={10} />}
              {routine.title}
            </button>
          );
        })}
      </div>

      {/* Start next timer button */}
      {nextRoutine && onStartTimer && (
        <button
          onClick={() => onStartTimer(nextRoutine.id, nextRoutine.title)}
          className="mt-2 flex items-center gap-1.5 px-2.5 py-1 text-xs text-notion-accent hover:bg-notion-accent/10 rounded-md transition-colors"
        >
          <Play size={10} fill="currentColor" />
          {t("routine.startNext")}
        </button>
      )}
    </div>
  );
}
