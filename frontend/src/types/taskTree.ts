export type SectionId =
  | "tasks"
  | "schedule"
  | "ideas"
  | "work"
  | "analytics"
  | "settings";

export type NodeType = "folder" | "task";
export type TaskStatus = "TODO" | "DONE";

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
  timeMemo?: string;
  updatedAt?: string;
  version?: number;
}
