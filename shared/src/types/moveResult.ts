// #418: `target_is_task` / `parent_is_task` were retired together with the
// nesting chain (moveNodeInto + moveNode's re-parent branch). Both only ever
// meant "the drop target is not a folder", and folders went away in #225.
export type MoveRejectionReason =
  | "node_not_found"
  | "circular_reference"
  | "already_in_target"
  | "deleted_node";

export type MoveResult =
  { success: true } | { success: false; reason: MoveRejectionReason };
