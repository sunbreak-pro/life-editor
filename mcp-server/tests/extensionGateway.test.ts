// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  type QueryCall,
  type SupabaseStub,
} from "./supabaseStub.js";

/*
 * A client that answers any one-row read with a row carrying every column any
 * handler formats, and any collection read with nothing. It exists so a CREATE
 * can run to its end: the handler inserts, reads the row back and formats it,
 * and the stub does not apply writes (see supabaseStub.ts). What these suites
 * then check is the handler's own refusals and the SHAPE it returns — not the
 * database.
 */
const ANY_ROW = {
  id: "item-1",
  item_id: "item-1",
  role: "event",
  title: "Renewal",
  is_deleted: false,
  deleted_at: null,
  created_at: "2026-10-10T00:00:00Z",
  updated_at: "2026-10-10T00:00:00Z",
  start_at: "2026-10-10",
  start_time: "09:00",
  end_time: "09:15",
  is_all_day: false,
  done: false,
  completed_at: null,
  is_dismissed: false,
  memo: null,
  routine_item_id: null,
  source_date: null,
  task_type: "task",
  parent_item_id: null,
  sort_order: 0,
  status: null,
  scheduled_at: null,
  scheduled_end_at: null,
  time_memo: null,
  content: null,
  content_json: null,
  note_type: null,
  is_pinned: false,
  color: null,
  has_password: false,
};

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const anyRow = (call: QueryCall): unknown => (call.single ? ANY_ROW : []);

// Dynamic on purpose: a static import would be hoisted above vi.mock.
const gateway = await import("../src/extensionGateway.js");
const { remoteRegistry } = await import("../src/remoteTools.js");
const { VERIFICATION_TOOLS } = await import("../src/tools/verification.js");
const { validateToolArgs } = await import("../src/utils/toolSchema.js");
const { rejection } = await import("./rejection.js");

import type { GatewaySpec, GatewayToolSpec } from "../src/extensionGateway.js";

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(here, "../spec/extension-gateway.json");
const CATALOG_PATH = resolve(
  here,
  "../../shared/src/generated/mcpToolCatalog.json",
);

const committed = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as GatewaySpec;
const REGEN =
  "run `cd mcp-server && npm run gateway-spec` and commit the result";
const tool = (name: string): GatewayToolSpec => {
  const found = committed.tools.find((t) => t.name === name);
  if (!found) throw new Error(`${name} is not in the committed spec`);
  return found;
};

/**
 * What a stand-in built from the committed FILE alone would decide, with no
 * access to the repository's code: the schema's `required`, the conditional
 * rules, nothing else. This is the reader the file is written for.
 */
function problemsFromSpecFile(name: string, args: Record<string, unknown>) {
  const spec = tool(name);
  const problems: string[] = [];
  for (const key of spec.required) {
    if (args[key] === undefined || args[key] === null) {
      problems.push(`${key} is required`);
    }
  }
  for (const rule of spec.conditionalRequired) {
    if (args[rule.unless.field] === rule.unless.equals) continue;
    if (rule.require.some((key) => args[key] == null)) {
      problems.push(rule.message);
    }
  }
  return problems;
}

describe("spec/extension-gateway.json is the committed contract (#2144)", () => {
  it("matches what the code generates now, apart from the commit it was cut from", () => {
    const fresh = gateway.buildGatewaySpec(committed.lifeEditorCommit);
    // JSON round trip: undefined-valued keys do not exist in the file.
    expect(JSON.parse(JSON.stringify(fresh)), REGEN).toEqual(committed);
  });

  it("opens with a semver and the life-editor commit it came from", () => {
    expect(committed.gatewayVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(committed.lifeEditorCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(committed)[0]).toBe("specFormat");
    expect(Object.keys(committed).slice(1, 3)).toEqual([
      "gatewayVersion",
      "lifeEditorCommit",
    ]);
  });

  it("carries the version the code declares", () => {
    expect(committed.gatewayVersion, REGEN).toBe(
      gateway.EXTENSION_GATEWAY_VERSION,
    );
  });

  it("is a different file from the Settings catalog, which it must not change", () => {
    const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as Array<{
      name: string;
    }>;
    // Settings lists every tool; the gateway is a subset with its own shape.
    expect(catalog.length).toBeGreaterThan(committed.tools.length);
    expect(catalog[0]).not.toHaveProperty("access");
  });
});

describe("the gateway tool set", () => {
  it("is published from the remote registry's own definitions", async () => {
    for (const def of gateway.EXTENSION_TOOL_DEFINITIONS) {
      const same = remoteRegistry.tools.find((t) => t.name === def.name);
      expect(same, `${def.name} must be a remote tool`).toBeDefined();
      expect(same?.inputSchema).toEqual(def.inputSchema);
    }
  });

  it("never reaches the verification harness", () => {
    const names = new Set(
      gateway.EXTENSION_TOOL_DEFINITIONS.map((t) => t.name),
    );
    for (const t of VERIFICATION_TOOLS) expect(names.has(t.name)).toBe(false);
  });

  it("refuses a tool outside the set by name", async () => {
    const error = await rejection(
      gateway.extensionRegistry.call("list_routines", {}),
    );
    expect(error.message).toBe("Unknown tool: list_routines");
  });

  it("states every tool's access, input, required, result and conditionals", () => {
    for (const spec of committed.tools) {
      expect(["read", "write"], spec.name).toContain(spec.access);
      expect(spec.inputSchema.type, spec.name).toBe("object");
      expect(spec.required, spec.name).toEqual(spec.inputSchema.required ?? []);
      expect(spec.result, spec.name).toBeDefined();
      if ("$ref" in spec.result) {
        const name = spec.result.$ref.replace("#/definitions/", "");
        expect(committed.definitions[name], spec.name).toBeDefined();
      }
    }
    expect(committed.transport).toHaveProperty("failure");
  });
});

describe("a condition `required` cannot say, said in the file", () => {
  it("lists the times as required unless is_all_day is true", () => {
    const spec = tool("create_schedule_item");
    // The unconditional list is exactly what a copy of `required` would hold…
    expect(spec.required).toEqual(["date", "title"]);
    // …and the rule `required` cannot hold is beside it, readable by a machine.
    expect(spec.conditionalRequired).toEqual([
      {
        require: ["start_time", "end_time"],
        unless: { field: "is_all_day", equals: true },
        message:
          "start_time and end_time are required unless is_all_day is true",
      },
    ]);
  });

  it("is the same rule the handler enforces, word for word", async () => {
    stub = createSupabaseStub(anyRow);
    const error = await rejection(
      gateway.extensionRegistry.call("create_schedule_item", {
        date: "2026-10-10",
        title: "Renewal",
      }),
    );
    expect(error.message).toBe(
      tool("create_schedule_item").conditionalRequired[0].message,
    );
  });

  it("would be missed by a stand-in that copied `required` only", () => {
    const missingTimes = { date: "2026-10-10", title: "Renewal" };
    const requiredOnly = tool("create_schedule_item").required.filter(
      (key) => (missingTimes as Record<string, unknown>)[key] === undefined,
    );
    expect(requiredOnly).toEqual([]); // SubscRecorder's stand-in said yes…
    expect(problemsFromSpecFile("create_schedule_item", missingTimes)).toEqual([
      "start_time and end_time are required unless is_all_day is true",
    ]); // …the file says no.
  });
});

describe("the file's examples run through the real validator and handlers", () => {
  const withExamples = committed.tools.filter((t) => t.examples);

  it("has examples for the tools with rules worth showing", () => {
    expect(withExamples.map((t) => t.name)).toContain("create_schedule_item");
  });

  for (const spec of withExamples) {
    describe(spec.name, () => {
      for (const [i, example] of (spec.examples?.valid ?? []).entries()) {
        it(`accepts valid example ${i + 1}`, async () => {
          stub = createSupabaseStub(anyRow);
          const def = gateway.EXTENSION_TOOL_DEFINITIONS.find(
            (d) => d.name === spec.name,
          );
          expect(() =>
            validateToolArgs(spec.name, def!.inputSchema, example.args),
          ).not.toThrow();
          expect(
            gateway.brokenConditionalRules(spec.name, example.args),
          ).toEqual([]);
          expect(problemsFromSpecFile(spec.name, example.args)).toEqual([]);
          // The handler's own checks: the call completes.
          await expect(
            gateway.extensionRegistry.call(spec.name, example.args),
          ).resolves.toBeDefined();
        });
      }

      for (const [i, example] of (spec.examples?.invalid ?? []).entries()) {
        it(`refuses invalid example ${i + 1} (${example.reason})`, async () => {
          stub = createSupabaseStub(anyRow);
          await rejection(
            gateway.extensionRegistry.call(spec.name, example.args),
          );
        });
      }
    });
  }

  it("lets the file alone catch every example that breaks a rule `required` can state or the conditional", () => {
    const caught = (tool("create_schedule_item").examples?.invalid ?? []).filter(
      (e) => problemsFromSpecFile("create_schedule_item", e.args).length > 0,
    );
    expect(caught.map((e) => e.reason)).toEqual([
      "a timed event without start_time and end_time",
      "end_time is missing too",
      "is_all_day false is the timed case",
      "date is required",
    ]);
  });
});

describe("results come back in the shape the file promises", () => {
  const kindOf = (value: unknown): string =>
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

  function expectShape(
    value: Record<string, unknown>,
    shape: {
      required?: string[];
      properties?: Record<string, { type: unknown }>;
    },
    label: string,
  ) {
    for (const key of shape.required ?? []) {
      expect(value, `${label}: ${key}`).toHaveProperty(key);
      const wanted = shape.properties?.[key]?.type;
      const kinds = Array.isArray(wanted) ? wanted : [wanted];
      expect(kinds, `${label}.${key} is ${kindOf(value[key])}`).toContain(
        kindOf(value[key]),
      );
    }
  }

  async function run(name: string, args: Record<string, unknown>) {
    stub = createSupabaseStub(anyRow);
    const { content } = await gateway.extensionRegistry.call(name, args);
    return JSON.parse(content[0].text) as Record<string, unknown>;
  }

  it("create_schedule_item → definitions.scheduleItem", async () => {
    const result = await run("create_schedule_item", {
      date: "2026-10-10",
      title: "Renewal",
      start_time: "09:00",
      end_time: "09:15",
    });
    expectShape(result, committed.definitions.scheduleItem, "scheduleItem");
  });

  it("create_todo → definitions.todo", async () => {
    const result = await run("create_todo", { title: "Cancel the trial" });
    expectShape(result, committed.definitions.todo, "todo");
  });

  it("create_note → definitions.note", async () => {
    const result = await run("create_note", { title: "Subscriptions" });
    expectShape(result, committed.definitions.note, "note");
  });

  it("the list tools answer the keys the file names", async () => {
    for (const name of ["list_todos", "list_notes", "list_schedule"]) {
      const result = await run(name, {});
      expectShape(result, tool(name).result as never, name);
    }
  });
});

describe("what a change means for the version", () => {
  const base = (): GatewaySpec =>
    JSON.parse(JSON.stringify(gateway.buildGatewaySpec("0".repeat(40))));
  const toolOf = (spec: GatewaySpec, name: string) =>
    spec.tools.find((t) => t.name === name)!;

  it("reads an unchanged spec as nothing to bump", () => {
    expect(gateway.classifySpecChange(base(), base())).toBe("none");
  });

  it("calls a removed tool breaking", () => {
    const next = base();
    next.tools = next.tools.filter((t) => t.name !== "delete_note");
    expect(gateway.classifySpecChange(base(), next)).toBe("major");
  });

  it("calls a new required argument breaking", () => {
    const next = base();
    toolOf(next, "create_note").required.push("content");
    expect(gateway.classifySpecChange(base(), next)).toBe("major");
  });

  it("calls a new conditional rule breaking", () => {
    const next = base();
    toolOf(next, "create_todo").conditionalRequired.push({
      require: ["scheduled_at"],
      unless: { field: "is_all_day", equals: false },
      message: "scheduled_at is required",
    });
    expect(gateway.classifySpecChange(base(), next)).toBe("major");
  });

  it("calls a removed property breaking and a narrowed enum breaking", () => {
    const removed = base();
    delete (
      toolOf(removed, "create_note").inputSchema.properties as object as Record<
        string,
        unknown
      >
    ).content;
    expect(gateway.classifySpecChange(base(), removed)).toBe("major");

    const narrowed = base();
    (
      toolOf(narrowed, "create_todo").inputSchema.properties as Record<
        string,
        { enum?: string[] }
      >
    ).status.enum = ["done"];
    expect(gateway.classifySpecChange(base(), narrowed)).toBe("major");
  });

  it("calls a new optional property or a new tool an addition", () => {
    const optional = base();
    (
      toolOf(optional, "create_note").inputSchema.properties as Record<
        string,
        unknown
      >
    ).emoji = { type: "string" };
    expect(gateway.classifySpecChange(base(), optional)).toBe("minor");

    const added = base();
    added.tools = added.tools.filter((t) => t.name !== "delete_note");
    expect(gateway.classifySpecChange(added, base())).toBe("minor");
  });

  it("calls a reworded description a patch", () => {
    const next = base();
    toolOf(next, "get_note").description += " (reworded)";
    expect(gateway.classifySpecChange(base(), next)).toBe("patch");
  });

  it("calls a dropped result key breaking", () => {
    const next = base();
    next.definitions.todo.required = next.definitions.todo.required!.filter(
      (k) => k !== "contentText",
    );
    expect(gateway.classifySpecChange(base(), next)).toBe("major");
  });

  it("measures a version move", () => {
    expect(gateway.versionBump("1.0.0", "1.0.0")).toBe("none");
    expect(gateway.versionBump("1.0.0", "1.0.1")).toBe("patch");
    expect(gateway.versionBump("1.0.9", "1.1.0")).toBe("minor");
    expect(gateway.versionBump("1.4.2", "2.0.0")).toBe("major");
    expect(gateway.versionBump("2.0.0", "1.9.9")).toBe("downgrade");
  });
});
