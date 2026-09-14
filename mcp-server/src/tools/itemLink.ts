import { defineTool, type ToolDefinition } from "./defineTool.js";
import { linkItems, unlinkItems } from "../handlers/itemLinkHandlers.js";

/**
 * Item link tools — the write half of what `get_note_context` reads.
 * One file per handler domain, like every other domain here (#895).
 */
export const ITEM_LINK_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "link_items",
    description:
      "Link one item to another (the same edge a '[[…]]' in a body makes). " +
      "Works between any two items — todo, note, schedule item, daily — because ids are unique across kinds. " +
      "The link is DIRECTIONAL: from_id gains an outgoing link, to_id gains a backlink. " +
      "Read them back with get_note_context. Linking an already-linked pair is a no-op, not an error.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_id: {
          type: "string",
          description: "ID of the item the link points FROM",
        },
        to_id: {
          type: "string",
          description: "ID of the item the link points TO",
        },
      },
      required: ["from_id", "to_id"],
    },
    handler: linkItems,
  }),

  defineTool({
    name: "unlink_items",
    description:
      "Remove the link from one item to another — the inverse of link_items. " +
      "Direction matters: this removes from_id → to_id and leaves any link pointing the other way alone. " +
      "Removing a link that is not there is a no-op, not an error.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_id: {
          type: "string",
          description: "ID of the item the link points FROM",
        },
        to_id: {
          type: "string",
          description: "ID of the item the link points TO",
        },
      },
      required: ["from_id", "to_id"],
    },
    handler: unlinkItems,
  }),
];
