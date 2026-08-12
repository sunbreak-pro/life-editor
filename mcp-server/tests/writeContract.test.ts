import { describe, it, expect } from "vitest";
import { TOOLS, callTool } from "../src/tools.js";

/*
 * What the write tools ask for, and what they promise (#702 ③).
 *
 * The schema IS the documentation for this server's only caller: Claude Code
 * reads it at connect time and picks arguments from the names it finds. So a
 * field the handler writes but the schema never mentions is invisible, a
 * required field the handler throws away is a lie, and a tool named for an
 * operation ("toggle") rather than a state is an instruction the caller
 * cannot follow without first reading the row.
 *
 * No test here may reach a handler — handlers talk to Supabase. A rejection
 * that is not "Supabase credentials missing" is proof the call stopped early.
 */

const tool = (name: string) => TOOLS.find((t) => t.name === name);
const props = (name: string) =>
  (tool(name)?.inputSchema.properties ?? {}) as Record<string, unknown>;
const required = (name: string) => tool(name)?.inputSchema.required ?? [];

describe("create_task no longer needs a second call", () => {
  it("accepts the body and the status the task is created with", () => {
    expect(props("create_task")).toHaveProperty("content");
    expect(props("create_task")).toHaveProperty("status");
  });

  it("keeps status on the same vocabulary update_task uses", () => {
    const status = props("create_task").status as { enum?: string[] };
    expect(status.enum).toEqual(["not_started", "in_progress", "done"]);
  });

  it("still needs nothing but a title", () => {
    expect(required("create_task")).toEqual(["title"]);
  });
});

describe("update_task publishes the field it has always written", () => {
  it("declares time_memo", () => {
    // The handler wrote tasks_payload.time_memo all along; only the schema
    // omitted it, which made it unreachable for the caller that reads it.
    expect(props("update_task")).toHaveProperty("time_memo");
  });
});

describe("an all-day event is not asked for times it discards", () => {
  it("does not mark the times required", () => {
    expect(required("create_schedule_item")).toEqual(["date", "title"]);
  });

  it("still refuses a timed event with no times", async () => {
    const error = await callTool("create_schedule_item", {
      date: "2026-08-11",
      title: "standup",
    }).catch((e: unknown) => e as Error);

    expect(error.message).toMatch(/start_time and end_time are required/);
    expect(error.message).not.toMatch(/Supabase/);
  });

  it("says the rule in the description, where the caller will read it", () => {
    expect(tool("create_schedule_item")?.description ?? "").toMatch(
      /is_all_day/,
    );
    expect(tool("update_schedule_item")?.description ?? "").toMatch(
      /is_all_day/,
    );
  });
});

describe("the schedule state tools take a state, not a flip", () => {
  it("publishes set_schedule_complete with the value it sets", () => {
    expect(tool("set_schedule_complete")).toBeDefined();
    expect(required("set_schedule_complete")).toEqual(["id", "completed"]);
    expect(props("set_schedule_complete").completed).toMatchObject({
      type: "boolean",
    });
  });

  it("publishes set_schedule_dismissed with the value it sets", () => {
    expect(tool("set_schedule_dismissed")).toBeDefined();
    expect(required("set_schedule_dismissed")).toEqual(["id", "dismissed"]);
    expect(props("set_schedule_dismissed").dismissed).toMatchObject({
      type: "boolean",
    });
  });

  it.each([
    "toggle_schedule_complete",
    "dismiss_schedule_item",
    "undismiss_schedule_item",
  ])("no longer publishes %s", (name) => {
    // Renamed, not aliased (#419): an old name kept beside the new one is a
    // wrong instruction still on offer, and the caller picks by reading.
    expect(tool(name)).toBeUndefined();
  });

  it.each([
    "toggle_schedule_complete",
    "dismiss_schedule_item",
    "undismiss_schedule_item",
  ])("answers %s as an unknown tool", async (name) => {
    await expect(callTool(name, { id: "si-1" })).rejects.toThrow(
      `Unknown tool: ${name}`,
    );
  });

  it("will not set a completion state without being told which", async () => {
    await expect(
      callTool("set_schedule_complete", { id: "si-1" }),
    ).rejects.toThrow("completed is required");
  });
});
