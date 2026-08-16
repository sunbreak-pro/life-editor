import { defineTool, type ToolDefinition } from "./defineTool.js";
import { restoreItem } from "../handlers/trashHandlers.js";

/**
 * Trash tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const TRASH_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "restore_item",
    description:
      "Restore an item from the trash — the inverse of delete_todo / delete_note / delete_schedule_item. " +
      "Restorable roles: todo, note, event (schedule item); a daily comes back through upsert_daily instead. " +
      "Restoring an item that is not in the trash is a no-op, not an error. " +
      "Restores the one item only — a todo whose parent is still trashed stays out of get_todo_tree (it does appear in list_todos).",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "ID of the trashed todo, note or schedule item",
        },
      },
      required: ["id"],
    },
    handler: restoreItem,
  }),
];
