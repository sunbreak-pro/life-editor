import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineGroup } from "../../../../types/routineGroup";
import { TimeSettingsInline } from "../../../shared/TaskSchedulePanel/TimeSettingsInline";

interface RoutinePickerPanelProps {
  position: { x: number; y: number };
  defaultStartTime: string;
  defaultEndTime: string;
  routines: RoutineNode[];
  routineGroups: RoutineGroup[];
  routinesByGroup: Map<string, RoutineNode[]>;
  onSelectRoutine: (
    routine: RoutineNode,
    startTime: string,
    endTime: string,
  ) => void;
  onSelectGroup: (
    group: RoutineGroup,
    routines: RoutineNode[],
    startTime: string,
    endTime: string,
  ) => void;
  onClose: () => void;
}

export function RoutinePickerPanel({
  position,
  defaultStartTime,
  defaultEndTime,
  routines,
  routineGroups,
  routinesByGroup,
  onSelectRoutine,
  onSelectGroup,
  onClose,
}: RoutinePickerPanelProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);

  const activeRoutines = useMemo(
    () => routines.filter((r) => !r.isArchived && !r.isDeleted),
    [routines],
  );

  const filteredRoutines = useMemo(() => {
    if (!search) return activeRoutines;
    const q = search.toLowerCase();
    return activeRoutines.filter((r) => r.title.toLowerCase().includes(q));
  }, [activeRoutines, search]);

  const handleSelect = useCallback(
    (routine: RoutineNode) => {
      const st = routine.startTime ?? startTime;
      const et = routine.endTime ?? endTime;
      onSelectRoutine(routine, st, et);
    },
    [startTime, endTime, onSelectRoutine],
  );

  const handleGroupSelect = useCallback(
    (group: RoutineGroup) => {
      const members = routinesByGroup.get(group.id) ?? [];
      onSelectGroup(group, members, startTime, endTime);
    },
    [startTime, endTime, routinesByGroup, onSelectGroup],
  );

  // Position
  const panelWidth = 320;
  const panelHeight = 400;
  const left = Math.min(position.x, window.innerWidth - panelWidth - 8);
  const top = Math.min(position.y, window.innerHeight - panelHeight - 8);

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute bg-notion-bg border border-notion-border rounded-lg shadow-xl flex flex-col"
        style={{ top, left, width: panelWidth, maxHeight: panelHeight }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border">
          <span className="text-sm font-medium text-notion-text">
            {t("dayFlow.selectRoutine", "Select Routine")}
          </span>
          <button
            onClick={onClose}
            className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-notion-border">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-notion-bg-secondary border border-notion-border rounded">
            <Search size={12} className="text-notion-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("schedule.searchRoutines", "Search...")}
              className="flex-1 text-sm bg-transparent focus:outline-none text-notion-text"
              autoFocus
            />
          </div>
        </div>

        {/* Time settings */}
        <div className="px-3 py-2 border-b border-notion-border">
          <TimeSettingsInline
            startTime={startTime}
            endTime={endTime}
            isAllDay={isAllDay}
            hasEndTime={hasEndTime}
            onStartTimeChange={setStartTime}
            onEndTimeChange={setEndTime}
            onIsAllDayChange={setIsAllDay}
            onHasEndTimeChange={setHasEndTime}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Groups */}
          {routineGroups.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-1">
                {t("routineGroup.groups", "Groups")}
              </span>
              <div className="mt-1 space-y-0.5">
                {routineGroups.map((group) => {
                  const count = (routinesByGroup.get(group.id) ?? []).length;
                  return (
                    <button
                      key={group.id}
                      onClick={() => handleGroupSelect(group)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <span className="flex-1 truncate">{group.name}</span>
                      <span className="text-[11px] text-notion-text-secondary">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual routines */}
          <div>
            <span className="text-[10px] text-notion-text-secondary uppercase tracking-wide font-medium px-1">
              {t("schedule.routines", "Routines")}
            </span>
            <div className="mt-1 space-y-0.5">
              {filteredRoutines.map((routine) => (
                <button
                  key={routine.id}
                  onClick={() => handleSelect(routine)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-notion-hover text-notion-text transition-colors"
                >
                  <span className="flex-1 truncate">{routine.title}</span>
                  {routine.startTime && (
                    <span className="text-[11px] text-notion-text-secondary">
                      {routine.startTime}
                      {routine.endTime && ` - ${routine.endTime}`}
                    </span>
                  )}
                </button>
              ))}
              {filteredRoutines.length === 0 && (
                <p className="text-[11px] text-notion-text-secondary text-center py-2">
                  {t("schedule.noRoutines", "No routines")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
