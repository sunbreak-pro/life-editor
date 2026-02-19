import { useState, useMemo, useRef, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Filter,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import type { ScheduleItem } from "../../../../types/schedule";

interface RoutineFlowProps {
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  tagAssignments: Map<string, number[]>;
  routineTags: RoutineTag[];
  filterTagIds: number[];
  onFilterChange: (tagIds: number[]) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleComplete: (id: string) => void;
}

interface FlowStep {
  routineId: string;
  scheduleItemId: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
  completed: boolean;
}

export function RoutineFlow({
  routines,
  scheduleItems,
  tagAssignments,
  routineTags,
  filterTagIds,
  onFilterChange,
  isFullscreen,
  onToggleFullscreen,
  onToggleComplete,
}: RoutineFlowProps) {
  const { t } = useTranslation();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  const closeFilter = useCallback(() => {
    setShowFilterDropdown(false);
    setFilterSearch("");
  }, []);
  useClickOutside(filterRef, closeFilter, showFilterDropdown);

  const scheduleItemByRoutineId = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    for (const item of scheduleItems) {
      if (item.routineId) {
        map.set(item.routineId, item);
      }
    }
    return map;
  }, [scheduleItems]);

  // Build steps for a given set of routines
  const buildSteps = useCallback(
    (routineList: RoutineNode[]): FlowStep[] => {
      return routineList
        .map((routine) => {
          const scheduleItem = scheduleItemByRoutineId.get(routine.id);
          return {
            routineId: routine.id,
            scheduleItemId: scheduleItem?.id ?? null,
            title: routine.title,
            startTime: routine.startTime,
            endTime: routine.endTime,
            completed: scheduleItem?.completed ?? false,
          };
        })
        .sort((a, b) =>
          (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
        );
    },
    [scheduleItemByRoutineId],
  );

  // Tagged routines (those with at least 1 tag)
  const taggedRoutines = useMemo(
    () =>
      routines.filter((r) => {
        const tags = tagAssignments.get(r.id);
        return tags && tags.length > 0 && !r.isArchived;
      }),
    [routines, tagAssignments],
  );

  // Build columns based on filterTagIds
  const columns = useMemo(() => {
    if (filterTagIds.length === 0) {
      // Single column with all tagged routines
      return [
        {
          tag: null as RoutineTag | null,
          steps: buildSteps(taggedRoutines),
        },
      ];
    }
    return filterTagIds
      .map((tagId) => {
        const tag = routineTags.find((t) => t.id === tagId);
        if (!tag) return null;
        const columnRoutines = taggedRoutines.filter((r) => {
          const rTagIds = tagAssignments.get(r.id) ?? [];
          return rTagIds.includes(tagId);
        });
        return { tag, steps: buildSteps(columnRoutines) };
      })
      .filter(Boolean) as Array<{
      tag: RoutineTag | null;
      steps: FlowStep[];
    }>;
  }, [filterTagIds, taggedRoutines, routineTags, tagAssignments, buildSteps]);

  const totalSteps = columns.reduce((sum, c) => sum + c.steps.length, 0);
  const completedSteps = columns.reduce(
    (sum, c) => sum + c.steps.filter((s) => s.completed).length,
    0,
  );
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const filteredTags = routineTags.filter((tag) =>
    filterSearch
      ? tag.name.toLowerCase().includes(filterSearch.toLowerCase())
      : true,
  );

  const toggleFilterTag = (tagId: number) => {
    if (filterTagIds.includes(tagId)) {
      onFilterChange(filterTagIds.filter((id) => id !== tagId));
    } else {
      onFilterChange([...filterTagIds, tagId]);
    }
  };

  const renderSteps = (steps: FlowStep[]) => (
    <div className="ml-[5px]">
      {steps.map((step, i) => (
        <button
          key={step.routineId}
          onClick={() => {
            if (step.scheduleItemId) {
              onToggleComplete(step.scheduleItemId);
            }
          }}
          disabled={!step.scheduleItemId}
          className={`flex text-left w-full ${
            step.scheduleItemId ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {/* Vertical line + icon */}
          <div className="flex flex-col items-center mr-2.5">
            <div className="flex-shrink-0 transition-colors">
              {step.completed ? (
                <CheckCircle2 size={18} className="text-green-500" />
              ) : (
                <Circle size={18} className="text-notion-text-secondary" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="w-px flex-1 min-h-[20px] bg-notion-border" />
            )}
          </div>

          {/* Step content */}
          <div className="pb-4 min-w-0">
            <div
              className={`text-sm truncate ${
                step.completed
                  ? "text-notion-text-secondary line-through"
                  : "text-notion-text"
              }`}
            >
              {step.startTime && (
                <span className="text-xs text-notion-text-secondary mr-1.5">
                  {step.startTime}
                </span>
              )}
              {step.title}
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="border border-notion-border rounded-lg p-3 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-notion-text">
          {t("schedule.routineFlow", "Routine Flow")}
        </span>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`p-1 rounded transition-colors ${
              filterTagIds.length > 0
                ? "text-notion-accent bg-notion-accent/10"
                : "text-notion-text-secondary hover:text-notion-text"
            }`}
            title={t("schedule.filterTags", "Filter by tags")}
          >
            <Filter size={14} />
          </button>

          {showFilterDropdown && (
            <div className="absolute z-50 mt-1 left-0 w-48 bg-notion-bg border border-notion-border rounded-lg shadow-lg">
              <div className="p-2">
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder={t("schedule.searchTags", "Search tags...")}
                  className="w-full text-sm px-2 py-1 rounded bg-notion-hover text-notion-text border-none outline-none mb-1"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-auto p-1">
                {filteredTags.map((tag) => {
                  const isSelected = filterTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleFilterTag(tag.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                        isSelected
                          ? "bg-notion-accent/10"
                          : "hover:bg-notion-hover"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-notion-text truncate">
                        {tag.name}
                      </span>
                      {isSelected && (
                        <span className="ml-auto text-notion-accent text-[11px]">
                          &#10003;
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredTags.length === 0 && (
                  <p className="text-[11px] text-notion-text-secondary p-2">
                    No tags found.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Filter badges */}
        {filterTagIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {filterTagIds.map((tagId) => {
              const tag = routineTags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0 text-[10px] rounded-full text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>
        )}

        <div className="ml-auto">
          <button
            onClick={onToggleFullscreen}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
            title={
              isFullscreen
                ? t("schedule.exitFullscreen", "Exit fullscreen")
                : t("schedule.fullscreen", "Fullscreen")
            }
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {totalSteps === 0 ? (
          <p className="text-[11px] text-notion-text-secondary py-2">
            {t("schedule.noTaggedRoutines", "No tagged routines for today.")}
          </p>
        ) : columns.length === 1 && !columns[0].tag ? (
          // Single column - no header
          renderSteps(columns[0].steps)
        ) : (
          // Multi-column grid
          <div
            className="grid gap-4 h-full"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
            }}
          >
            {columns.map((col) => (
              <div key={col.tag?.id ?? "all"} className="min-w-0">
                {col.tag && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: col.tag.color }}
                    />
                    <span className="text-xs font-medium text-notion-text">
                      {col.tag.name}
                    </span>
                  </div>
                )}
                {col.steps.length > 0 ? (
                  renderSteps(col.steps)
                ) : (
                  <p className="text-[11px] text-notion-text-secondary">
                    No routines.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <div className="mt-3 pt-3 border-t border-notion-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-notion-text-secondary">
              Progress: {completedSteps}/{totalSteps}
            </span>
            <span className="text-[11px] text-notion-text-secondary">
              {progressPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-notion-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
