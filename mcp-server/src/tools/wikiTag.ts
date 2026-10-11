import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  listWikiTags,
  tagEntity,
  untagEntity,
  searchByTag,
  getEntityTags,
} from "../handlers/wikiTagHandlers.js";

/**
 * WikiTags tools (#895). One file per handler domain, so adding a tool
 * touches only its own domain instead of the middle of a 1,120-line array.
 */
export const WIKI_TAG_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_wiki_tags",
    description:
      "List all wiki tags. Tags are cross-domain labels that connect todos, dailies, and notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Filter by tag name (optional)",
        },
      },
    },
    handler: listWikiTags,
  }),

  defineTool({
    name: "tag_entity",
    description:
      "Assign a wiki tag to a todo, daily, note, or note table. Creates the tag if it doesn't exist. " +
      "A note table is an item only once it has been tagged in the app (its id comes from search_by_tag); " +
      "this tool cannot turn a table that has never been tagged into an item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note", "table"],
          description:
            "Entity type (optional). The real type is read from the item; supplying it asserts the item is of that type.",
        },
      },
      required: ["tag_name", "entity_id"],
    },
    handler: tagEntity,
  }),

  defineTool({
    name: "untag_entity",
    description:
      "Remove a wiki tag from a todo, daily, or note. Only this assignment goes away — the tag itself, and its other assignments, stay. " +
      "Removing a tag that is not assigned is a no-op, not an error.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
      },
      required: ["tag_name", "entity_id"],
    },
    handler: untagEntity,
  }),

  defineTool({
    name: "search_by_tag",
    description:
      "Search for todos, dailies, notes, and note tables by wiki tag name. " +
      "A note table (entityType 'table') lives inside a note's body: its entity carries parentNoteId and parentNoteTitle, " +
      "and get_note on parentNoteId reads the table's cells. An unnamed table has the title 'Untitled table'. " +
      "Tables whose note is in the trash are left out.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name to search" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note", "table"],
          description: "Filter by entity type (optional)",
        },
      },
      required: ["tag_name"],
    },
    handler: searchByTag,
  }),

  defineTool({
    name: "get_entity_tags",
    description:
      "Get all wiki tags assigned to a specific entity (todo, daily, or note).",
    inputSchema: {
      type: "object" as const,
      properties: {
        entity_id: {
          type: "string",
          description: "Entity ID (todo, daily, or note)",
        },
      },
      required: ["entity_id"],
    },
    handler: getEntityTags,
  }),
];
