export type SectionId =
  | "schedule"
  | "materials"
  | "connect"
  | "work"
  | "analytics"
  | "settings"
  | "terminal";

export type NodeType = "folder" | "task";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export const FOLDER_PAD_TOP = 0; // px – visual separator above folders in Projects section

export interface TaskNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string | null;
  order: number;
  status?: TaskStatus;
  isExpanded?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  completedAt?: string;
  scheduledAt?: string;
  scheduledEndAt?: string;
  isAllDay?: boolean;
  content?: string;
  workDurationMinutes?: number;
  color?: string;
  icon?: string;
  timeMemo?: string;
  updatedAt?: string;
  version?: number;
  folderType?: "normal" | "complete";
  originalParentId?: string | null;
  priority?: 1 | 2 | 3 | 4 | null;
  reminderEnabled?: boolean;
  reminderOffset?: number;
}
