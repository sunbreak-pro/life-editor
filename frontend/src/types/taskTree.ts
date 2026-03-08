export type SectionId =
  | "tasks"
  | "memo"
  | "work"
  | "analytics"
  | "trash"
  | "settings";

export type NodeType = "folder" | "task";
export type TaskStatus = "TODO" | "DONE";

export const MAX_FOLDER_DEPTH = 5;
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
}
