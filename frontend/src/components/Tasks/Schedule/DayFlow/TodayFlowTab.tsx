import { useMemo } from "react";
import { Check, Circle, Clock } from "lucide-react";
import type { ScheduleItem } from "../../../../types/schedule";

interface TodayFlowTabProps {
  items: ScheduleItem[];
  onToggleComplete: (id: string) => void;
}

export function TodayFlowTab({ items, onToggleComplete }: TodayFlowTabProps) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [items],
  );

  const nextIndex = useMemo(() => {
    return sorted.findIndex((item) => !item.completed);
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-notion-text-secondary">
        <Clock size={32} className="mb-2 opacity-50" />
        <p className="text-xs">No schedule items for today</p>
      </div>
    );
  }

  const completedCount = sorted.filter((i) => i.completed).length;

  return (
    <div className="px-3 py-2">
      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-notion-text-secondary mb-1">
          <span>Progress</span>
          <span>
            {completedCount}/{sorted.length}
          </span>
        </div>
        <div className="h-1.5 bg-notion-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-notion-accent rounded-full transition-all"
            style={{
              width: `${(completedCount / sorted.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Flow list */}
      <div className="space-y-0">
        {sorted.map((item, i) => {
          const isNext = i === nextIndex;
          const isLast = i === sorted.length - 1;

          return (
            <div key={item.id} className="flex gap-2">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <button
                  onClick={() => onToggleComplete(item.id)}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    item.completed
                      ? "bg-green-500 border-green-500"
                      : isNext
                        ? "border-notion-accent bg-notion-accent/10"
                        : "border-notion-border"
                  }`}
                >
                  {item.completed ? (
                    <Check size={10} className="text-white" />
                  ) : isNext ? (
                    <Circle
                      size={6}
                      className="text-notion-accent fill-notion-accent"
                    />
                  ) : null}
                </button>
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-6 ${
                      item.completed ? "bg-green-500/30" : "bg-notion-border"
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={`flex-1 pb-3 ${item.completed ? "opacity-40" : ""}`}
              >
                <div
                  className={`text-xs font-medium ${
                    item.completed
                      ? "line-through text-notion-text-secondary"
                      : isNext
                        ? "text-notion-accent"
                        : "text-notion-text"
                  }`}
                >
                  {item.title}
                </div>
                <div className="text-[10px] text-notion-text-secondary">
                  {item.startTime} - {item.endTime}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
