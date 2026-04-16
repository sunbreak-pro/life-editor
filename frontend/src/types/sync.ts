import type { TaskNode } from "./taskTree";
import type { MemoNode } from "./memo";
import type { NoteNode } from "./note";
import type { ScheduleItem } from "./schedule";
import type { RoutineNode } from "./routine";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
  NoteConnection,
} from "./wikiTag";
import type { TimeMemo } from "./timeMemo";
import type { CalendarNode } from "./calendar";

export type SyncEntityType =
  | "task"
  | "memo"
  | "note"
  | "scheduleItem"
  | "routine"
  | "wikiTag"
  | "wikiTagAssignment"
  | "wikiTagConnection"
  | "noteConnection"
  | "timeMemo"
  | "calendar";

export type SyncAction = "create" | "update" | "delete";

export interface SyncQueueEntry {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  data?: unknown;
  createdAt: string;
  retryCount: number;
}

export interface SyncBatchOperation {
  entityType: SyncEntityType;
  action: SyncAction;
  entityId: string;
  data?: unknown;
  version?: number;
}

export interface SyncBatchRequest {
  operations: SyncBatchOperation[];
}

export interface SyncBatchResultItem {
  entityType: SyncEntityType;
  entityId: string;
  status: "success" | "conflict" | "error";
  serverVersion?: number;
  serverData?: unknown;
  error?: string;
}

export interface SyncBatchResponse {
  results: SyncBatchResultItem[];
  timestamp: string;
}

export interface SyncFullResponse {
  tasks: TaskNode[];
  memos: MemoNode[];
  notes: NoteNode[];
  scheduleItems: ScheduleItem[];
  routines: RoutineNode[];
  wikiTags: WikiTag[];
  wikiTagAssignments: WikiTagAssignment[];
  wikiTagConnections: WikiTagConnection[];
  noteConnections: NoteConnection[];
  timeMemos: TimeMemo[];
  calendars: CalendarNode[];
  timestamp: string;
}

export interface SyncChangesResponse {
  tasks: TaskNode[];
  memos: MemoNode[];
  notes: NoteNode[];
  scheduleItems: ScheduleItem[];
  routines: RoutineNode[];
  wikiTags: WikiTag[];
  wikiTagAssignments: WikiTagAssignment[];
  wikiTagConnections: WikiTagConnection[];
  noteConnections: NoteConnection[];
  timeMemos: TimeMemo[];
  calendars: CalendarNode[];
  timestamp: string;
  hasMore: boolean;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  timestamp: string;
}

export interface SyncStatus {
  enabled: boolean;
  lastSyncedAt: string | null;
  deviceId: string | null;
  url: string | null;
}
