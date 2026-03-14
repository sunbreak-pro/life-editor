export type MoveRejectionReason =
  | "node_not_found"
  | "target_is_task"
  | "circular_reference"
  | "already_in_target"
  | "parent_is_task";

export type MoveResult =
  | { success: true }
  | { success: false; reason: MoveRejectionReason };
