import { describe, it, expect } from "vitest";
import { TOOLS, callTool } from "../src/tools.js";
import { unknownArgNames, type ObjectSchema } from "../src/utils/toolSchema.js";
import { isLegacyFolder } from "../src/handlers/todoHandlers.js";
import { rejection } from "./rejection.js";

/*
 * The three ways a call used to succeed at the wrong thing (#702 ②).
 *
 * None of these ever raised. `list_schedule` answered for today when asked
 * for a week, `list_todos` hid todos whose `task_type` is NULL, and an
 * argument nobody declared went in and came back out with the result looking
 * unchanged. A wrong answer that announces itself costs one round trip; one
 * that looks right costs however long it takes to notice.
 *
 * No test here may reach a handler — handlers talk to Supabase. Each
 * rejection below is proof the call stopped before that: a handler reached
 * without credentials fails with "Supabase credentials missing" instead.
 */

const schemaOf = (name: string): ObjectSchema =>
  TOOLS.find((t) => t.name === name)?.inputSchema as ObjectSchema;

describe("list_schedule no longer answers for a day you did not ask about", () => {
  it("rejects a range missing its end", async () => {
    const error = await rejection(
      callTool("list_schedule", {
        start_date: "2026-08-11",
      }),
    );

    expect(error.message).toContain("end_date is required");
    expect(error.message).not.toMatch(/Supabase/);
  });

  it("rejects a range missing its start", async () => {
    const error = await rejection(
      callTool("list_schedule", {
        end_date: "2026-08-12",
      }),
    );

    expect(error.message).toContain("start_date is required");
    expect(error.message).not.toMatch(/Supabase/);
  });

  it("rejects a single day and a range in the same call", async () => {
    const error = await rejection(
      callTool("list_schedule", {
        date: "2026-08-11",
        start_date: "2026-08-11",
        end_date: "2026-08-12",
      }),
    );

    expect(error.message).toContain("mutually exclusive");
  });

  it("still lets a bare call mean today", async () => {
    // Reaching Supabase IS the pass here: the window guard let it through.
    const error = await rejection(callTool("list_schedule", {}));
    expect(error.message).toMatch(/Supabase/);
  });

  it("says so in the schema, which is the only documentation the caller reads", () => {
    const description =
      TOOLS.find((t) => t.name === "list_schedule")?.description ?? "";
    expect(description).toMatch(/end_date/);
  });
});

describe("schedule writes check their own formats", () => {
  it("rejects a date that is not YYYY-MM-DD", async () => {
    const error = await rejection(
      callTool("create_schedule_item", {
        date: "2026/08/11",
        title: "standup",
        start_time: "09:00",
        end_time: "09:15",
      }),
    );

    expect(error.message).toMatch(/Invalid date/);
    expect(error.message).not.toMatch(/Supabase/);
  });

  it("rejects a time that is not HH:MM", async () => {
    const error = await rejection(
      callTool("create_schedule_item", {
        date: "2026-08-11",
        title: "standup",
        start_time: "9:00",
        end_time: "09:15",
      }),
    );

    expect(error.message).toMatch(/Invalid start_time/);
    expect(error.message).not.toMatch(/Supabase/);
  });

  it("checks the same formats on update", async () => {
    const error = await rejection(
      callTool("update_schedule_item", {
        id: "si-1",
        end_time: "25:00",
      }),
    );

    expect(error.message).toMatch(/Invalid end_time/);
    expect(error.message).not.toMatch(/Supabase/);
  });
});

describe("list_todos agrees with get_todo_tree about which todos exist", () => {
  /*
   * `list_todos` filtered query-side with `.eq('task_type','task')`, which
   * PostgREST also applies to NULL rows — and a NULL task_type IS a plain
   * todo (pre-#225 rows). `get_todo_tree` has always excluded the retired
   * folder type in-app, so the two tools disagreed. Both now sit on this one
   * predicate, which is why it is exported.
   */
  it("flags only the retired 'folder' value", () => {
    expect(isLegacyFolder({ task_type: "folder" })).toBe(true);
  });

  it("treats a NULL task_type as a plain todo (legacy rows survive)", () => {
    expect(isLegacyFolder({ task_type: null })).toBe(false);
  });

  it("treats 'task' as a plain todo", () => {
    expect(isLegacyFolder({ task_type: "task" })).toBe(false);
  });
});

describe("an argument nothing reads is reported, not swallowed", () => {
  it("names a misremembered argument", () => {
    // `memo` is update_schedule_item's word; update_todo's is `time_memo`.
    expect(
      unknownArgNames(schemaOf("update_todo"), { id: "t", memo: "x" }),
    ).toEqual(["memo"]);
  });

  it("says nothing when every argument is declared", () => {
    expect(
      unknownArgNames(schemaOf("update_todo"), { id: "t", title: "new" }),
    ).toEqual([]);
  });

  it("ignores the MCP protocol's own keys", () => {
    // `_meta` carries the progress token — the client's, not the caller's.
    expect(
      unknownArgNames(schemaOf("get_todo"), {
        id: "task-1",
        _meta: { progressToken: 1 },
      }),
    ).toEqual([]);
  });

  it("covers the tools #702 ③ renamed, which did not exist when this was written", () => {
    /*
     * set_schedule_complete / set_schedule_dismissed landed on main before
     * this branch merged, so they postdate the guards above. Neither takes a
     * date or a time, so the format checks have nothing to apply to — but the
     * undeclared-argument notice is wired once in callTool rather than per
     * tool, so it reaches every entry in the registry, new ones included.
     */
    expect(
      unknownArgNames(schemaOf("set_schedule_complete"), {
        id: "si-1",
        completed: true,
        date: "2026-08-11",
      }),
    ).toEqual(["date"]);
    expect(
      unknownArgNames(schemaOf("set_schedule_dismissed"), {
        id: "si-1",
        dismissed: false,
        until: "tomorrow",
      }),
    ).toEqual(["until"]);
  });

  it("reports every unknown name at once, not one per round trip", () => {
    expect(
      unknownArgNames(schemaOf("create_todo"), {
        title: "t",
        note: "a",
        due: "b",
      }),
    ).toEqual(["note", "due"]);
  });
});
