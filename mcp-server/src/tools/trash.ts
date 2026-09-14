import { defineTool, type ToolDefinition } from "./defineTool.js";
import { listTrash, restoreItem } from "../handlers/trashHandlers.js";

/**
 * Trash tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const TRASH_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_trash",
    description:
      "List what is in the trash, newest first. Every other list / search / get tool hides deleted items, " +
      "so this is the only way to see what restore_item can be pointed at. " +
      "Returns { items, hasMore }: each entry carries id, role, title, deletedAt and `restorable` " +
      "(false for a daily or a routine, which restore_item refuses).",
    inputSchema: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: ["task", "event", "routine", "note", "daily"],
          description:
            "Only this kind of item. 'task' is a todo, 'event' a schedule item. Omit for everything.",
        },
        limit: {
          type: "number",
          description:
            "Max items to return (default: 50, capped at 200). `hasMore` says whether the cap cut anything off.",
        },
      },
    },
    handler: listTrash,
  }),

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
