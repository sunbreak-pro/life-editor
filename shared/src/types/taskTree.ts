// SectionId is derived from the section registry (SSOT) — see
// shared/src/sections.ts. Re-exported here because CLAUDE.md §3.2 documents
// `types/taskTree.ts::SectionId` as the canonical reference. The 7-section
// target IA set (schedule / materials / connect / work / analytics / settings
// / trash) is defined once in the registry; the old REPL section is retired
// (§8).
export type { SectionId } from "../sections";

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
