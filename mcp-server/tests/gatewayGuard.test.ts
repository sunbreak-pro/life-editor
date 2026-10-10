// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSupabaseStub, type SupabaseStub } from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const guard = await import("../src/gatewayGuard.js");
const { runAs } = await import("../src/callerContext.js");
const { EXTENSION_TOOL_ACCESS, extensionRegistry } =
  await import("../src/extensionGateway.js");
const { rejection } = await import("./rejection.js");

/*
 * The write guard's invariants (#2146). The Worker-level behaviour is in
 * gatewayWorker.test.ts; these are the ones that hold whatever the Worker does.
 */

const TODO_ROW = {
  id: "item-1",
  item_id: "item-1",
  title: "x",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-10-10T00:00:00Z",
  updated_at: "2026-10-10T00:00:00Z",
  parent_item_id: null,
  task_type: "task",
  sort_order: 0,
  status: null,
  scheduled_at: null,
  scheduled_end_at: null,
  is_all_day: false,
  time_memo: null,
  content: null,
  completed_at: null,
};

describe("every write tool is accounted for", () => {
  const writeTools = Object.entries(
    EXTENSION_TOOL_ACCESS as Record<string, string>,
  )
    .filter(([, access]) => access === "write")
    .map(([name]) => name);

  it("is either a create or checked against the item it names", () => {
    for (const name of writeTools) {
      const accounted =
        guard.CREATE_TOOLS.includes(name) || name in guard.OWNED_ITEM_ARG;
      expect(
        accounted,
        `${name} is a write tool in the extension set but neither a create ` +
          `nor in OWNED_ITEM_ARG, so an app could change another app's item with it`,
      ).toBe(true);
    }
  });

  it("lists every id-like argument of a create tool that points at an item", async () => {
    const { EXTENSION_TOOL_DEFINITIONS } =
      await import("../src/extensionGateway.js");
    for (const name of guard.CREATE_TOOLS) {
      const def = EXTENSION_TOOL_DEFINITIONS.find((d) => d.name === name);
      const idArgs = Object.keys(def?.inputSchema.properties ?? {}).filter(
        (key) => key === "id" || key.endsWith("_id"),
      );
      for (const arg of idArgs) {
        expect(
          guard.CREATE_ITEM_ARG[name],
          `${name}.${arg} names an existing item, so a create can write into someone else's tree; list it in CREATE_ITEM_ARG`,
        ).toBe(arg);
      }
    }
  });

  it("lists no tool that is not a write tool in the set", () => {
    for (const name of [
      ...guard.CREATE_TOOLS,
      ...Object.keys(guard.OWNED_ITEM_ARG),
    ]) {
      expect(writeTools, name).toContain(name);
    }
  });

  it("names, for each checked tool, an argument its schema really has", async () => {
    const { EXTENSION_TOOL_DEFINITIONS } =
      await import("../src/extensionGateway.js");
    for (const [name, arg] of Object.entries(guard.OWNED_ITEM_ARG)) {
      const def = EXTENSION_TOOL_DEFINITIONS.find((d) => d.name === name);
      expect(Object.keys(def?.inputSchema.properties ?? {}), name).toContain(
        arg,
      );
      expect(def?.inputSchema.required, name).toContain(arg);
    }
  });
});

describe("a gateway call with no caller", () => {
  it("is refused, so a path around the Worker's auth cannot run as the owner", async () => {
    stub = createSupabaseStub();
    const error = await rejection(guard.gatewayRegistry.call("list_todos", {}));
    expect(error.message).toBe("Forbidden: no caller for this gateway call");
    expect(stub.calls).toEqual([]);
  });

  it("is the only registry that asks: the spec's own registry runs unguarded", async () => {
    stub = createSupabaseStub((call) => (call.single ? null : []));
    const error = await rejection(
      extensionRegistry.call("get_todo", { id: "x" }),
    );
    expect(error.message).toBe("Todo not found: x");
  });
});

describe("what a create stamps", () => {
  it("adds no origin when nobody is calling through the gateway", async () => {
    stub = createSupabaseStub((call) => (call.single ? TODO_ROW : []));
    await extensionRegistry.call("create_todo", { title: "x" });
    const insert = stub
      .writes()
      .find((w) => w.table === "items_meta" && w.op === "insert");
    expect(insert).toBeDefined();
    expect(insert?.values).not.toHaveProperty("origin_app");
  });

  it("stamps the caller's app when there is one", async () => {
    stub = createSupabaseStub((call) => (call.single ? TODO_ROW : []));
    await runAs(
      { app: "subscrecorder", account: "owner", scopes: ["read", "write"] },
      () => extensionRegistry.call("create_todo", { title: "x" }),
    );
    const insert = stub
      .writes()
      .find((w) => w.table === "items_meta" && w.op === "insert");
    expect(insert?.values?.origin_app).toBe("subscrecorder");
  });
});
