import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Check, Repeat, Pencil, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../../types/taskTree";
import { useTaskTreeContext } from "../../../../hooks/useTaskTreeContext";
import { useCalendarContext } from "../../../../hooks/useCalendarContext";
import { useDailyContext } from "../../../../hooks/useDailyContext";
import { useNoteContext } from "../../../../hooks/useNoteContext";
import { useCalendar } from "../../../../hooks/useCalendar";
import {
  getDescendantTasks,
  collectDescendantIds,
} from "../../../../utils/getDescendantTasks";
import { formatDateKey } from "../../../../utils/dateKey";
import type { CalendarItem } from "../../../../types/calendarItem";
import { CalendarHeader } from "./CalendarHeader";
import { TaskSchedulePanel } from "../../../shared/TaskSchedulePanel";
import { NoteCreatePopover } from "./NoteCreatePopover";
import { CreateItemPopover } from "./CreateItemPopover";
import { EventCreatePopover } from "./EventCreatePopover";
import { TaskPreviewPopup } from "./TaskPreviewPopup";
import { MemoPreviewPopup } from "./MemoPreviewPopup";
import { ScheduleItemPreviewPopup } from "../DayFlow/ScheduleItemPreviewPopup";
import { MonthlyView } from "./MonthlyView";
import { WeeklyTimeGrid } from "./WeeklyTimeGrid";
import { useScheduleContext } from "../../../../hooks/useScheduleContext";
import type { ScheduleItem } from "../../../../types/schedule";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { RoutineNode } from "../../../../types/routine";
import { RoutineEditDialog } from "../Routine/RoutineEditDialog";
import { RoutineGroupEditDialog } from "../Routine/RoutineGroupEditDialog";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";
import { useTheme } from "../../../../hooks/useTheme";
import { STORAGE_KEYS } from "../../../../constants/storageKeys";
import {
  useRoleConversion,
  type ConversionRole,
  type ConversionSource,
} from "../../../../hooks/useRoleConversion";
import type { DailyNode } from "../../../../types/daily";
import type { NoteNode } from "../../../../types/note";

function GroupPreviewPopup({
  group,
  scheduleItems,
  position,
  onSelectItem,
  onEditGroup,
  onDismissItem,
  onDismissAll,
  onClose,
}: {
  group: RoutineGroup;
  scheduleItems: ScheduleItem[];
  position: { x: number; y: number };
  onSelectItem: (item: ScheduleItem) => void;
  onEditGroup?: () => void;
  onDismissItem?: (item: ScheduleItem) => void;
  onDismissAll?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);
  const left = Math.min(position.x, window.innerWidth - 240 - 16);
  const top = Math.min(position.y, window.innerHeight - 200 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-60 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
      style={{ left, top }}
    >
      <div className="px-3 pt-2">
        <div
          className="w-full h-1 rounded-full"
          style={{ backgroundColor: group.color }}
        />
      </div>
      <div className="px-3 py-2 border-b border-notion-border flex items-center gap-2">
        <span
          className="w-3 h-3 rounded shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="text-sm font-medium text-notion-text truncate">
          {group.name}
        </span>
        <div className="flex items-center gap-1 ml-auto">
          {onEditGroup && (
            <button
              onClick={() => {
                onClose();
                onEditGroup();
              }}
              className="p-0.5 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
              title={t("groupContextMenu.edit", "Edit group")}
            >
              <Pencil size={12} />
            </button>
          )}
          {onDismissAll && (
            <button
              onClick={() => {
                onDismissAll();
                onClose();
              }}
              className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors"
              title={t("groupContextMenu.dismissToday", "Dismiss today")}
            >
              <EyeOff size={12} />
            </button>
          )}
          <span className="text-[10px] text-notion-text-secondary">
            {scheduleItems.length}
          </span>
        </div>
      </div>
      <div className="p-1 max-h-48 overflow-y-auto">
        {scheduleItems.map((si) => (
          <div
            key={si.id}
            className={`group/item w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-notion-hover transition-colors ${
              si.completed
                ? "text-notion-text-secondary line-through"
                : "text-notion-text"
            }`}
          >
            <button
              onClick={() => onSelectItem(si)}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              {si.completed ? (
                <Check size={10} className="text-green-500 shrink-0" />
              ) : (
                <Repeat size={10} className="text-emerald-500 shrink-0" />
              )}
              <span className="truncate">{si.title}</span>
              <span className="ml-auto text-[10px] text-notion-text-secondary shrink-0">
                {si.startTime}
              </span>
            </button>
            {onDismissItem && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissItem(si);
                }}
                className="p-0.5 text-notion-text-secondary hover:text-red-500 rounded transition-colors shrink-0 opacity-0 group-hover/item:opacity-100"
                title={t("groupContextMenu.dismissItem", "Dismiss for today")}
              >
                <EyeOff size={10} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface CalendarViewProps {
  onSelectTask: (taskId: string) => void;
  onCreateTask?: (
    title: string,
    parentId: string | null,
    schedule: {
      scheduledAt: string;
      scheduledEndAt?: string;
      isAllDay?: boolean;
    },
  ) => void;
  onSelectMemo?: (date: string) => void;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: (title: string) => void;
  filter: "incomplete" | "completed";
  filterFolderId: string | null;
  onFilterFolderChange?: (folderId: string | null) => void;
  contentFilters?: Set<string>;
  searchQuery?: string;
  onDateSelect?: (date: Date) => void;
  onOpenRoutineManagement?: () => void;
  typeOrder?: string[];
}

function getInitialWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function CalendarView({
  onSelectTask,
  onCreateTask,
  onSelectMemo,
  onSelectNote,
  onCreateNote,
  filter,
  filterFolderId,
  contentFilters,
  searchQuery,
  onDateSelect,
  onOpenRoutineManagement,
  typeOrder,
}: CalendarViewProps) {
  const {
    nodes,
    getTaskColor,
    getFolderTagForTask,
    softDelete,
    updateNode,
    toggleTaskStatus,
    setTaskStatus,
  } = useTaskTreeContext();
  const { activeCalendar } = useCalendarContext();
  const { dailies, upsertDaily } = useDailyContext();
  const { language } = useTheme();
  const [showHolidays, setShowHolidays] = useLocalStorage<boolean>(
    STORAGE_KEYS.CALENDAR_SHOW_HOLIDAYS,
    true,
    {
      serialize: String,
      deserialize: (raw) => raw !== "false",
    },
  );
  const {
    notes,
    createNote: createNoteFromContext,
    updateNote,
    softDeleteNote,
  } = useNoteContext();
  const {
    loadScheduleItemsForMonth,
    getRoutineCompletionByDate,
    createScheduleItem,
    updateScheduleItem,
    softDeleteScheduleItem,
    toggleComplete,
    calendarTags,
    setTagsForScheduleItem,
    monthlyScheduleItems,
    groupForRoutine,
    routines,
    routineGroups,
    routineGroupAssignments,
    updateRoutine,
    updateRoutineGroup,
    setGroupsForRoutine,
    routinesByGroup,
    groupTimeRange,
    createRoutineGroup,
    reconcileRoutineScheduleItems,
    dismissScheduleItem,
    scheduleItemsVersion,
    ensureRoutineItemsForDateRange,
  } = useScheduleContext();

  const { convert, canConvert } = useRoleConversion();

  // Filter nodes by active calendar's folder subtree
  const filteredNodes = useMemo(() => {
    if (!activeCalendar) return nodes;
    return getDescendantTasks(activeCalendar.folderId, nodes);
  }, [activeCalendar, nodes]);

  // Folder list for task creation popover
  const folders = useMemo(() => {
    return nodes.filter((n) => n.type === "folder" && !n.isDeleted);
  }, [nodes]);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekStartDate, setWeekStartDate] = useState<Date>(getInitialWeekStart);
  const [createPopover, setCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [noteCreatePopover, setNoteCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [createMenuPopover, setCreateMenuPopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [eventCreatePopover, setEventCreatePopover] = useState<{
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [previewPopup, setPreviewPopup] = useState<{
    taskId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [memoPreview, setMemoPreview] = useState<{
    kind: "daily" | "note";
    title: string;
    content: string;
    position: { x: number; y: number };
    onOpenDetail: () => void;
    noteId?: string;
    date: string;
    dailyNode?: DailyNode;
    noteNode?: NoteNode;
  } | null>(null);
  const [scheduleItemPreview, setScheduleItemPreview] = useState<{
    item: ScheduleItem;
    position: { x: number; y: number };
  } | null>(null);
  const [groupPreview, setGroupPreview] = useState<{
    item: CalendarItem;
    position: { x: number; y: number };
  } | null>(null);

  const [editRoutineDialog, setEditRoutineDialog] =
    useState<RoutineNode | null>(null);
  const [editGroupDialog, setEditGroupDialog] = useState<RoutineGroup | null>(
    null,
  );

  // Load schedule items for the current month (also reload on version change)
  useEffect(() => {
    loadScheduleItemsForMonth(year, month);
  }, [year, month, loadScheduleItemsForMonth, scheduleItemsVersion]);

  // Ensure routine items exist for the displayed month grid (42 days)
  useEffect(() => {
    if (routines.length === 0) return;
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startDayOfWeek);
    const gridEnd = new Date(gridStart);
    gridEnd.setDate(gridEnd.getDate() + 41);
    ensureRoutineItemsForDateRange(
      formatDateKey(gridStart),
      formatDateKey(gridEnd),
      routines,
      groupForRoutine,
    );
  }, [year, month, routines, groupForRoutine, ensureRoutineItemsForDateRange]);

  const { tasksByDate, itemsByDate, calendarDays, weekDays } = useCalendar(
    filteredNodes,
    year,
    month,
    filter,
    weekStartDate,
    dailies,
    notes,
    contentFilters,
    monthlyScheduleItems,
    groupForRoutine,
    showHolidays,
    language,
    typeOrder,
  );

  const handlePrev = useCallback(() => {
    if (viewMode === "week") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 7);
        return d;
      });
    } else {
      if (month === 0) {
        setMonth(11);
        setYear((y) => y - 1);
      } else setMonth((m) => m - 1);
    }
  }, [viewMode, month]);

  const handleNext = useCallback(() => {
    if (viewMode === "week") {
      setWeekStartDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 7);
        return d;
      });
    } else {
      if (month === 11) {
        setMonth(0);
        setYear((y) => y + 1);
      } else setMonth((m) => m + 1);
    }
  }, [viewMode, month]);

  const handleToday = useCallback(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setWeekStartDate(getInitialWeekStart());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (el?.getAttribute("contenteditable") === "true") return;
      if (el?.closest?.('[contenteditable="true"]')) return;

      if (e.key === "j") {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        handlePrev();
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        handleToday();
        return;
      }
      if (e.key === "m") {
        e.preventDefault();
        setViewMode((v) => (v === "month" ? "week" : "month"));
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, handleToday]);

  // Pre-compute descendant IDs once for folder filtering
  const folderDescendantIds = useMemo(() => {
    if (!filterFolderId) return null;
    return collectDescendantIds(filterFolderId, nodes);
  }, [filterFolderId, nodes]);

  // Filter itemsByDate by folder (only affects task items)
  const filteredItemsByDate = useMemo(() => {
    const query = searchQuery?.trim().toLowerCase();
    let source = itemsByDate;

    if (folderDescendantIds) {
      const folderMap = new Map<string, CalendarItem[]>();
      for (const [date, items] of source) {
        const matching = items.filter(
          (item) => item.type !== "task" || folderDescendantIds.has(item.id),
        );
        if (matching.length > 0) folderMap.set(date, matching);
      }
      source = folderMap;
    }

    if (!query) return source;

    const searchMap = new Map<string, CalendarItem[]>();
    for (const [date, items] of source) {
      const matching = items.filter((item) =>
        item.title.toLowerCase().includes(query),
      );
      if (matching.length > 0) searchMap.set(date, matching);
    }
    return searchMap;
  }, [itemsByDate, folderDescendantIds, searchQuery]);

  // Also keep filteredTasksByDate for WeeklyTimeGrid (which still uses TaskNode[])
  // When only routine/events filters are active, hide tasks from time grid
  const filteredTasksByDate = useMemo(() => {
    if (
      contentFilters &&
      contentFilters.size > 0 &&
      !contentFilters.has("tasks")
    )
      return new Map<string, TaskNode[]>();
    if (!folderDescendantIds) return tasksByDate;
    const map = new Map<string, typeof nodes>();
    for (const [date, tasks] of tasksByDate) {
      const matching = tasks.filter((task) => folderDescendantIds.has(task.id));
      if (matching.length > 0) map.set(date, matching);
    }
    return map;
  }, [tasksByDate, folderDescendantIds]);

  const handleOpenCreateMenu = useCallback(
    (date: Date, e: React.MouseEvent) => {
      setPreviewPopup(null);
      setMemoPreview(null);
      setCreatePopover(null);
      setNoteCreatePopover(null);
      setEventCreatePopover(null);
      setCreateMenuPopover({ date, position: { x: e.clientX, y: e.clientY } });
    },
    [],
  );

  const handleRequestCreate = useCallback((date: Date, e: React.MouseEvent) => {
    setPreviewPopup(null);
    setMemoPreview(null);
    setNoteCreatePopover(null);
    setCreateMenuPopover(null);
    setCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
  }, []);

  const handleRequestCreateNote = useCallback(
    (date: Date, e: React.MouseEvent) => {
      setPreviewPopup(null);
      setMemoPreview(null);
      setCreatePopover(null);
      setCreateMenuPopover(null);
      setNoteCreatePopover({ date, position: { x: e.clientX, y: e.clientY } });
    },
    [],
  );

  const handleRequestCreateEvent = useCallback(
    (date: Date, position: { x: number; y: number }) => {
      setPreviewPopup(null);
      setMemoPreview(null);
      setCreatePopover(null);
      setNoteCreatePopover(null);
      setCreateMenuPopover(null);
      setEventCreatePopover({ date, position });
    },
    [],
  );

  const handleItemClick = useCallback(
    (item: CalendarItem, e: React.MouseEvent) => {
      setCreatePopover(null);
      setNoteCreatePopover(null);
      setGroupPreview(null);

      if (item.type === "task") {
        setMemoPreview(null);
        setScheduleItemPreview(null);
        setPreviewPopup({
          taskId: item.id,
          position: { x: e.clientX, y: e.clientY },
        });
      } else if (item.type === "daily" && item.daily) {
        setPreviewPopup(null);
        setScheduleItemPreview(null);
        const daily = item.daily;
        setMemoPreview({
          kind: "daily",
          title: daily.date,
          content: daily.content,
          position: { x: e.clientX, y: e.clientY },
          onOpenDetail: () => {
            onSelectMemo?.(daily.date);
            setMemoPreview(null);
          },
          date: daily.date,
          dailyNode: daily,
        });
      } else if (item.type === "note" && item.note) {
        setPreviewPopup(null);
        setScheduleItemPreview(null);
        const note = item.note;
        const dateKey = formatDateKey(new Date(note.createdAt));
        setMemoPreview({
          kind: "note",
          title: note.title || "Untitled",
          content: note.content,
          position: { x: e.clientX, y: e.clientY },
          onOpenDetail: () => {
            onSelectNote?.(note.id);
            setMemoPreview(null);
          },
          noteId: note.id,
          date: dateKey,
          noteNode: note,
        });
      } else if (item.type === "routineGroup") {
        setPreviewPopup(null);
        setMemoPreview(null);
        setScheduleItemPreview(null);
        setGroupPreview({
          item,
          position: { x: e.clientX, y: e.clientY },
        });
      } else if (item.type === "event" && item.scheduleItem) {
        setPreviewPopup(null);
        setMemoPreview(null);
        setScheduleItemPreview({
          item: item.scheduleItem,
          position: { x: e.clientX, y: e.clientY },
        });
      }
    },
    [onSelectMemo, onSelectNote],
  );

  const previewTask = previewPopup
    ? (filteredNodes.find((n) => n.id === previewPopup.taskId) ??
      nodes.find((n) => n.id === previewPopup.taskId))
    : null;

  // Resolve live schedule item from state (not snapshot) for immediate updates
  const liveScheduleItem = scheduleItemPreview
    ? (monthlyScheduleItems.find(
        (si) => si.id === scheduleItemPreview.item.id,
      ) ?? scheduleItemPreview.item)
    : null;

  const getDisabledRoles = (source: ConversionSource): ConversionRole[] => {
    const roles: ConversionRole[] = ["task", "event", "note", "daily"];
    return roles.filter((r) => !canConvert(source, r));
  };

  // Check if a daily exists for the note-create date
  const noteCreateDateHasDaily = noteCreatePopover
    ? dailies.some((m) => {
        const dateKey = formatDateKey(noteCreatePopover.date);
        return m.date === dateKey && !m.isDeleted;
      })
    : false;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="max-w-5xl mx-auto w-full flex-1">
        <CalendarHeader
          year={year}
          month={month}
          viewMode={viewMode}
          weekStartDate={weekStartDate}
          onPrev={handlePrev}
          onNext={handleNext}
          onViewModeChange={setViewMode}
          showHolidays={showHolidays}
          onShowHolidaysChange={setShowHolidays}
        />

        {viewMode === "month" ? (
          <MonthlyView
            days={calendarDays}
            itemsByDate={filteredItemsByDate}
            onSelectItem={handleItemClick}
            onOpenCreateMenu={handleOpenCreateMenu}
            getTaskColor={getTaskColor}
            getRoutineCompletion={getRoutineCompletionByDate}
            onDateSelect={onDateSelect}
          />
        ) : (
          <WeeklyTimeGrid
            days={weekDays}
            tasksByDate={filteredTasksByDate}
            onSelectTask={(taskId, e) =>
              handleItemClick(
                {
                  id: taskId,
                  type: "task",
                  title: "",
                  color: "",
                  task: nodes.find((n) => n.id === taskId),
                },
                e,
              )
            }
            onCreateTask={onCreateTask ? handleRequestCreate : undefined}
            getTaskColor={getTaskColor}
            getFolderTag={getFolderTagForTask}
            onUpdateTimeMemo={(taskId, memo) =>
              updateNode(taskId, { timeMemo: memo ?? undefined })
            }
          />
        )}
      </div>

      {createPopover && (
        <TaskSchedulePanel
          position={createPopover.position}
          date={createPopover.date}
          existingTaskIds={
            new Set(
              (
                filteredTasksByDate.get(formatDateKey(createPopover.date)) ?? []
              ).map((t) => t.id),
            )
          }
          onSelectExistingTask={(task, schedule) => {
            updateNode(task.id, {
              scheduledAt: schedule.scheduledAt,
              scheduledEndAt: schedule.scheduledEndAt,
              isAllDay: schedule.isAllDay,
            });
            setCreatePopover(null);
          }}
          onCreateNewTask={(title, parentId, schedule) => {
            onCreateTask?.(title, parentId, schedule);
            setCreatePopover(null);
          }}
          folders={folders}
          onClose={() => setCreatePopover(null)}
        />
      )}

      {noteCreatePopover && (
        <NoteCreatePopover
          position={noteCreatePopover.position}
          date={noteCreatePopover.date}
          existingDailyDate={noteCreateDateHasDaily}
          onCreateNote={(title) => {
            if (onCreateNote) {
              onCreateNote(title);
            } else {
              createNoteFromContext(title);
            }
            setNoteCreatePopover(null);
          }}
          onCreateDaily={(dateKey) => {
            upsertDaily(dateKey, "");
            setNoteCreatePopover(null);
          }}
          onOpenExistingDaily={() => {
            const dateKey = formatDateKey(noteCreatePopover.date);
            onSelectMemo?.(dateKey);
            setNoteCreatePopover(null);
          }}
          onClose={() => setNoteCreatePopover(null)}
        />
      )}

      {createMenuPopover && (
        <CreateItemPopover
          position={createMenuPopover.position}
          onSelectTask={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreate(date, {
              clientX: position.x,
              clientY: position.y,
              stopPropagation: () => {},
            } as React.MouseEvent);
          }}
          onSelectNote={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreateNote(date, {
              clientX: position.x,
              clientY: position.y,
              stopPropagation: () => {},
            } as React.MouseEvent);
          }}
          onSelectDaily={() => {
            const dateKey = formatDateKey(createMenuPopover.date);
            const hasDaily = dailies.some(
              (m) => m.date === dateKey && !m.isDeleted,
            );
            if (hasDaily) {
              onSelectMemo?.(dateKey);
            } else {
              upsertDaily(dateKey, "");
            }
            setCreateMenuPopover(null);
          }}
          onSelectEvent={() => {
            const { date, position } = createMenuPopover;
            setCreateMenuPopover(null);
            handleRequestCreateEvent(date, position);
          }}
          onSelectRoutine={
            onOpenRoutineManagement
              ? () => {
                  setCreateMenuPopover(null);
                  onOpenRoutineManagement();
                }
              : undefined
          }
          onClose={() => setCreateMenuPopover(null)}
        />
      )}

      {eventCreatePopover && (
        <EventCreatePopover
          position={eventCreatePopover.position}
          date={eventCreatePopover.date}
          calendarTags={calendarTags}
          onCreateEvent={(
            title,
            startTime,
            endTime,
            memo,
            tagIds,
            isAllDay,
          ) => {
            const dateKey = formatDateKey(eventCreatePopover.date);
            const id = createScheduleItem(
              dateKey,
              title,
              startTime,
              endTime,
              undefined,
              undefined,
              undefined,
              isAllDay,
            );
            if (memo) {
              updateScheduleItem(id, { memo });
            }
            if (tagIds.length > 0) {
              setTagsForScheduleItem(id, tagIds);
            }
            setEventCreatePopover(null);
          }}
          onClose={() => setEventCreatePopover(null)}
        />
      )}

      {scheduleItemPreview && liveScheduleItem && (
        <ScheduleItemPreviewPopup
          item={liveScheduleItem}
          position={scheduleItemPreview.position}
          onToggleComplete={() => {
            toggleComplete(scheduleItemPreview.item.id);
            setScheduleItemPreview(null);
          }}
          onUpdateTime={(startTime, endTime) => {
            updateScheduleItem(scheduleItemPreview.item.id, {
              startTime,
              endTime,
            });
          }}
          onEditRoutine={
            scheduleItemPreview.item.routineId
              ? () => {
                  const routine = routines.find(
                    (r) => r.id === scheduleItemPreview.item.routineId,
                  );
                  if (routine) setEditRoutineDialog(routine);
                }
              : undefined
          }
          onDelete={() => {
            softDeleteScheduleItem(scheduleItemPreview.item.id);
            setScheduleItemPreview(null);
          }}
          onUpdateMemo={(id, memo) => updateScheduleItem(id, { memo })}
          onClose={() => setScheduleItemPreview(null)}
          onConvertRole={
            !scheduleItemPreview.item.routineId
              ? (targetRole) => {
                  const source: ConversionSource = {
                    role: "event",
                    scheduleItem: scheduleItemPreview.item,
                    date: scheduleItemPreview.item.date,
                  };
                  if (convert(source, targetRole).success) {
                    setScheduleItemPreview(null);
                  }
                }
              : undefined
          }
          disabledRoles={
            !scheduleItemPreview.item.routineId
              ? getDisabledRoles({
                  role: "event",
                  scheduleItem: scheduleItemPreview.item,
                  date: scheduleItemPreview.item.date,
                })
              : undefined
          }
          onUpdateDate={(date) => {
            updateScheduleItem(scheduleItemPreview.item.id, { date });
            setScheduleItemPreview(null);
          }}
          onUpdateAllDay={(isAllDay) => {
            updateScheduleItem(scheduleItemPreview.item.id, { isAllDay });
          }}
          onUpdateTitle={(title) =>
            updateScheduleItem(scheduleItemPreview.item.id, { title })
          }
        />
      )}

      {previewPopup && previewTask && (
        <TaskPreviewPopup
          task={previewTask}
          position={previewPopup.position}
          color={getTaskColor(previewTask.id)}
          folderTag={getFolderTagForTask(previewTask.id)}
          onOpenDetail={() => {
            onSelectTask(previewTask.id);
            setPreviewPopup(null);
          }}
          onToggleStatus={() => toggleTaskStatus(previewTask.id)}
          onSetStatus={(status) => setTaskStatus(previewTask.id, status)}
          onUpdateTitle={(title) => updateNode(previewTask.id, { title })}
          onUpdateSchedule={(scheduledAt, scheduledEndAt) => {
            updateNode(previewTask.id, {
              scheduledAt,
              scheduledEndAt,
              isAllDay: false,
            });
          }}
          onDelete={() => {
            softDelete(previewTask.id);
            setPreviewPopup(null);
          }}
          onClearSchedule={() => {
            updateNode(previewTask.id, {
              scheduledAt: undefined,
              scheduledEndAt: undefined,
              isAllDay: undefined,
            });
            setPreviewPopup(null);
          }}
          onClose={() => setPreviewPopup(null)}
          onConvertRole={
            previewTask.scheduledAt
              ? (targetRole) => {
                  const date = formatDateKey(
                    new Date(previewTask.scheduledAt!),
                  );
                  const source: ConversionSource = {
                    role: "task",
                    task: previewTask,
                    date,
                  };
                  if (convert(source, targetRole).success) {
                    setPreviewPopup(null);
                  }
                }
              : undefined
          }
          disabledRoles={
            previewTask.scheduledAt
              ? getDisabledRoles({
                  role: "task",
                  task: previewTask,
                  date: formatDateKey(new Date(previewTask.scheduledAt)),
                })
              : undefined
          }
          onUpdateAllDay={(isAllDay) => {
            updateNode(previewTask.id, { isAllDay });
            setPreviewPopup(null);
          }}
          onUpdateTimeMemo={(memo) =>
            updateNode(previewTask.id, {
              timeMemo: memo ?? undefined,
            })
          }
        />
      )}

      {memoPreview && (
        <MemoPreviewPopup
          kind={memoPreview.kind}
          title={memoPreview.title}
          content={memoPreview.content}
          position={memoPreview.position}
          onOpenDetail={memoPreview.onOpenDetail}
          onClose={() => setMemoPreview(null)}
          onUpdateTitle={
            memoPreview.noteId
              ? (title) => updateNote(memoPreview.noteId!, { title })
              : undefined
          }
          onDelete={
            memoPreview.noteId
              ? () => {
                  softDeleteNote(memoPreview.noteId!);
                  setMemoPreview(null);
                }
              : undefined
          }
          onConvertRole={(targetRole) => {
            const source: ConversionSource = {
              role: memoPreview.kind,
              daily: memoPreview.dailyNode,
              note: memoPreview.noteNode,
              date: memoPreview.date,
            };
            if (convert(source, targetRole).success) {
              setMemoPreview(null);
            }
          }}
          disabledRoles={getDisabledRoles({
            role: memoPreview.kind,
            daily: memoPreview.dailyNode,
            note: memoPreview.noteNode,
            date: memoPreview.date,
          })}
        />
      )}

      {groupPreview && groupPreview.item.routineGroup && (
        <GroupPreviewPopup
          group={groupPreview.item.routineGroup}
          scheduleItems={groupPreview.item.groupScheduleItems ?? []}
          position={groupPreview.position}
          onSelectItem={(si) => {
            setGroupPreview(null);
            setScheduleItemPreview({
              item: si,
              position: groupPreview.position,
            });
          }}
          onEditGroup={() => {
            const group = groupPreview.item.routineGroup;
            if (group) setEditGroupDialog(group);
          }}
          onDismissAll={() => {
            const items = groupPreview.item.groupScheduleItems ?? [];
            for (const si of items) {
              dismissScheduleItem(si.id);
            }
          }}
          onDismissItem={(si) => {
            dismissScheduleItem(si.id);
          }}
          onClose={() => setGroupPreview(null)}
        />
      )}

      {editRoutineDialog && (
        <RoutineEditDialog
          routine={editRoutineDialog}
          routineGroups={routineGroups}
          initialGroupIds={
            routineGroupAssignments.get(editRoutineDialog.id) ?? []
          }
          onSubmit={async (
            title,
            startTime,
            endTime,
            groupIds,
            frequencyType,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
            reminderEnabled,
            reminderOffset,
          ) => {
            updateRoutine(editRoutineDialog.id, {
              title,
              startTime,
              endTime,
              frequencyType,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
              reminderEnabled,
              reminderOffset,
            });
            setGroupsForRoutine(editRoutineDialog.id, groupIds);
            const freqChanged =
              frequencyType !== editRoutineDialog.frequencyType ||
              JSON.stringify(frequencyDays) !==
                JSON.stringify(editRoutineDialog.frequencyDays) ||
              frequencyInterval !== editRoutineDialog.frequencyInterval ||
              frequencyStartDate !== editRoutineDialog.frequencyStartDate;
            if (freqChanged) {
              const updatedRoutine: RoutineNode = {
                ...editRoutineDialog,
                title,
                startTime: startTime ?? editRoutineDialog.startTime,
                endTime: endTime ?? editRoutineDialog.endTime,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
                groupIds,
              };
              const firstGroup = groupIds
                .map((id) => routineGroups.find((g) => g.id === id))
                .find((g): g is RoutineGroup => Boolean(g));
              const gridStart = new Date(year, month, 1);
              gridStart.setDate(gridStart.getDate() - gridStart.getDay());
              const gridEnd = new Date(gridStart);
              gridEnd.setDate(gridEnd.getDate() + 41);
              await reconcileRoutineScheduleItems(updatedRoutine, firstGroup, {
                startDate: formatDateKey(gridStart),
                endDate: formatDateKey(gridEnd),
              });
              await loadScheduleItemsForMonth(year, month);
            }
            setEditRoutineDialog(null);
          }}
          onCreateGroup={async (
            name,
            color,
            freqType,
            freqDays,
            freqInterval,
            freqStartDate,
          ) => {
            const id = `rgroup-${crypto.randomUUID()}`;
            return createRoutineGroup(
              id,
              name,
              color,
              freqType,
              freqDays,
              freqInterval,
              freqStartDate,
            );
          }}
          onClose={() => setEditRoutineDialog(null)}
        />
      )}

      {editGroupDialog && (
        <RoutineGroupEditDialog
          group={editGroupDialog}
          memberRoutines={routinesByGroup.get(editGroupDialog.id) ?? []}
          groupTimeRange={groupTimeRange.get(editGroupDialog.id)}
          onSubmit={async (
            name,
            color,
            frequencyType,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
          ) => {
            updateRoutineGroup(editGroupDialog.id, {
              name,
              color,
              frequencyType,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
            });

            const freqChanged =
              frequencyType !== editGroupDialog.frequencyType ||
              JSON.stringify(frequencyDays) !==
                JSON.stringify(editGroupDialog.frequencyDays) ||
              frequencyInterval !== editGroupDialog.frequencyInterval ||
              frequencyStartDate !== editGroupDialog.frequencyStartDate;
            if (freqChanged) {
              const updatedGroup = {
                ...editGroupDialog,
                name,
                color,
                frequencyType,
                frequencyDays,
                frequencyInterval,
                frequencyStartDate,
              };
              const gridStart = new Date(year, month, 1);
              gridStart.setDate(gridStart.getDate() - gridStart.getDay());
              const gridEnd = new Date(gridStart);
              gridEnd.setDate(gridEnd.getDate() + 41);
              const dateRange = {
                startDate: formatDateKey(gridStart),
                endDate: formatDateKey(gridEnd),
              };
              const members = routinesByGroup.get(editGroupDialog.id) ?? [];
              for (const routine of members) {
                await reconcileRoutineScheduleItems(
                  routine,
                  updatedGroup,
                  dateRange,
                );
              }
              await loadScheduleItemsForMonth(year, month);
            }

            setEditGroupDialog(null);
          }}
          onUpdateRoutine={(id, updates) => updateRoutine(id, updates)}
          onClose={() => setEditGroupDialog(null)}
        />
      )}
    </div>
  );
}
