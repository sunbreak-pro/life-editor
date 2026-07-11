/*
 * Kanban (K1) barrel. Pure cross-platform Tasks-board primitives + the pure
 * column builders. The host (web/electron/capacitor) maps its TaskNode set
 * → KanbanColumnModel[] via the builders and injects copy (§6.4).
 */
export { KanbanBoard, type KanbanBoardProps } from "./KanbanBoard";
export { KanbanColumn, type KanbanColumnProps } from "./KanbanColumn";
export { KanbanCard, type KanbanCardProps } from "./KanbanCard";
export {
  buildStatusColumns,
  buildTagColumns,
  type TagsByTask,
} from "./buildColumns";
export { KANBAN_COLOR_PRESETS } from "./colors";
export {
  readKanbanViewMode,
  persistKanbanViewMode,
  isKanbanViewMode,
} from "./viewModeStorage";
export type {
  KanbanCardModel,
  KanbanCardTag,
  KanbanColumnModel,
  KanbanViewMode,
  KanbanLabels,
  KanbanCardDndAdapter,
  KanbanColumnDndAdapter,
} from "./types";
