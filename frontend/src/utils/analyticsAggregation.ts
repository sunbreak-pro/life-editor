import type { TimerSession } from "../types/timer";
import type { TaskNode } from "../types/taskTree";
import type { ScheduleItem } from "../types/schedule";
import type { NoteNode } from "../types/note";
import type { DailyNode } from "../types/daily";
import type { RoutineNode } from "../types/routine";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../types/wikiTag";
import { formatDateKey as toDateStr } from "./dateKey";

export interface DayBucket {
  date: string; // YYYY-MM-DD
  totalMinutes: number;
  sessionCount: number;
}

export interface TaskBucket {
  taskId: string;
  taskName: string;
  totalMinutes: number;
  sessionCount: number;
}

export interface HeatmapCell {
  dayOfWeek: number; // 0=Mon, 6=Sun
  hour: number; // 0-23
  totalMinutes: number;
}

export interface PomodoroRateBucket {
  date: string;
  actual: number;
  target: number;
  rate: number; // 0-100
}

export interface WorkBreakBucket {
  date: string;
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
}

export interface TimelineBlock {
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  sessionType: string;
  taskId: string | null;
}

export interface CompletionTrendBucket {
  date: string;
  completedCount: number;
}

export interface StagnationBucket {
  label: string;
  count: number;
  color: string;
}

export interface FolderBucket {
  folderId: string;
  folderName: string;
  totalMinutes: number;
  taskCount: number;
}

export interface WorkStreak {
  currentStreak: number;
  longestStreak: number;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function getWorkSessions(sessions: TimerSession[]): TimerSession[] {
  return sessions.filter(
    (s) => s.sessionType === "WORK" && s.duration != null && s.duration > 0,
  );
}

export function aggregateByDay(
  sessions: TimerSession[],
  days: number,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, DayBucket>();

  // Pre-fill all dates so there are no gaps
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const key = toDateStr(started);
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByWeek(
  sessions: TimerSession[],
  weeks: number,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();
  const currentWeekStart = startOfWeek(now);

  const map = new Map<string, DayBucket>();

  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const key = toDateStr(d);
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const weekStart = startOfWeek(started);
    const key = toDateStr(weekStart);
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByMonth(
  sessions: TimerSession[],
  months: number,
): DayBucket[] {
  const work = getWorkSessions(sessions);
  const now = new Date();

  const map = new Map<string, DayBucket>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = toDateStr(startOfMonth(d));
    map.set(key, { date: key, totalMinutes: 0, sessionCount: 0 });
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const key = toDateStr(startOfMonth(started));
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalMinutes += (s.duration ?? 0) / 60;
      bucket.sessionCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateByTask(
  sessions: TimerSession[],
  taskNameMap: Map<string, string>,
): TaskBucket[] {
  const work = getWorkSessions(sessions);
  const map = new Map<string, TaskBucket>();

  for (const s of work) {
    const tid = s.taskId ?? "__none__";
    let bucket = map.get(tid);
    if (!bucket) {
      bucket = {
        taskId: tid,
        taskName:
          taskNameMap.get(tid) ?? (tid === "__none__" ? "No Task" : tid),
        totalMinutes: 0,
        sessionCount: 0,
      };
      map.set(tid, bucket);
    }
    bucket.totalMinutes += (s.duration ?? 0) / 60;
    bucket.sessionCount += 1;
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 10);
}

export function computeSummary(sessions: TimerSession[]) {
  const work = getWorkSessions(sessions);
  const totalMinutes = work.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0);
  const totalSessions = work.length;

  const uniqueDays = new Set(work.map((s) => toDateStr(new Date(s.startedAt))))
    .size;
  const avgMinutesPerDay = uniqueDays > 0 ? totalMinutes / uniqueDays : 0;

  return { totalMinutes, totalSessions, avgMinutesPerDay };
}

// --- New aggregation functions ---

/** Heatmap: aggregate work time by hour-of-day × day-of-week */
export function aggregateByHourAndDay(sessions: TimerSession[]): HeatmapCell[] {
  const work = getWorkSessions(sessions);
  // 7 days × 24 hours grid, dayOfWeek: 0=Mon..6=Sun
  const grid = new Map<string, HeatmapCell>();
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      grid.set(`${d}-${h}`, { dayOfWeek: d, hour: h, totalMinutes: 0 });
    }
  }

  for (const s of work) {
    const started = new Date(s.startedAt);
    const jsDay = started.getDay(); // 0=Sun
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
    const hour = started.getHours();
    const cell = grid.get(`${dayOfWeek}-${hour}`);
    if (cell) {
      cell.totalMinutes += (s.duration ?? 0) / 60;
    }
  }

  return Array.from(grid.values());
}

/** Pomodoro completion rate: actual vs target sessions per day */
export function aggregatePomodoroRate(
  sessions: TimerSession[],
  targetPerDay: number,
  days: number,
): PomodoroRateBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, PomodoroRateBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, actual: 0, target: targetPerDay, rate: 0 });
  }

  // Count completed WORK sessions per day
  for (const s of sessions) {
    if (s.sessionType !== "WORK" || !s.completed) continue;
    const key = toDateStr(new Date(s.startedAt));
    const bucket = map.get(key);
    if (bucket) {
      bucket.actual += 1;
    }
  }

  for (const bucket of map.values()) {
    bucket.rate =
      bucket.target > 0
        ? Math.min(100, Math.round((bucket.actual / bucket.target) * 100))
        : 0;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Work/Break balance per day */
export function aggregateWorkBreakBalance(
  sessions: TimerSession[],
  days: number,
): WorkBreakBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, WorkBreakBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, {
      date: key,
      workMinutes: 0,
      breakMinutes: 0,
      longBreakMinutes: 0,
    });
  }

  for (const s of sessions) {
    if (s.duration == null || s.duration <= 0) continue;
    const key = toDateStr(new Date(s.startedAt));
    const bucket = map.get(key);
    if (!bucket) continue;
    const mins = s.duration / 60;
    if (s.sessionType === "WORK") bucket.workMinutes += mins;
    else if (s.sessionType === "BREAK") bucket.breakMinutes += mins;
    else if (s.sessionType === "LONG_BREAK") bucket.longBreakMinutes += mins;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Daily timeline: session blocks for a specific date */
export function aggregateDailyTimeline(
  sessions: TimerSession[],
  date: string,
): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  for (const s of sessions) {
    if (s.duration == null || s.duration <= 0) continue;
    const started = new Date(s.startedAt);
    if (toDateStr(started) !== date) continue;
    blocks.push({
      startHour: started.getHours(),
      startMinute: started.getMinutes(),
      durationMinutes: s.duration / 60,
      sessionType: s.sessionType,
      taskId: s.taskId,
    });
  }

  return blocks.sort(
    (a, b) =>
      a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute),
  );
}

/** Task completion trend: completed tasks per day */
export function aggregateTaskCompletionTrend(
  nodes: TaskNode[],
  days: number,
): CompletionTrendBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, CompletionTrendBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, completedCount: 0 });
  }

  for (const n of nodes) {
    if (n.type !== "task" || !n.completedAt) continue;
    const key = n.completedAt.substring(0, 10);
    const bucket = map.get(key);
    if (bucket) {
      bucket.completedCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Task stagnation: distribution of incomplete task ages */
export function aggregateTaskStagnation(nodes: TaskNode[]): StagnationBucket[] {
  const now = new Date();
  const buckets: StagnationBucket[] = [
    { label: "< 1 week", count: 0, color: "#22c55e" },
    { label: "1-2 weeks", count: 0, color: "#84cc16" },
    { label: "2-4 weeks", count: 0, color: "#eab308" },
    { label: "1-3 months", count: 0, color: "#f97316" },
    { label: "3+ months", count: 0, color: "#ef4444" },
  ];

  const DAY = 24 * 60 * 60 * 1000;

  for (const n of nodes) {
    if (n.type !== "task" || n.status === "DONE" || n.isDeleted) continue;
    const created = new Date(n.createdAt);
    const ageDays = Math.floor((now.getTime() - created.getTime()) / DAY);

    if (ageDays < 7) buckets[0].count += 1;
    else if (ageDays < 14) buckets[1].count += 1;
    else if (ageDays < 28) buckets[2].count += 1;
    else if (ageDays < 90) buckets[3].count += 1;
    else buckets[4].count += 1;
  }

  return buckets;
}

/** Work time by top-level folder */
export function aggregateByFolder(
  sessions: TimerSession[],
  nodes: TaskNode[],
): FolderBucket[] {
  const work = getWorkSessions(sessions);
  const nodeMap = new Map<string, TaskNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  // Find root folder for a given task
  function findRootFolder(taskId: string): TaskNode | null {
    let current = nodeMap.get(taskId);
    if (!current) return null;
    let lastFolder: TaskNode | null = null;
    while (current) {
      if (current.type === "folder") lastFolder = current;
      if (!current.parentId) break;
      current = nodeMap.get(current.parentId);
    }
    return lastFolder;
  }

  const map = new Map<string, FolderBucket>();
  const taskFolders = new Map<string, Set<string>>(); // folderId -> taskIds

  for (const s of work) {
    if (!s.taskId) continue;
    const folder = findRootFolder(s.taskId);
    if (!folder) continue;

    let bucket = map.get(folder.id);
    if (!bucket) {
      bucket = {
        folderId: folder.id,
        folderName: folder.title || folder.id,
        totalMinutes: 0,
        taskCount: 0,
      };
      map.set(folder.id, bucket);
      taskFolders.set(folder.id, new Set());
    }
    bucket.totalMinutes += (s.duration ?? 0) / 60;
    taskFolders.get(folder.id)!.add(s.taskId);
  }

  for (const [folderId, tasks] of taskFolders) {
    const bucket = map.get(folderId);
    if (bucket) bucket.taskCount = tasks.size;
  }

  return Array.from(map.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes,
  );
}

/** Work streak: consecutive days with at least one work session */
export function computeWorkStreak(sessions: TimerSession[]): WorkStreak {
  const work = getWorkSessions(sessions);
  const days = new Set(work.map((s) => toDateStr(new Date(s.startedAt))));

  if (days.size === 0) return { currentStreak: 0, longestStreak: 0 };

  const sorted = Array.from(days).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  // Check if today or yesterday is in the set to start current streak
  const today = toDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }
  longestStreak = Math.max(longestStreak, streak);

  // Current streak: walk backwards from today/yesterday
  const startDay = days.has(today)
    ? today
    : days.has(yesterdayStr)
      ? yesterdayStr
      : null;
  if (startDay) {
    currentStreak = 1;
    const d = new Date(startDay);
    while (true) {
      d.setDate(d.getDate() - 1);
      if (days.has(toDateStr(d))) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak };
}

// ============================================================
// Schedule aggregation
// ============================================================

export interface EventCompletionBucket {
  date: string;
  completedCount: number;
  totalCount: number;
}

export interface HourBucket {
  hour: number;
  count: number;
}

export interface RoutineCompletionBucket {
  routineId: string;
  routineTitle: string;
  completedCount: number;
  totalCount: number;
  rate: number;
}

/** Event completion count per day */
export function aggregateEventCompletionByDay(
  items: ScheduleItem[],
  days: number,
): EventCompletionBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, EventCompletionBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, completedCount: 0, totalCount: 0 });
  }

  for (const item of items) {
    const key = item.date;
    const bucket = map.get(key);
    if (bucket) {
      bucket.totalCount += 1;
      if (item.completed) bucket.completedCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Events distribution by hour of day */
export function aggregateEventsByHour(items: ScheduleItem[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  for (const item of items) {
    if (!item.startTime) continue;
    const hour = parseInt(item.startTime.split(":")[0], 10);
    if (hour >= 0 && hour < 24) {
      buckets[hour].count += 1;
    }
  }

  return buckets;
}

/** Per-routine completion rate */
export function aggregateRoutineCompletion(
  items: ScheduleItem[],
  routines: RoutineNode[],
): RoutineCompletionBucket[] {
  const routineMap = new Map(routines.map((r) => [r.id, r]));
  const map = new Map<
    string,
    { completed: number; total: number; title: string }
  >();

  for (const item of items) {
    if (!item.routineId) continue;
    let entry = map.get(item.routineId);
    if (!entry) {
      const routine = routineMap.get(item.routineId);
      entry = { completed: 0, total: 0, title: routine?.title ?? item.title };
      map.set(item.routineId, entry);
    }
    entry.total += 1;
    if (item.completed) entry.completed += 1;
  }

  return Array.from(map.entries())
    .map(([routineId, data]) => ({
      routineId,
      routineTitle: data.title,
      completedCount: data.completed,
      totalCount: data.total,
      rate:
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// ============================================================
// Materials aggregation
// ============================================================

/** Note creation count per day */
export function aggregateNoteCreationByDay(
  notes: NoteNode[],
  days: number,
): CompletionTrendBucket[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, CompletionTrendBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    map.set(key, { date: key, completedCount: 0 });
  }

  for (const note of notes) {
    if (note.type !== "note" || note.isDeleted) continue;
    const key = note.createdAt.substring(0, 10);
    const bucket = map.get(key);
    if (bucket) {
      bucket.completedCount += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface DailyActivityCell {
  date: string;
  hasContent: boolean;
}

/** Memo activity: which days have dailies */
export function aggregateDailyActivity(
  dailies: DailyNode[],
  days: number,
): DailyActivityCell[] {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const dailyDateSet = new Set(
    dailies.filter((m) => !m.isDeleted).map((m) => m.date),
  );

  const cells: DailyActivityCell[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = toDateStr(d);
    cells.push({ date: key, hasContent: dailyDateSet.has(key) });
  }

  return cells;
}

export interface FolderNoteBucket {
  folderId: string | null;
  folderName: string;
  noteCount: number;
}

/** Notes grouped by parent folder */
export function aggregateNotesByFolder(notes: NoteNode[]): FolderNoteBucket[] {
  const folderMap = new Map<string, string>();
  for (const n of notes) {
    if (n.type === "folder" && !n.isDeleted) {
      folderMap.set(n.id, n.title || n.id);
    }
  }

  const map = new Map<string | null, number>();
  for (const n of notes) {
    if (n.type !== "note" || n.isDeleted) continue;
    const key = n.parentId;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([folderId, noteCount]) => ({
      folderId,
      folderName: folderId
        ? (folderMap.get(folderId) ?? folderId)
        : "No Folder",
      noteCount,
    }))
    .sort((a, b) => b.noteCount - a.noteCount);
}

// ============================================================
// Connect aggregation
// ============================================================

export interface TagUsageBucket {
  tagId: string;
  tagName: string;
  tagColor: string;
  count: number;
}

/** Top tags by assignment count */
export function aggregateTagUsage(
  tags: WikiTag[],
  assignments: WikiTagAssignment[],
  limit: number = 15,
): TagUsageBucket[] {
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const countMap = new Map<string, number>();

  for (const a of assignments) {
    countMap.set(a.tagId, (countMap.get(a.tagId) ?? 0) + 1);
  }

  return Array.from(countMap.entries())
    .map(([tagId, count]) => {
      const tag = tagMap.get(tagId);
      return {
        tagId,
        tagName: tag?.name ?? tagId,
        tagColor: tag?.color ?? "#808080",
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface TagEntityTypeBucket {
  tagId: string;
  tagName: string;
  tagColor: string;
  taskCount: number;
  noteCount: number;
  dailyCount: number;
}

/** Tag usage broken down by entity type */
export function aggregateTagByEntityType(
  tags: WikiTag[],
  assignments: WikiTagAssignment[],
  limit: number = 10,
): TagEntityTypeBucket[] {
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const map = new Map<string, { task: number; note: number; memo: number }>();

  for (const a of assignments) {
    let entry = map.get(a.tagId);
    if (!entry) {
      entry = { task: 0, note: 0, memo: 0 };
      map.set(a.tagId, entry);
    }
    if (a.entityType === "task") entry.task += 1;
    else if (a.entityType === "note") entry.note += 1;
    else if (a.entityType === "memo") entry.memo += 1;
  }

  return Array.from(map.entries())
    .map(([tagId, counts]) => {
      const tag = tagMap.get(tagId);
      return {
        tagId,
        tagName: tag?.name ?? tagId,
        tagColor: tag?.color ?? "#808080",
        taskCount: counts.task,
        noteCount: counts.note,
        dailyCount: counts.memo,
      };
    })
    .sort(
      (a, b) =>
        b.taskCount +
        b.noteCount +
        b.dailyCount -
        (a.taskCount + a.noteCount + a.dailyCount),
    )
    .slice(0, limit);
}

export interface TagConnectionStats {
  totalTagConnections: number;
  totalNoteConnections: number;
  mostConnectedTag: { name: string; count: number } | null;
  isolatedTagCount: number;
  avgConnections: number;
  density: number;
}

/** Compute tag and note connection statistics */
export function computeTagConnectionStats(
  tags: WikiTag[],
  tagConnections: WikiTagConnection[],
  noteConnectionCount: number,
): TagConnectionStats {
  const connectionCount = new Map<string, number>();
  for (const c of tagConnections) {
    connectionCount.set(
      c.sourceTagId,
      (connectionCount.get(c.sourceTagId) ?? 0) + 1,
    );
    connectionCount.set(
      c.targetTagId,
      (connectionCount.get(c.targetTagId) ?? 0) + 1,
    );
  }

  let mostConnectedTag: { name: string; count: number } | null = null;
  let isolatedTagCount = 0;

  for (const tag of tags) {
    const count = connectionCount.get(tag.id) ?? 0;
    if (count === 0) {
      isolatedTagCount += 1;
    }
    if (!mostConnectedTag || count > mostConnectedTag.count) {
      mostConnectedTag = { name: tag.name, count };
    }
  }

  const totalTags = tags.length;
  const maxPossible = totalTags > 1 ? (totalTags * (totalTags - 1)) / 2 : 0;
  const density =
    maxPossible > 0
      ? Math.round((tagConnections.length / maxPossible) * 100)
      : 0;

  const avgConnections =
    totalTags > 0
      ? Math.round((tagConnections.length * 2 * 10) / totalTags) / 10
      : 0;

  return {
    totalTagConnections: tagConnections.length,
    totalNoteConnections: noteConnectionCount,
    mostConnectedTag: mostConnectedTag?.count ? mostConnectedTag : null,
    isolatedTagCount,
    avgConnections,
    density,
  };
}
