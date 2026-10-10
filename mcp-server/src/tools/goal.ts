import { defineTool, type ToolDefinition } from "./defineTool.js";
import {
  createGoal,
  deleteGoal,
  linkGoalTodo,
  listGoals,
  unlinkGoalTodo,
  updateGoal,
} from "../handlers/goalHandlers.js";

const PERIOD_KIND = {
  type: "string" as const,
  enum: ["year", "month", "week"],
};

const PERIOD_KEY_TEXT =
  "year = YYYY, month = YYYY-MM, week = the week's Sunday as YYYY-MM-DD (weeks run Sunday to Saturday)";

/**
 * Goal tools (#2104). Briefing goals are linked to todos, and whether a goal
 * is achieved is worked out from those links on every read — never stored.
 */
export const GOAL_TOOLS: ToolDefinition[] = [
  defineTool({
    name: "list_goals",
    description:
      "List the Briefing goals (目標) of a period, each with its progress and whether it is achieved. " +
      "Without period_kind: the year, month and week goals of `date` (default today). " +
      "Each goal carries `achievement` { achieved, via: links|manual|period_end|null, connected, todos {done,total}, children {achieved,total} } " +
      "and `todos`, the live todos linked directly to it. A week goal is achieved when every linked todo is done; " +
      "a month / year goal when every child goal is achieved and every directly linked todo is done.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "A day in YYYY-MM-DD (default: today in local time). Picks the periods it falls in.",
        },
        period_kind: {
          ...PERIOD_KIND,
          description:
            "Only this one period kind (of `date`, or of period_key)",
        },
        period_key: {
          type: "string",
          description: `An explicit period key — needs period_kind. ${PERIOD_KEY_TEXT}`,
        },
      },
    },
    handler: listGoals,
  }),

  defineTool({
    name: "create_goal",
    description:
      "Create a Briefing goal for a period. At most 3 live goals per period — the call fails on a fourth " +
      "(a goal answered 'dropped' still counts; delete_goal frees the slot). " +
      "A goal's parent is one level up only (a week goal's parent is a month goal, a month goal's a year goal). " +
      "Link todos to it afterwards with link_goal_todo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Goal title" },
        period_kind: { ...PERIOD_KIND, description: "Which kind of period" },
        period_key: {
          type: "string",
          description: `The period (default: the one \`date\` falls in). ${PERIOD_KEY_TEXT}`,
        },
        date: {
          type: "string",
          description:
            "A day in YYYY-MM-DD whose period to use when period_key is omitted (default: today)",
        },
        parent_id: {
          type: "string",
          description: "Parent goal ID, one level up (optional)",
        },
        carried_from_id: {
          type: "string",
          description:
            "The goal this one carries over from, after update_goal set that one's period_end_decision to 'carried' (optional)",
        },
      },
      required: ["title", "period_kind"],
    },
    handler: createGoal,
  }),

  defineTool({
    name: "update_goal",
    description:
      "Update a goal. Only provide fields you want to change; the period itself cannot change (carry over instead). " +
      "manual_achieved marks achievement by hand and is refused while the goal is connected to todos or child goals — " +
      "those decide it. Once the goal's period has ended, period_end_decision records the review answer: " +
      "'achieved' counts the goal as achieved whatever its todos say, 'carried' and 'dropped' do not. " +
      "A decision is refused while the period is still running; null, which clears it, is always allowed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Goal ID" },
        title: { type: "string", description: "New title" },
        parent_id: {
          type: "string",
          description: "New parent goal ID, one level up. Pass null to clear.",
        },
        sort_order: {
          type: "number",
          description: "Position among the period's goals (lower comes first)",
        },
        manual_achieved: {
          type: "boolean",
          description:
            "true = achieved by hand (unconnected goals only), false = clear the hand mark",
        },
        period_end_decision: {
          type: "string",
          enum: ["carried", "dropped", "achieved"],
          description:
            "The end-of-period answer; its time is recorded. Pass null to clear.",
        },
      },
      required: ["id"],
    },
    handler: updateGoal,
  }),

  defineTool({
    name: "delete_goal",
    description:
      "Soft-delete a goal (moves to trash). Its child goals and todo links are left as they are. Undo with restore_item.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Goal ID" },
      },
      required: ["id"],
    },
    handler: deleteGoal,
  }),

  defineTool({
    name: "link_goal_todo",
    description:
      "Link a todo to a goal, so the todo counts towards the goal's achievement. " +
      "Linking a pair that is already linked is a no-op. Returns the goal with its updated progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string", description: "Goal ID" },
        todo_id: { type: "string", description: "Todo ID" },
      },
      required: ["goal_id", "todo_id"],
    },
    handler: linkGoalTodo,
  }),

  defineTool({
    name: "unlink_goal_todo",
    description:
      "Remove the link between a todo and a goal. The todo itself is untouched; an absent link is a no-op. " +
      "Returns the goal with its updated progress.",
    inputSchema: {
      type: "object" as const,
      properties: {
        goal_id: { type: "string", description: "Goal ID" },
        todo_id: { type: "string", description: "Todo ID" },
      },
      required: ["goal_id", "todo_id"],
    },
    handler: unlinkGoalTodo,
  }),
];
