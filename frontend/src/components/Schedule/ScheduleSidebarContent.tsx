import { useState, useEffect, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import { AchievementPanel } from "../Tasks/Schedule/Routine/AchievementPanel";
import { AchievementDetailsOverlay } from "../Tasks/Schedule/Routine/AchievementDetailsOverlay";
import { MiniTodayFlow } from "./MiniTodayFlow";
import { ScheduleItemEditPopup } from "./ScheduleItemEditPopup";
import type { EditTarget } from "./ScheduleItemEditPopup";
import { RoutineManagementOverlay } from "../Tasks/Schedule/Routine/RoutineManagementOverlay";
import { useScheduleContext } from "../../hooks/useScheduleContext";
import { useTaskTreeContext } from "../../hooks/useTaskTreeContext";
import { formatDateKey } from "../../utils/dateKey";
import { getDataService } from "../../services/dataServiceFactory";
import type { ScheduleItem } from "../../types/schedule";
import type { RoutineStats } from "../../types/schedule";
import { FolderDropdown } from "../Tasks/Folder/FolderDropdown";
import {
  Filter,
  ChevronDown,
  Search,
  X,
  BookOpen,
  StickyNote,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNoteContext } from "../../hooks/useNoteContext";
import { useMemoContext } from "../../hooks/useMemoContext";

interface ScheduleSidebarContentProps {
  routineStats: RoutineStats | null;
  activeDate?: Date;
  activeFilters?: Set<string>;
  showManagement?: boolean;
  onShowManagementChange?: (open: boolean) => void;
  children: ReactNode;
  onSelectTask?: (taskId: string) => void;
  filterFolderId?: string | null;
  onFilterFolderChange?: (folderId: string | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
}

export function ScheduleSidebarContent({
  routineStats,
  activeDate,
  activeFilters,
  showManagement: externalShowManagement,
  onShowManagementChange,
  children,
  onSelectTask,
  filterFolderId,
  onFilterFolderChange,
  searchQuery,
  onSearchQueryChange,
  onSelectMemo,
  onSelectNote,
}: ScheduleSidebarContentProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [internalShowManagement, setInternalShowManagement] = useState(false);
  const showManagement = externalShowManagement ?? internalShowManagement;
  const setShowManagement = onShowManagementChange ?? setInternalShowManagement;

  const [miniFlowDate, setMiniFlowDate] = useState<Date>(
    activeDate ?? new Date(),
  );
  const [sidebarScheduleItems, setSidebarScheduleItems] = useState<
    ScheduleItem[]
  >([]);

  const {
    routines,
    toggleComplete,
    dismissScheduleItem,
    undismissScheduleItem,
    routineTags,
    tagAssignments,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setTagsForRoutine,
    getRoutineCompletionRate,
    createRoutineTag,
    updateRoutineTag,
    deleteRoutineTag,
    routineGroups,
    groupTagAssignments,
    routinesByGroup,
    groupTimeRange,
    createRoutineGroup,
    updateRoutineGroup,
    deleteRoutineGroup,
    setTagsForGroup,
    scheduleItemsVersion,
    reconcileRoutineScheduleItems,
    groupForRoutine,
  } = useScheduleContext();

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editPosition, setEditPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const { nodes, updateNode, setTaskStatus } = useTaskTreeContext();
  const { notes } = useNoteContext();
  const { memos } = useMemoContext();

  const handleDismissItem = useCallback(
    (scheduleItemId: string) => {
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.id === scheduleItemId ? { ...item, isDismissed: true } : item,
        ),
      );
      dismissScheduleItem(scheduleItemId);
    },
    [dismissScheduleItem],
  );

  const handleUndismissItem = useCallback(
    (scheduleItemId: string) => {
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.id === scheduleItemId ? { ...item, isDismissed: false } : item,
        ),
      );
      undismissScheduleItem(scheduleItemId);
    },
    [undismissScheduleItem],
  );

  const handleDismissGroup = useCallback(
    (groupId: string) => {
      const groupRoutineIds = new Set(
        (routinesByGroup.get(groupId) ?? []).map((r) => r.id),
      );
      for (const item of sidebarScheduleItems) {
        if (item.routineId && groupRoutineIds.has(item.routineId)) {
          dismissScheduleItem(item.id);
        }
      }
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.routineId && groupRoutineIds.has(item.routineId)
            ? { ...item, isDismissed: true }
            : item,
        ),
      );
    },
    [routinesByGroup, sidebarScheduleItems, dismissScheduleItem],
  );

  const handleUndismissGroup = useCallback(
    (groupId: string) => {
      const groupRoutineIds = new Set(
        (routinesByGroup.get(groupId) ?? []).map((r) => r.id),
      );
      for (const item of sidebarScheduleItems) {
        if (item.routineId && groupRoutineIds.has(item.routineId)) {
          undismissScheduleItem(item.id);
        }
      }
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.routineId && groupRoutineIds.has(item.routineId)
            ? { ...item, isDismissed: false }
            : item,
        ),
      );
    },
    [routinesByGroup, sidebarScheduleItems, undismissScheduleItem],
  );

  const handleEditRoutine = useCallback(
    (routineId: string) => {
      setShowManagement(true);
    },
    [setShowManagement],
  );

  const handleEditRoutinePopup = useCallback(
    (routineId: string, e: React.MouseEvent) => {
      const scheduleItem = sidebarScheduleItems.find(
        (si) => si.routineId === routineId,
      );
      setEditTarget({
        type: "routine",
        routineId,
        scheduleItemId: scheduleItem?.id ?? null,
      });
      setEditPosition({ x: e.clientX, y: e.clientY });
    },
    [sidebarScheduleItems],
  );

  const handleEditEvent = useCallback(
    (scheduleItemId: string, e: React.MouseEvent) => {
      setEditTarget({ type: "event", scheduleItemId });
      setEditPosition({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleEditTask = useCallback((taskId: string, e: React.MouseEvent) => {
    setEditTarget({ type: "task", taskId });
    setEditPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRemoveTaskFromSchedule = useCallback(
    (taskId: string) => {
      updateNode(taskId, { scheduledAt: null, scheduledEndAt: null });
    },
    [updateNode],
  );

  const handleToggleTaskStatus = useCallback(
    (taskId: string) => {
      const task = nodes.find((n) => n.id === taskId);
      if (!task) return;
      setTaskStatus(taskId, task.status === "DONE" ? "NOT_STARTED" : "DONE");
    },
    [nodes, setTaskStatus],
  );

  const handleCloseEditPopup = useCallback(() => {
    setEditTarget(null);
    setEditPosition(null);
  }, []);

  // Sync miniFlowDate when activeDate changes from parent
  useEffect(() => {
    if (activeDate) setMiniFlowDate(activeDate);
  }, [activeDate]);

  // Load schedule items for the sidebar date independently
  const miniFlowDateKey = formatDateKey(miniFlowDate);
  useEffect(() => {
    getDataService()
      .fetchScheduleItemsByDateAll(miniFlowDateKey)
      .then(setSidebarScheduleItems)
      .catch(() => setSidebarScheduleItems([]));
  }, [miniFlowDateKey, scheduleItemsVersion]);

  const handlePrevDate = useCallback(() => {
    setMiniFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const handleNextDate = useCallback(() => {
    setMiniFlowDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, []);

  const dateTasks = useMemo(() => {
    return nodes.filter((n) => {
      if (n.type !== "task" || n.isDeleted || !n.scheduledAt) return false;
      const key = formatDateKey(new Date(n.scheduledAt));
      return key === miniFlowDateKey;
    });
  }, [nodes, miniFlowDateKey]);

  const notesForDate = useMemo(
    () =>
      notes.filter(
        (n) =>
          !n.isDeleted &&
          formatDateKey(new Date(n.createdAt)) === miniFlowDateKey,
      ),
    [notes, miniFlowDateKey],
  );

  const memoForDate = useMemo(
    () => memos.find((m) => m.date === miniFlowDateKey && !m.isDeleted),
    [memos, miniFlowDateKey],
  );

  // Optimistic toggle: update sidebar items immediately, then persist via context
  const handleToggleComplete = useCallback(
    (id: string) => {
      setSidebarScheduleItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                completed: !item.completed,
                completedAt: !item.completed ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
      toggleComplete(id);
    },
    [toggleComplete],
  );

  const { t } = useTranslation();
  const folderName = nodes.find((n) => n.id === filterFolderId)?.title;

  return (
    <div className="flex flex-col h-full">
      {onSearchQueryChange && (
        <div className="px-3 pt-2 pb-1 shrink-0">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-notion-text-secondary"
            />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t("calendar.searchPlaceholder", "Search items...")}
              className="w-full pl-7 pr-7 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text placeholder:text-notion-text-secondary/50 outline-none focus:border-notion-accent/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-notion-text-secondary hover:text-notion-text transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
      {onFilterFolderChange && (
        <div className="px-3 pt-2 pb-1 shrink-0">
          <FolderDropdown
            selectedId={filterFolderId ?? null}
            onSelect={onFilterFolderChange}
            rootLabel={t("calendar.all")}
            panelMinWidth="min-w-44"
            trigger={
              <button
                className={`flex items-center gap-1.5 w-full px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  filterFolderId
                    ? "border-notion-accent/30 bg-notion-accent/10 text-notion-accent"
                    : "border-notion-border text-notion-text-secondary hover:bg-notion-hover"
                }`}
              >
                <Filter size={12} />
                <span className="truncate flex-1 text-left">
                  {filterFolderId && folderName
                    ? folderName
                    : t("calendar.folder")}
                </span>
                <ChevronDown size={11} />
              </button>
            }
          />
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
        <div className="px-3 py-2 space-y-2">
          <MiniTodayFlow
            date={miniFlowDate}
            routines={routines}
            scheduleItems={sidebarScheduleItems}
            onToggleComplete={handleToggleComplete}
            tasks={dateTasks}
            routineGroups={routineGroups}
            routinesByGroup={routinesByGroup}
            onSelectTask={onSelectTask}
            onPrevDate={handlePrevDate}
            onNextDate={handleNextDate}
            activeFilters={activeFilters}
            onEditRoutine={handleEditRoutinePopup}
            onEditEvent={handleEditEvent}
            onEditTask={handleEditTask}
            onDismissItem={handleDismissItem}
            onUndismissItem={handleUndismissItem}
            onDismissGroup={handleDismissGroup}
            onUndismissGroup={handleUndismissGroup}
            onToggleTaskStatus={handleToggleTaskStatus}
          />
          {(memoForDate || notesForDate.length > 0) && (
            <div className="border border-notion-border/60 rounded-lg p-2">
              <div className="text-xs text-notion-text-secondary uppercase tracking-wide font-medium mb-1.5">
                {t("schedule.materials", "Materials")}
              </div>
              <div className="space-y-0.5">
                {memoForDate && (
                  <button
                    onClick={() => onSelectMemo?.(miniFlowDateKey)}
                    className="flex items-center gap-2 w-full px-1.5 py-1 rounded hover:bg-notion-hover text-left transition-colors"
                  >
                    <BookOpen size={14} className="text-amber-500 shrink-0" />
                    <span className="text-xs text-notion-text truncate flex-1">
                      {t("schedule.dailyMemo", "Daily")}
                    </span>
                  </button>
                )}
                {notesForDate.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => onSelectNote?.(note.id)}
                    className="flex items-center gap-2 w-full px-1.5 py-1 rounded hover:bg-notion-hover text-left transition-colors"
                  >
                    <StickyNote size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs text-notion-text truncate flex-1">
                      {note.title || t("notes.untitled", "Untitled")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {routineStats && (
        <div className="px-3 py-2 border-t border-notion-border mt-auto shrink-0">
          <AchievementPanel
            stats={routineStats}
            onShowDetails={() => setShowDetails(true)}
          />
        </div>
      )}

      {showDetails && routineStats && (
        <AchievementDetailsOverlay
          stats={routineStats}
          onClose={() => setShowDetails(false)}
          groupForRoutine={groupForRoutine}
          routineGroups={routineGroups}
        />
      )}

      {editTarget && editPosition && (
        <ScheduleItemEditPopup
          target={editTarget}
          position={editPosition}
          onClose={handleCloseEditPopup}
          routines={routines}
          scheduleItems={sidebarScheduleItems}
          tasks={dateTasks}
          routineTags={routineTags}
          tagAssignments={tagAssignments}
          onUpdateRoutine={updateRoutine}
          onSetTagsForRoutine={setTagsForRoutine}
          onUpdateScheduleItem={(id, updates) => {
            setSidebarScheduleItems((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, ...updates } : item,
              ),
            );
            getDataService().updateScheduleItem(id, updates);
          }}
          onUpdateTask={(taskId, updates) => {
            updateNode(taskId, updates);
          }}
          onCreateRoutineTag={createRoutineTag}
        />
      )}

      {showManagement && (
        <RoutineManagementOverlay
          routines={routines}
          routineTags={routineTags}
          tagAssignments={tagAssignments}
          onCreateRoutine={createRoutine}
          onUpdateRoutine={updateRoutine}
          onDeleteRoutine={deleteRoutine}
          setTagsForRoutine={setTagsForRoutine}
          getCompletionRate={getRoutineCompletionRate}
          onCreateRoutineTag={createRoutineTag}
          onUpdateRoutineTag={updateRoutineTag}
          onDeleteRoutineTag={deleteRoutineTag}
          routineGroups={routineGroups}
          groupTagAssignments={groupTagAssignments}
          routinesByGroup={routinesByGroup}
          groupTimeRange={groupTimeRange}
          onCreateRoutineGroup={createRoutineGroup}
          onUpdateRoutineGroup={updateRoutineGroup}
          onDeleteRoutineGroup={deleteRoutineGroup}
          setTagsForGroup={setTagsForGroup}
          onReconcileRoutineScheduleItems={reconcileRoutineScheduleItems}
          onClose={() => setShowManagement(false)}
        />
      )}
    </div>
  );
}
