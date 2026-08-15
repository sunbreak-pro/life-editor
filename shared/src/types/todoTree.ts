// SectionId is derived from the section registry (SSOT) — see
// shared/src/sections.ts. Re-exported here because CLAUDE.md §3.2 documents
// `types/todoTree.ts::SectionId` as the canonical reference. The 7-section
// target IA set (schedule / materials / connect / work / analytics / settings
// / trash) is defined once in the registry; the old REPL section is retired
// (§8).
export type { SectionId } from "../sections";

// life-tags S3 (2026-07-11 #225): the Todos domain no longer has a folder
// node type — status = DONE succeeded folder-grouping (S1), and calendars
// rebound to tags (S2). TodoNodeType is now single-valued; the DB columns
// (task_type / folder_type / original_parent_id) survive for rollback and
// legacy-row detection (see todoMapper + SupabaseDataService fetch filter),
// but they no longer surface as TodoNode fields. The Notes side followed in
// #375 (NoteNodeType is single-valued too), so the interim asymmetry is gone.
export type TodoNodeType = "task";
export type TodoStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export interface TodoNode {
  id: string;
  type: TodoNodeType;
  title: string;
  parentId: string | null;
  order: number;
  status?: TodoStatus;
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
  priority?: 1 | 2 | 3 | 4 | null;
  reminderEnabled?: boolean;
  reminderOffset?: number;
}
