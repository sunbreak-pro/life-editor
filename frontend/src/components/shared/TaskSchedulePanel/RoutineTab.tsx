import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useConfirmableSubmit } from "../../../hooks/useConfirmableSubmit";
import { TimeSettingsInline } from "./TimeSettingsInline";
import type { RoutineNode } from "../../../types/routine";
import type { RoutineGroup } from "../../../types/routineGroup";

interface RoutineTabProps {
  defaultStartTime: string;
  defaultEndTime: string;
  useExisting: boolean;
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
  onCreateRoutine?: (title: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}

export function RoutineTab({
  defaultStartTime,
  defaultEndTime,
  useExisting,
  routines,
  routineGroups,
  routinesByGroup,
  onSelectRoutine,
  onSelectGroup,
  onCreateRoutine,
  onClose,
}: RoutineTabProps) {
  if (useExisting) {
    return (
      <ExistingRoutineContent
        defaultStartTime={defaultStartTime}
        defaultEndTime={defaultEndTime}
        routines={routines}
        routineGroups={routineGroups}
        routinesByGroup={routinesByGroup}
        onSelectRoutine={onSelectRoutine}
        onSelectGroup={onSelectGroup}
      />
    );
  }

  return (
    <NewRoutineContent
      defaultStartTime={defaultStartTime}
      defaultEndTime={defaultEndTime}
      onCreateRoutine={onCreateRoutine}
      onClose={onClose}
    />
  );
}

function ExistingRoutineContent({
  defaultStartTime,
  defaultEndTime,
  routines,
  routineGroups,
  routinesByGroup,
  onSelectRoutine,
  onSelectGroup,
}: {
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
}) {
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

  return (
    <div className="flex flex-col" style={{ maxHeight: 340 }}>
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-notion-bg-secondary border border-notion-border rounded">
          <Search size={12} className="text-notion-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("schedule.searchRoutines", "Search...")}
            className="flex-1 text-xs bg-transparent focus:outline-none text-notion-text"
            autoFocus
          />
        </div>
      </div>

      {/* Time settings */}
      <div className="px-3 pb-2 border-b border-notion-border">
        <TimeSettingsInline
          startTime={startTime}
          endTime={endTime}
          isAllDay={isAllDay}
          hasEndTime={hasEndTime}
          onStartTimeChange={setStartTime}
          onEndTimeChange={setEndTime}
          onAllDayChange={setIsAllDay}
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
  );
}

function NewRoutineContent({
  defaultStartTime,
  defaultEndTime,
  onCreateRoutine,
  onClose,
}: {
  defaultStartTime: string;
  defaultEndTime: string;
  onCreateRoutine?: (title: string, startTime: string, endTime: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(true);

  const handleSubmit = () => {
    if (!onCreateRoutine) return;
    const st = isAllDay ? "00:00" : startTime;
    const et = isAllDay ? "23:59" : hasEndTime ? endTime : startTime;
    onCreateRoutine(title.trim() || "Untitled", st, et);
    onClose();
  };

  const {
    inputRef: confirmInputRef,
    handleKeyDown,
    handleBlur,
    handleFocus,
  } = useConfirmableSubmit(handleSubmit, onClose, { singleEnter: true });

  useEffect(() => {
    confirmInputRef.current?.focus();
  }, [confirmInputRef]);

  return (
    <div className="p-3">
      <input
        ref={confirmInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={t("schedule.routineTitlePlaceholder", "Routine name")}
        className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
      />

      <div className="mt-2">
        <TimeSettingsInline
          isAllDay={isAllDay}
          onAllDayChange={setIsAllDay}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          hasEndTime={hasEndTime}
          onHasEndTimeChange={setHasEndTime}
          endTime={endTime}
          onEndTimeChange={setEndTime}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!onCreateRoutine}
        className="w-full mt-2 px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50"
      >
        {t("schedule.create")}
      </button>
      <button
        onClick={onClose}
        className="w-full mt-1 py-1 text-xs text-notion-text-secondary hover:text-notion-text text-center transition-colors"
      >
        {t("common.cancel")}
      </button>
    </div>
  );
}
