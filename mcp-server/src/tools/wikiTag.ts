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
      "Assign a wiki tag to a todo, daily, or note. Creates the tag if it doesn't exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name" },
        entity_id: { type: "string", description: "Entity ID" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note"],
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
    description: "Search for todos, dailies, and notes by wiki tag name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tag_name: { type: "string", description: "Tag name to search" },
        entity_type: {
          type: "string",
          enum: ["task", "daily", "note"],
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
