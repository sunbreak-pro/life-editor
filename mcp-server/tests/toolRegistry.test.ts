import { describe, it, expect } from "vitest";
import { TOOLS, callTool } from "../src/tools.js";
import {
  validateToolArgs,
  type JsonSchema,
  type ObjectSchema,
} from "../src/utils/toolSchema.js";

/*
 * The tool registry and its argument validator (#669 / core-refactor C2).
 *
 * Two things are pinned here.
 *
 * 1. Every tool the server advertises is dispatchable AND validated. The old
 *    dispatcher was a hand-written `switch`, so a tool could be published in
 *    the TOOLS array and still answer "Unknown tool" — the registry exists to
 *    make that impossible, and this proves it for every entry rather than for
 *    a list someone remembered to update.
 *
 * 2. The validator is neither too loose (an argument the schema forbids must
 *    not reach a handler, where it turns into a confusing Supabase error or a
 *    bad write) nor too strict (every shape the published schema allows must
 *    still be accepted — a validator that rejects what Claude Code sends is a
 *    regression dressed up as safety).
 *
 * No test here may reach a handler: handlers talk to Supabase. The rejection
 * assertions double as the proof — a handler reached without credentials
 * fails with "Supabase credentials missing", so a message that is instead an
 * "Invalid arguments" one is evidence the call stopped at the gate.
 */

const schemaOf = (name: string): ObjectSchema =>
  TOOLS.find((t) => t.name === name)?.inputSchema as ObjectSchema;

/** A value of the wrong type for `schema`, whatever type that is. */
function wrongTypedValue(schema: JsonSchema): unknown {
  return schema.type === "string" ? 1 : "not-the-right-type";
}

describe("registry structure", () => {
  it("publishes uniquely named tools", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((n) => n.length > 0)).toBe(true);
  });

  it("only marks properties it actually declares as required", () => {
    for (const tool of TOOLS) {
      const schema = tool.inputSchema as ObjectSchema;
      for (const name of schema.required ?? []) {
        expect(
          Object.keys(schema.properties ?? {}),
          `${tool.name}.${name} is required but undeclared`,
        ).toContain(name);
      }
    }
  });
});

describe("every published tool is registered and validated", () => {
  it.each(TOOLS.map((t) => t.name))(
    "%s rejects a wrong-typed argument instead of dispatching",
    async (name) => {
      const schema = schemaOf(name);
      const [property, propertySchema] = Object.entries(
        schema.properties ?? {},
      )[0];

      const error = await callTool(name, {
        [property]: wrongTypedValue(propertySchema),
      }).catch((e: unknown) => e as Error);

      expect(error).toBeInstanceOf(Error);
      // Not "Unknown tool" — the entry is wired to a handler.
      expect(error.message).toMatch(
        new RegExp(`^Invalid arguments for ${name}: `),
      );
      // Not "Supabase credentials missing" — the handler never ran.
      expect(error.message).not.toMatch(/Supabase/);
      expect(error.message).toContain(property);
    },
  );

  it("still reports an unregistered name as an unknown tool", async () => {
    await expect(callTool("no_such_tool", {})).rejects.toThrow(
      "Unknown tool: no_such_tool",
    );
  });
});

describe("invalid arguments never reach a handler", () => {
  it("rejects a missing required argument", async () => {
    await expect(callTool("create_task", {})).rejects.toThrow(
      "Invalid arguments for create_task: title is required",
    );
  });

  it("rejects an explicit null where a value is required", async () => {
    await expect(callTool("get_task", { id: null })).rejects.toThrow(
      "Invalid arguments for get_task: id is required",
    );
  });

  it("rejects a value outside an enum", async () => {
    await expect(
      callTool("list_tasks", { status: "almost_done" }),
    ).rejects.toThrow(/status must be one of/);
  });

  it("rejects a badly shaped nested object", async () => {
    await expect(
      callTool("list_tasks", { date_range: { start: "2026-08-11" } }),
    ).rejects.toThrow("date_range.end is required");
  });

  it("rejects a badly typed array element", async () => {
    await expect(
      callTool("write_briefing", { focus: "ship it", paragraphs: ["ok", 7] }),
    ).rejects.toThrow("paragraphs[1] must be a string");
  });

  it("reports every problem in one message", async () => {
    const error = await callTool("create_schedule_item", {
      date: 2026,
      start_time: 9,
    }).catch((e: unknown) => e as Error);

    expect(error.message).toContain("date must be a string");
    expect(error.message).toContain("start_time must be a string");
    expect(error.message).toContain("title is required");
  });
});

/*
 * Minimal-and-then-some arguments for every tool, in the shape a caller
 * actually sends. If the validator ever grows stricter than the schema it
 * enforces, this is the table that goes red.
 */
const VALID_CALLS: Array<[string, Record<string, unknown>]> = [
  ["list_tasks", {}],
  [
    "list_tasks",
    {
      status: "in_progress",
      date_range: { start: "2026-08-01", end: "2026-08-31" },
      parent_id: "task-1",
      include_content: true,
      limit: 10,
    },
  ],
  ["get_task", { id: "task-1" }],
  ["create_task", { title: "write the thing" }],
  [
    "create_task",
    {
      title: "write the thing",
      parent_id: "task-0",
      scheduled_at: "2026-08-11T09:00:00Z",
      scheduled_end_at: "2026-08-11T10:00:00Z",
      is_all_day: false,
      status: "in_progress",
      content: "# notes",
    },
  ],
  [
    "update_task",
    { id: "task-1", status: "done", content: "# done", time_memo: "朝イチ" },
  ],
  ["delete_task", { id: "task-1" }],
  ["get_daily", { date: "2026-08-11" }],
  ["upsert_daily", { date: "2026-08-11", content: "hello" }],
  ["list_notes", {}],
  ["list_notes", { query: "refactor", include_content: true, limit: 10 }],
  ["get_note", { id: "note-1" }],
  ["create_note", { title: "note", content: "body" }],
  ["update_note", { id: "note-1", color: "#E8D5F5" }],
  ["list_schedule", { start_date: "2026-08-11", end_date: "2026-08-12" }],
  [
    "create_schedule_item",
    {
      date: "2026-08-11",
      title: "standup",
      start_time: "09:00",
      end_time: "09:15",
      is_all_day: false,
      memo: "daily",
    },
  ],
  [
    "create_schedule_item",
    { date: "2026-08-11", title: "day off", is_all_day: true },
  ],
  ["update_schedule_item", { id: "si-1", is_all_day: true }],
  ["delete_schedule_item", { id: "si-1" }],
  ["set_schedule_complete", { id: "si-1", completed: true }],
  ["set_schedule_dismissed", { id: "si-1", dismissed: false }],
  ["get_today_context", {}],
  ["write_briefing", { focus: "one thing", paragraphs: ["a", "b"] }],
  ["search_all", { query: "q", domains: ["tasks", "notes"], limit: 5 }],
  [
    "generate_content",
    {
      target: "note",
      title: "generated",
      structure: [
        { type: "heading", level: 2, text: "Heading" },
        { type: "bulletList", items: ["one", "two"] },
        {
          type: "taskList",
          tasks: [{ text: "do it", checked: false }],
        },
        {
          type: "callout",
          color: "blue",
          iconName: "Lightbulb",
          content: [{ type: "paragraph", text: "nested" }],
        },
        { type: "codeBlock", code: "const a = 1;", language: "typescript" },
        {
          type: "table",
          headers: ["a", "b"],
          rows: [
            ["1", "2"],
            ["3", "4"],
          ],
        },
      ],
    },
  ],
  ["list_wiki_tags", { query: "life" }],
  [
    "tag_entity",
    { tag_name: "life", entity_id: "task-1", entity_type: "task" },
  ],
  ["search_by_tag", { tag_name: "life" }],
  ["get_task_tree", { root_id: "task-1", include_done: false, max_depth: 2 }],
  ["get_entity_tags", { entity_id: "task-1" }],
  [
    "format_content",
    {
      target: "daily",
      target_date: "2026-08-11",
      operations: [
        { action: "add_heading", level: 2, text: "朝刊", position: "start" },
        { action: "wrap_callout", iconName: "Sun", color: "yellow" },
        { action: "insert_block", block: { type: "paragraph", text: "x" } },
        { action: "replace_all", structure: [{ type: "paragraph" }] },
      ],
    },
  ],
];

describe("valid arguments pass", () => {
  it.each(VALID_CALLS)("%s accepts %j", (name, args) => {
    expect(() => validateToolArgs(name, schemaOf(name), args)).not.toThrow();
  });

  it("ignores properties the schema does not declare", () => {
    expect(() =>
      validateToolArgs("get_task", schemaOf("get_task"), {
        id: "task-1",
        _meta: { progressToken: 1 },
      }),
    ).not.toThrow();
  });

  it("treats an explicit null on an optional property as unset", () => {
    expect(() =>
      validateToolArgs("update_note", schemaOf("update_note"), {
        id: "note-1",
        color: null,
      }),
    ).not.toThrow();
  });
});
