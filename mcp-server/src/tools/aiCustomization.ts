import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  addAiMemory,
  createAiSkill,
  getAiRules,
  getAiSkill,
  listAiMemories,
  listAiSkills,
  updateAiMemory,
  updateAiSkill,
} from "../handlers/aiCustomizationHandlers.js";

const SLUG_TEXT =
  "kebab-case (lowercase letters and digits joined by single hyphens), at most 64 characters";

/**
 * Claude customization tools (#2121). What the user keeps for Claude in
 * Life Editor — rules, memories and Claude skills — readable here, and
 * memories / skills writable so what Claude learns reaches the phone. No tool
 * deletes; the rules are read-only (aiCustomizationHandlers.ts says why).
 */
export const AI_CUSTOMIZATION_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "get_ai_rules",
    description:
      "Read the user's rules for Claude — the instructions they keep in Life Editor, which the app writes out " +
      "as CLAUDE.md when it launches Claude Code. Read-only: the user edits the rules in the app. " +
      "Returns { body, updatedAt } (body is empty and updatedAt null when nothing is saved).",
    inputSchema: { type: "object" as const, properties: {} },
    handler: getAiRules,
  }),

  defineTool({
    name: "list_ai_memories",
    description:
      "List every memory the user keeps for Claude, in their order. A memory is one short item worth " +
      "remembering across sessions. Check this before add_ai_memory so the same fact is not stored twice.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: listAiMemories,
  }),

  defineTool({
    name: "add_ai_memory",
    description:
      "Record one thing worth remembering across sessions (a preference, a decision, a fact about the user's " +
      "work) as a new memory at the end of the list. One fact per call, at most 1000 characters. " +
      "It syncs to the user's other devices at once. To correct an existing memory use update_ai_memory instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        body: {
          type: "string",
          description: "The memory, as plain text (at most 1000 characters)",
        },
      },
      required: ["body"],
    },
    handler: addAiMemory,
  }),

  defineTool({
    name: "update_ai_memory",
    description:
      "Rewrite one memory (id from list_ai_memories). The whole text is replaced; at most 1000 characters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Memory ID" },
        body: { type: "string", description: "The new text" },
      },
      required: ["id", "body"],
    },
    handler: updateAiMemory,
  }),

  defineTool({
    name: "list_ai_skills",
    description:
      "List the Claude skills (SKILL.md) the user keeps in Life Editor — name and description only. " +
      "Use get_ai_skill for one skill's body.",
    inputSchema: { type: "object" as const, properties: {} },
    handler: listAiSkills,
  }),

  defineTool({
    name: "get_ai_skill",
    description:
      "Read one Claude skill by name: { id, slug, description, body, ... }.",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: "The skill's name" },
      },
      required: ["slug"],
    },
    handler: getAiSkill,
  }),

  defineTool({
    name: "create_ai_skill",
    description:
      "Save a new Claude skill to Life Editor — a reusable procedure, kept as the parts of a SKILL.md. " +
      "Use this instead of writing a SKILL.md file: the app writes the file out the next time it launches " +
      "Claude Code, and the user sees the skill on their phone at once. " +
      `The name is ${SLUG_TEXT}, and must not already be used (list_ai_skills). ` +
      "The description is one line (at most 1024 characters) saying when to use the skill; the body is " +
      "Markdown without frontmatter (at most 40000 characters).",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: {
          type: "string",
          description: `The skill's name — ${SLUG_TEXT}`,
        },
        description: {
          type: "string",
          description: "One line: what the skill does and when to use it",
        },
        body: {
          type: "string",
          description:
            "The instructions, as Markdown without the --- frontmatter (default: empty)",
        },
      },
      required: ["slug", "description"],
    },
    handler: createAiSkill,
  }),

  defineTool({
    name: "update_ai_skill",
    description:
      "Change a Claude skill, found by its current name. Only provide the fields you want to change; " +
      "new_slug renames it (same rules as create_ai_skill).",
    inputSchema: {
      type: "object" as const,
      properties: {
        slug: { type: "string", description: "The skill's current name" },
        new_slug: {
          type: "string",
          description: `A new name — ${SLUG_TEXT}`,
        },
        description: {
          type: "string",
          description: "A new one-line description",
        },
        body: {
          type: "string",
          description: "New Markdown body (replaces the whole body)",
        },
      },
      required: ["slug"],
    },
    handler: updateAiSkill,
  }),
];
