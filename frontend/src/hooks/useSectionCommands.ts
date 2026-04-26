import { useMemo } from "react";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  CalendarClock,
  Repeat,
  StickyNote,
  BookOpen,
} from "lucide-react";
import type { Command } from "../components/CommandPalette/CommandPalette";
import type { SectionId } from "../types/taskTree";
import type { ScheduleTab } from "../components/ScheduleList/ScheduleSection";
import { useTaskTreeContext } from "./useTaskTreeContext";
import { useDailyContext } from "./useDailyContext";
import { useNoteContext } from "./useNoteContext";
import { useScheduleContext } from "./useScheduleContext";
import { STORAGE_KEYS } from "../constants/storageKeys";

interface UseSectionCommandsParams {
  activeSection: SectionId;
  scheduleTab: ScheduleTab;
  setActiveSection: (s: SectionId) => void;
  setScheduleTab: (t: ScheduleTab) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setDailyDate: (dateKey: string) => void;
}

const MAX_ITEMS_PER_GROUP = 30;

export function useSectionCommands({
  activeSection,
  scheduleTab,
  setActiveSection,
  setScheduleTab,
  setSelectedTaskId,
  setSelectedNoteId,
  setDailyDate,
}: UseSectionCommandsParams): Command[] {
  const { nodes } = useTaskTreeContext();
  const { dailies } = useDailyContext();
  const { notes } = useNoteContext();
  const { routines, scheduleItems } = useScheduleContext();

  return useMemo(() => {
    if (activeSection === "schedule") {
      return buildScheduleCommands({
        tab: scheduleTab,
        nodes,
        routines,
        scheduleItems,
        setActiveSection,
        setScheduleTab,
        setSelectedTaskId,
      });
    }
    if (activeSection === "materials") {
      return buildMaterialsCommands({
        notes,
        dailies,
        setActiveSection,
        setSelectedNoteId,
        setDailyDate,
      });
    }
    // Connect / Work / Analytics / Settings: no dynamic items in this pass
    return [];
  }, [
    activeSection,
    scheduleTab,
    nodes,
    routines,
    scheduleItems,
    notes,
    dailies,
    setActiveSection,
    setScheduleTab,
    setSelectedTaskId,
    setSelectedNoteId,
    setDailyDate,
  ]);
}

function buildScheduleCommands(args: {
  tab: ScheduleTab;
  nodes: ReturnType<typeof useTaskTreeContext>["nodes"];
  routines: ReturnType<typeof useScheduleContext>["routines"];
  scheduleItems: ReturnType<typeof useScheduleContext>["scheduleItems"];
  setActiveSection: (s: SectionId) => void;
  setScheduleTab: (t: ScheduleTab) => void;
  setSelectedTaskId: (id: string | null) => void;
}): Command[] {
  const {
    tab,
    nodes,
    routines,
    scheduleItems,
    setActiveSection,
    setScheduleTab,
    setSelectedTaskId,
  } = args;

  const goToTaskTab = (taskId: string) => {
    setActiveSection("schedule");
    setScheduleTab("tasks");
    setSelectedTaskId(taskId);
  };
  const goToCalendarTab = () => {
    setActiveSection("schedule");
    setScheduleTab("calendar");
  };
  const goToEventsTab = () => {
    setActiveSection("schedule");
    setScheduleTab("events");
  };

  if (tab === "tasks") {
    return nodes
      .filter((n) => n.type === "task" && !n.isDeleted && n.scheduledAt)
      .sort(
        (a, b) =>
          new Date(b.scheduledAt!).getTime() -
          new Date(a.scheduledAt!).getTime(),
      )
      .slice(0, MAX_ITEMS_PER_GROUP)
      .map((n) => ({
        id: `schedule-task-${n.id}`,
        title: n.title,
        category: "Schedule · Tasks",
        icon: CheckSquare,
        action: () => goToTaskTab(n.id),
      }));
  }
  if (tab === "events") {
    return scheduleItems
      .filter((i) => !i.routineId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_ITEMS_PER_GROUP)
      .map((i) => ({
        id: `schedule-event-${i.id}`,
        title: i.title,
        category: "Schedule · Events",
        icon: CalendarClock,
        action: () => goToEventsTab(),
      }));
  }
  // calendar / dayflow → routines + non-routine events + scheduled tasks
  const out: Command[] = [];
  for (const r of routines.slice(0, MAX_ITEMS_PER_GROUP)) {
    out.push({
      id: `schedule-routine-${r.id}`,
      title: r.title,
      category: "Schedule · Calendar",
      icon: Repeat,
      action: () => goToCalendarTab(),
    });
  }
  const events = scheduleItems
    .filter((i) => !i.routineId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_ITEMS_PER_GROUP);
  for (const i of events) {
    out.push({
      id: `schedule-event-${i.id}`,
      title: i.title,
      category: "Schedule · Calendar",
      icon: CalendarClock,
      action: () => goToCalendarTab(),
    });
  }
  const scheduledTasks = nodes
    .filter((n) => n.type === "task" && !n.isDeleted && n.scheduledAt)
    .sort(
      (a, b) =>
        new Date(b.scheduledAt!).getTime() - new Date(a.scheduledAt!).getTime(),
    )
    .slice(0, MAX_ITEMS_PER_GROUP);
  for (const n of scheduledTasks) {
    out.push({
      id: `schedule-task-${n.id}`,
      title: n.title,
      category: "Schedule · Calendar",
      icon: CalendarIcon,
      action: () => goToTaskTab(n.id),
    });
  }
  return out;
}

function buildMaterialsCommands(args: {
  notes: ReturnType<typeof useNoteContext>["notes"];
  dailies: ReturnType<typeof useDailyContext>["dailies"];
  setActiveSection: (s: SectionId) => void;
  setSelectedNoteId: (id: string | null) => void;
  setDailyDate: (dateKey: string) => void;
}): Command[] {
  const { notes, dailies, setActiveSection, setSelectedNoteId, setDailyDate } =
    args;

  const out: Command[] = [];

  const recentNotes = notes
    .filter((n) => !n.isDeleted)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime(),
    )
    .slice(0, MAX_ITEMS_PER_GROUP);
  for (const n of recentNotes) {
    out.push({
      id: `material-note-${n.id}`,
      title: n.title || "Untitled",
      category: "Materials · Notes",
      icon: StickyNote,
      action: () => {
        localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "notes");
        setActiveSection("materials");
        setSelectedNoteId(n.id);
      },
    });
  }

  const recentDailies = dailies
    .filter((d) => !d.isDeleted)
    .sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0))
    .slice(0, MAX_ITEMS_PER_GROUP);
  for (const d of recentDailies) {
    out.push({
      id: `material-daily-${d.id}`,
      title: d.date,
      category: "Materials · Daily",
      icon: BookOpen,
      action: () => {
        localStorage.setItem(STORAGE_KEYS.MATERIALS_TAB, "daily");
        setActiveSection("materials");
        setDailyDate(d.date);
      },
    });
  }

  return out;
}
