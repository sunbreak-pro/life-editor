// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi, afterEach, afterAll } from "vitest";
import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createSupabaseStub,
  fromTables,
  type QueryCall,
  type StubRow,
  type StubTables,
  type SupabaseStub,
} from "./supabaseStub.js";
import {
  createFakeGateway,
  listen,
  GATEWAY_VERSION,
  LIFE_EDITOR_COMMIT,
  type FakeGateway,
  type ListeningFake,
} from "../mocks/extension-gateway-fake.mjs";
import type {
  GatewaySpec,
  GatewayToolSpec,
  ResultShape,
} from "../src/extensionGateway.js";
import type { WorkerEnv } from "../src/worker.js";

/*
 * The official fake (mocks/extension-gateway-fake.mjs, #2145) against the
 * real thing.
 *
 * Every case below runs the same arguments through the fake and through
 * `extensionRegistry.call` — the real validator and the real handlers — and
 * then through the same HTTP requests to `fake.fetch` and the Worker's
 * `fetch`. If the two disagree on whether a call succeeds, on the words of a
 * refusal, on the Note about an undeclared argument, or on the keys a result
 * carries, a test here fails. That is what lets pdca-harness trust a green run
 * against the fake.
 *
 * WHAT THE STUB CAN AND CANNOT SAY. The real side runs on tests/supabaseStub.ts,
 * which does not apply writes. Two stubs are used:
 *   - ANY_ROW (as in extensionGateway.test.ts): every one-row read answers a
 *     row with every column a handler formats, every collection read answers
 *     nothing. Good for "does it succeed / fail, and with what words", and
 *     for the top-level keys of a result. Not for list CONTENTS (always empty
 *     on the real side) or for values that depend on what was written.
 *   - `mirrorFake` (the "same state" suite): rows built from the fake's own
 *     state, run through `fromTables`. There the real handlers read exactly
 *     what the fake holds, so the read tools' whole answers are compared.
 * Where neither can reproduce the state (a write followed by a read), the case
 * compares only the outcome and the keys, and says so.
 */

/* ---- the real side ------------------------------------------------------- */

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
const REAL_ID = ANY_ROW.id;

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
  // worker.ts configures per request; nothing here may reach a network.
  configureSupabase: () => {},
  resetSupabaseForTests: () => {},
}));

// update_note's body write is an RPC; answer it the way a saved write does.
const SAVED_RPC = () => ({
  data: [{ saved: true, updated_at: "2026-10-10T00:00:01Z" }],
});

// Dynamic on purpose: a static import would be hoisted above vi.mock.
const { extensionRegistry } = await import("../src/extensionGateway.js");
const { runAs } = await import("../src/callerContext.js");
const { codeOf } = await import("../src/errorCodes.js");
const { requestHash } = await import("../src/utils/originKey.js");
const { default: worker } = await import("../src/worker.js");
const { configureTimeZone } = await import("../src/utils/localDate.js");

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(here, "../spec/extension-gateway.json");
const FAKE_PATH = resolve(here, "../mocks/extension-gateway-fake.mjs");
const committed = JSON.parse(readFileSync(SPEC_PATH, "utf8")) as GatewaySpec;

const toolSpec = (name: string): GatewayToolSpec => {
  const found = committed.tools.find((t) => t.name === name);
  if (!found) throw new Error(`${name} is not in the committed spec`);
  return found;
};

const TOKEN = "test-token-0123456789abcdef";
const ENV: WorkerEnv = {
  LIFE_EDITOR_MCP_TOKEN: TOKEN,
  LIFE_EDITOR_SUPABASE_URL: "https://example.supabase.co",
  LIFE_EDITOR_SUPABASE_ANON_KEY: "anon-key",
  LIFE_EDITOR_SUPABASE_EMAIL: "owner@example.com",
  LIFE_EDITOR_SUPABASE_PASSWORD: "not-a-real-password",
  LIFE_EDITOR_TZ: "Asia/Tokyo",
};

afterEach(() => {
  // The Worker pins the zone per request; leave none of it behind.
  configureTimeZone(null);
});

/* ---- outcomes ------------------------------------------------------------ */

type Outcome =
  { ok: true; texts: string[] } | { ok: false; message: string; code: string };
type Args = Record<string, unknown>;
/** A row override is any column ANY_ROW has, with any value (a written state). */
type RealStub =
  "anyRow" | "empty" | Partial<Record<keyof typeof ANY_ROW, unknown>>;

/**
 * What the real side finds under an idempotency_key (utils/originKey.ts reads
 * `items_meta` by origin_app + origin_key). Null = a key nobody used.
 */
interface KeyedLookup {
  role: string;
  /** The request whose hash the stored row carries. */
  madeBy?: [tool: string, args: Args];
  deleted?: boolean;
}
let keyLookup: KeyedLookup | null = null;

/**
 * What the real side finds in app_records for a one-row read (create_record's
 * external_id lookup, delete_record's owner check). Null = no such record.
 * Collection reads of app_records and extension_apps answer nothing.
 */
let recordRow: Record<string, unknown> | null = null;

function useRealStub(kind: RealStub): void {
  const rows =
    kind === "empty"
      ? () => null
      : (call: QueryCall): unknown =>
          call.single
            ? kind === "anyRow"
              ? ANY_ROW
              : { ...ANY_ROW, ...kind }
            : [];
  const select = (call: QueryCall): unknown => {
    if (call.table === "app_records" || call.table === "extension_apps") {
      return call.single ? recordRow : [];
    }
    if (call.columns?.includes("origin_request_hash")) {
      if (!keyLookup) return null;
      return {
        id: REAL_ID,
        role: keyLookup.role,
        is_deleted: keyLookup.deleted === true,
        origin_request_hash: keyLookup.madeBy
          ? requestHash(...keyLookup.madeBy)
          : null,
      };
    }
    return rows(call);
  };
  stub = createSupabaseStub(select, SAVED_RPC);
}

/** The app the real side calls as; the fake serves one app and has no name for it. */
const APP = {
  app: "parity-app",
  account: "owner",
  scopes: ["read", "write"],
} as const;

async function realOutcome(name: string, args: Args): Promise<Outcome> {
  try {
    const { content } = await runAs(APP, () =>
      extensionRegistry.call(name, args),
    );
    return { ok: true, texts: content.map((c) => c.text) };
  } catch (error) {
    return {
      ok: false,
      message: (error as Error).message,
      code: codeOf(error),
    };
  }
}

function rpcRequest(
  method: string,
  params?: Record<string, unknown>,
  path = `/mcp/${TOKEN}`,
): Request {
  return new Request(`https://mcp.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

interface ToolCallBody {
  result: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
    structuredContent?: { code: string; message: string };
  };
}

async function fakeOutcome(
  gateway: FakeGateway,
  name: string,
  args: Args,
): Promise<Outcome> {
  const res = await gateway.fetch(
    rpcRequest("tools/call", { name, arguments: args }),
  );
  const body = (await res.json()) as ToolCallBody;
  if (body.result.isError) {
    return {
      ok: false,
      message: body.result.content[0].text.replace(/^Error: /, ""),
      code: body.result.structuredContent?.code ?? "(none)",
    };
  }
  return { ok: true, texts: body.result.content.map((c) => c.text) };
}

async function fakeResult(
  gateway: FakeGateway,
  name: string,
  args: Args,
): Promise<Record<string, unknown>> {
  const outcome = await fakeOutcome(gateway, name, args);
  if (!outcome.ok) throw new Error(`fake ${name} failed: ${outcome.message}`);
  return JSON.parse(outcome.texts[0]) as Record<string, unknown>;
}

/* ---- a seeded fake ------------------------------------------------------- */

const SEED_RECORD = {
  kind: "expense",
  value: 450,
  unit: "JPY",
  occurred_at: "2026-10-11T12:10:00+09:00",
  dims: { category: "food" },
  external_id: "seed-record",
};
const REAL_RECORD_ID = "record-1";

/** The real side's app_records row for SEED_RECORD, written by APP. */
const SEED_RECORD_ROW = {
  id: REAL_RECORD_ID,
  source_app: "parity-app",
  external_id: SEED_RECORD.external_id,
  kind: SEED_RECORD.kind,
  occurred_at: "2026-10-11T03:10:00.000Z",
  value: SEED_RECORD.value,
  unit: SEED_RECORD.unit,
  dims: SEED_RECORD.dims,
  note: null,
};

interface Seeded {
  gateway: FakeGateway;
  /** Placeholder → the fake's id (or value). */
  values: Record<string, string>;
}

/** A fresh fake holding one todo (tagged "seed"), one note, one timed and one all-day event, and one record. */
async function seededFake(): Promise<Seeded> {
  const gateway = createFakeGateway({ token: TOKEN, app: APP.app });
  const todo = await fakeResult(gateway, "create_todo", { title: "Renewal" });
  const note = await fakeResult(gateway, "create_note", {
    title: "Renewal plans",
    content: "# Plans",
  });
  const event = await fakeResult(gateway, "create_schedule_item", {
    date: "2026-10-10",
    title: "Renewal",
    start_time: "09:00",
    end_time: "09:15",
  });
  const allDay = await fakeResult(gateway, "create_schedule_item", {
    date: "2026-10-10",
    title: "Holiday",
    is_all_day: true,
  });
  await fakeResult(gateway, "tag_entity", {
    tag_name: "seed",
    entity_id: todo.id,
  });
  const record = await fakeResult(gateway, "create_record", SEED_RECORD);
  return {
    gateway,
    values: {
      $todo: todo.id as string,
      $note: note.id as string,
      $event: event.id as string,
      $allDay: allDay.id as string,
      $noteUpdatedAt: note.updatedAt as string,
      $record: record.id as string,
    },
  };
}

/** The real side's stand-in for each placeholder. */
const REAL_VALUES: Record<string, string> = {
  $todo: REAL_ID,
  $note: REAL_ID,
  $event: REAL_ID,
  $allDay: REAL_ID,
  $noteUpdatedAt: ANY_ROW.updated_at,
  $record: REAL_RECORD_ID,
};

function fill(args: Args, values: Record<string, string>): Args {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      typeof value === "string" && value in values ? values[value] : value,
    ]),
  );
}

const ISO_INSTANT =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

/** Ids and instants differ between the two sides by construction; nothing else may. */
function normalize(text: string, ids: string[]): string {
  let out = text;
  for (const id of ids) out = out.split(id).join("<id>");
  return out.replace(ISO_INSTANT, "<ts>");
}

/* ---- result shapes ------------------------------------------------------- */

const kindOf = (value: unknown): string =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

function shapesFor(name: string): ResultShape[] {
  const result = toolSpec(name).result;
  if ("$ref" in result) {
    return [committed.definitions[result.$ref.replace("#/definitions/", "")]];
  }
  // "A todo (definitions.todo) plus tags."
  if (name === "get_todo") return [result, committed.definitions.todo];
  return [result];
}

/** What the spec promises about `value` that it does not hold. */
function specProblems(name: string, value: unknown): string[] {
  const problems: string[] = [];
  for (const shape of shapesFor(name)) {
    if (kindOf(value) !== shape.type) {
      problems.push(`result is ${kindOf(value)}, spec says ${shape.type}`);
      continue;
    }
    if (shape.type !== "object") continue;
    const record = value as Record<string, unknown>;
    for (const key of shape.required ?? []) {
      if (!(key in record)) {
        problems.push(`missing ${key}`);
        continue;
      }
      const wanted = shape.properties?.[key]?.type;
      const kinds = Array.isArray(wanted) ? wanted : [wanted];
      if (!kinds.includes(kindOf(record[key]) as never)) {
        problems.push(
          `${key} is ${kindOf(record[key])}, spec says ${kinds.join("|")}`,
        );
      }
    }
  }
  if (name === "list_wiki_tags" && Array.isArray(value)) {
    for (const element of value as Record<string, unknown>[]) {
      for (const key of committed.definitions.tag.required ?? []) {
        if (!(key in element)) problems.push(`tag element missing ${key}`);
      }
      if (typeof element.usageCount !== "number") {
        problems.push("tag element has no numeric usageCount");
      }
    }
  }
  return problems;
}

/**
 * Two results that must carry the same top-level keys. A kind may differ only
 * where one side holds null and the other a value — the stub's row is not the
 * fake's row, so "set" against "unset" is expected; "string" against "number"
 * never is.
 */
function expectSameTopLevel(fake: unknown, real: unknown, label: string): void {
  expect(kindOf(fake), label).toBe(kindOf(real));
  if (kindOf(fake) !== "object") return;
  const f = fake as Record<string, unknown>;
  const r = real as Record<string, unknown>;
  expect(Object.keys(f).sort(), `${label}: keys`).toEqual(
    Object.keys(r).sort(),
  );
  for (const key of Object.keys(f)) {
    const [kf, kr] = [kindOf(f[key]), kindOf(r[key])];
    if (kf === "null" || kr === "null") continue;
    expect(kf, `${label}.${key}`).toBe(kr);
  }
}

/* ---- the cases ----------------------------------------------------------- */

interface Case {
  tool: string;
  args: Args;
  /** What the real side's stub answers (default ANY_ROW). */
  real?: RealStub;
  /** Calls the fake makes first (placeholders allowed). */
  before?: Array<[string, Args]>;
  /** What the real side finds under an idempotency_key (default: nothing). */
  lookup?: KeyedLookup;
  /** The app_records row the real side's one-row reads find (default: none). */
  record?: Record<string, unknown>;
  /** The spec result check is skipped, with the reason. */
  specGap?: string;
}

const NOT_FOUND = "nope-0000";

/*
 * Retry keys (plan R5) and update/delete by external id (R6). The fake holds
 * the first call's item itself; the real side cannot (its stub applies no
 * writes), so each case says what the real lookup finds under the key.
 */
const KEYED_SCHEDULE = {
  date: "2026-10-10",
  title: "Renewal",
  is_all_day: true,
  idempotency_key: "k-schedule",
};
const KEYED_TODO = { title: "Cancel the trial", idempotency_key: "k-todo" };
const KEYED_NOTE = { title: "Plans", idempotency_key: "k-note" };

function KEYED_CASES(): Case[] {
  const made = (tool: string, args: Args): KeyedLookup["madeBy"] => [
    tool,
    args,
  ];
  return [
    // a new key creates
    { tool: "create_todo", args: KEYED_TODO },
    { tool: "create_note", args: KEYED_NOTE },
    { tool: "create_schedule_item", args: KEYED_SCHEDULE },
    { tool: "create_todo", args: { title: "x", idempotency_key: null } },
    // the same key and the same arguments is a replay
    {
      tool: "create_todo",
      args: KEYED_TODO,
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task", madeBy: made("create_todo", KEYED_TODO) },
    },
    {
      tool: "create_note",
      args: KEYED_NOTE,
      before: [["create_note", KEYED_NOTE]],
      lookup: { role: "note", madeBy: made("create_note", KEYED_NOTE) },
    },
    {
      tool: "create_schedule_item",
      args: KEYED_SCHEDULE,
      before: [["create_schedule_item", KEYED_SCHEDULE]],
      lookup: {
        role: "event",
        madeBy: made("create_schedule_item", KEYED_SCHEDULE),
      },
    },
    // null counts as absent, so this is the same request
    {
      tool: "create_todo",
      args: { ...KEYED_TODO, status: null },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task", madeBy: made("create_todo", KEYED_TODO) },
    },
    // the same key with other arguments is refused
    {
      tool: "create_todo",
      args: { ...KEYED_TODO, title: "Something else" },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task", madeBy: made("create_todo", KEYED_TODO) },
    },
    {
      tool: "create_schedule_item",
      args: { ...KEYED_SCHEDULE, date: "2026-10-11" },
      before: [["create_schedule_item", KEYED_SCHEDULE]],
      lookup: {
        role: "event",
        madeBy: made("create_schedule_item", KEYED_SCHEDULE),
      },
    },
    // ... and so is the same key for another kind of item
    {
      tool: "create_note",
      args: { title: "Plans", idempotency_key: "k-todo" },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task", madeBy: made("create_todo", KEYED_TODO) },
    },
    // a key whose item was deleted is not created again
    {
      tool: "create_todo",
      args: KEYED_TODO,
      before: [
        ["create_todo", KEYED_TODO],
        ["delete_by_external_id", { external_id: "k-todo" }],
      ],
      lookup: {
        role: "task",
        madeBy: made("create_todo", KEYED_TODO),
        deleted: true,
      },
    },
    // the reuse is reported even when the item is gone
    {
      tool: "create_todo",
      args: { ...KEYED_TODO, title: "Something else" },
      before: [
        ["create_todo", KEYED_TODO],
        ["delete_by_external_id", { external_id: "k-todo" }],
      ],
      lookup: {
        role: "task",
        madeBy: made("create_todo", KEYED_TODO),
        deleted: true,
      },
    },
    // a key outside 1-200 characters
    { tool: "create_todo", args: { title: "x", idempotency_key: "" } },
    {
      tool: "create_note",
      args: { title: "x", idempotency_key: "k".repeat(201) },
    },
    { tool: "create_note", args: { title: "x", idempotency_key: 7 } },
    // update_by_external_id
    {
      tool: "update_by_external_id",
      args: { external_id: "k-schedule", changes: { title: "Renamed" } },
      before: [["create_schedule_item", KEYED_SCHEDULE]],
      lookup: { role: "event" },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: { status: "done" } },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task" },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-note", changes: { is_pinned: true } },
      before: [["create_note", KEYED_NOTE]],
      lookup: { role: "note" },
      real: { is_pinned: true },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: { status: "started" } },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task" },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: { memo: "not a todo field" } },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task" },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: { id: "other-item" } },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task" },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: "title" },
    },
    { tool: "update_by_external_id", args: { external_id: "k-todo" } },
    {
      tool: "update_by_external_id",
      args: { external_id: "never-used", changes: { title: "x" } },
    },
    {
      tool: "update_by_external_id",
      args: { external_id: "k-todo", changes: { title: "x" } },
      before: [
        ["create_todo", KEYED_TODO],
        ["delete_by_external_id", { external_id: "k-todo" }],
      ],
      lookup: { role: "task", deleted: true },
    },
    // delete_by_external_id
    {
      tool: "delete_by_external_id",
      args: { external_id: "k-schedule" },
      before: [["create_schedule_item", KEYED_SCHEDULE]],
      lookup: { role: "event" },
    },
    {
      tool: "delete_by_external_id",
      args: { external_id: "k-todo" },
      before: [["create_todo", KEYED_TODO]],
      lookup: { role: "task" },
    },
    {
      tool: "delete_by_external_id",
      args: { external_id: "k-note" },
      before: [["create_note", KEYED_NOTE]],
      lookup: { role: "note" },
    },
    // a second delete of the same key still succeeds (a retry is safe)
    {
      tool: "delete_by_external_id",
      args: { external_id: "k-todo" },
      before: [
        ["create_todo", KEYED_TODO],
        ["delete_by_external_id", { external_id: "k-todo" }],
      ],
      lookup: { role: "task", deleted: true },
    },
    { tool: "delete_by_external_id", args: { external_id: "never-used" } },
    { tool: "delete_by_external_id", args: {} },
  ];
}

/*
 * The record tools (#2166). The fake's records all belong to the app it serves
 * (KNOWN_DIFFERENCES 10), so the forbidden refusal of another source's record
 * is pinned in gatewayWorker.test.ts and recordHandlers.test.ts instead.
 */
function RECORD_CASES(): Case[] {
  return [
    // create_record
    {
      tool: "create_record",
      args: { kind: "weight", value: 62.5, unit: "kg" },
    },
    {
      tool: "create_record",
      args: { kind: "expense", value: 980, external_id: "new-key" },
    },
    // the gateway does not take source_app: accepted, ignored, and noted
    {
      tool: "create_record",
      args: { kind: "expense", value: 1, source_app: "claude" },
    },
    // the same external_id and content is a replay
    { tool: "create_record", args: SEED_RECORD, record: SEED_RECORD_ROW },
    // ... and with other content is refused
    {
      tool: "create_record",
      args: { ...SEED_RECORD, value: 500 },
      record: SEED_RECORD_ROW,
    },
    { tool: "create_record", args: { kind: "Expense", value: 1 } },
    { tool: "create_record", args: { kind: "expense" } },
    {
      tool: "create_record",
      args: { kind: "expense", value: 1, occurred_at: "2026-10-11T12:10:00" },
    },
    {
      tool: "create_record",
      args: { kind: "expense", value: 1, dims: { Bad: 1 } },
    },
    { tool: "create_record", args: { kind: "expense", value: 1, dims: [] } },
    {
      tool: "create_record",
      args: { kind: "expense", value: 1, external_id: "" },
    },
    // list_records
    { tool: "list_records", args: {} },
    { tool: "list_records", args: { kind: "expense", group_by: "day" } },
    {
      tool: "list_records",
      args: { from: "2026-10-01", to: "2026-10-31", source_app: "parity-app" },
    },
    {
      tool: "list_records",
      args: {
        from: "2026-10-11T00:00:00+09:00",
        to: "2026-10-12T00:00:00+09:00",
      },
    },
    { tool: "list_records", args: { from: "2026-10-31", to: "2026-10-01" } },
    { tool: "list_records", args: { kind: "Expense" } },
    { tool: "list_records", args: { source_app: "Bad App" } },
    { tool: "list_records", args: { limit: 0 } },
    { tool: "list_records", args: { group_by: "year" } },
    { tool: "list_records", args: { from: "yesterday" } },
    // delete_record
    {
      tool: "delete_record",
      args: { id: "$record" },
      record: { id: REAL_RECORD_ID, source_app: "parity-app" },
    },
    { tool: "delete_record", args: { id: NOT_FOUND } },
    {
      tool: "delete_record",
      args: { id: "$record" },
      before: [["delete_record", { id: "$record" }]],
    },
    { tool: "delete_record", args: {} },
    // list_extension_apps (nothing in it can fail; see CANNOT_FAIL)
    { tool: "list_extension_apps", args: {} },
    { tool: "list_extension_apps", args: { slug: "x" } },
  ];
}

/**
 * Tools no call can make fail: no arguments to get wrong, nothing to miss.
 * Kept short and with the reason, so the per-tool failure check below stays
 * the rule for everything else.
 */
const CANNOT_FAIL: Readonly<Record<string, string>> = {
  list_extension_apps:
    "takes no arguments (an undeclared one is noted, not refused) and reads a list that may be empty",
};

const EXTRA_CASES: Case[] = [
  // list_todos
  { tool: "list_todos", args: {} },
  { tool: "list_todos", args: { status: "done" } },
  { tool: "list_todos", args: { status: null } },
  { tool: "list_todos", args: { include_content: true, limit: 1 } },
  { tool: "list_todos", args: { parent_id: "$todo" } },
  {
    tool: "list_todos",
    args: { date_range: { start: "2026-10-01", end: "2026-10-31" } },
  },
  { tool: "list_todos", args: { status: "in_progress" } },
  { tool: "list_todos", args: { limit: 0 } },
  { tool: "list_todos", args: { limit: 2.5 } },
  { tool: "list_todos", args: { limit: "5" } },
  { tool: "list_todos", args: { date_range: { start: "2026-10-01" } } },
  { tool: "list_todos", args: { date_range: "this week" } },
  { tool: "list_todos", args: { folder_id: "x", _meta: { progressToken: 1 } } },
  // get_todo
  { tool: "get_todo", args: { id: "$todo" } },
  { tool: "get_todo", args: {} },
  { tool: "get_todo", args: { id: null } },
  { tool: "get_todo", args: { id: 5 } },
  { tool: "get_todo", args: { id: NOT_FOUND }, real: "empty" },
  { tool: "get_todo", args: { id: "$event" }, real: "empty" },
  {
    tool: "get_todo",
    args: { id: "$todo" },
    before: [["delete_todo", { id: "$todo" }]],
    real: "empty",
  },
  // create_todo
  {
    tool: "create_todo",
    args: {
      title: "Cancel",
      status: "done",
      content: "- [ ] call them",
      scheduled_at: "2026-10-10T00:00:00.000Z",
      scheduled_end_at: "2026-10-10T01:00:00.000Z",
      is_all_day: false,
      parent_id: "$todo",
    },
  },
  { tool: "create_todo", args: { title: 7 } },
  { tool: "create_todo", args: { title: "x", is_all_day: "yes" } },
  { tool: "create_todo", args: { title: null, status: "later" } },
  { tool: "create_todo", args: { title: "x", notes: "y", memo: "z" } },
  // update_todo
  { tool: "update_todo", args: { id: "$todo", title: "New" } },
  {
    tool: "update_todo",
    args: { id: "$todo", status: "done", time_memo: null },
  },
  { tool: "update_todo", args: { id: "$todo", content: "# Body" } },
  { tool: "update_todo", args: { id: "$todo" } },
  { tool: "update_todo", args: { id: "$todo", status: "started" } },
  { tool: "update_todo", args: { id: "$todo", memo: "x" } },
  { tool: "update_todo", args: { id: NOT_FOUND, title: "x" }, real: "empty" },
  // delete_todo
  { tool: "delete_todo", args: { id: "$todo" } },
  { tool: "delete_todo", args: { id: NOT_FOUND }, real: "empty" },
  {
    tool: "delete_todo",
    args: { id: "$todo" },
    before: [["delete_todo", { id: "$todo" }]],
    real: "empty",
  },
  // list_notes
  { tool: "list_notes", args: {} },
  { tool: "list_notes", args: { query: "plan" } },
  { tool: "list_notes", args: { include_content: true, limit: 1 } },
  { tool: "list_notes", args: { limit: -1 } },
  { tool: "list_notes", args: { query: 3 } },
  // get_note
  { tool: "get_note", args: { id: "$note" } },
  { tool: "get_note", args: { id: NOT_FOUND }, real: "empty" },
  {
    tool: "get_note",
    args: { id: "$note" },
    before: [["delete_note", { id: "$note" }]],
    real: "empty",
  },
  // create_note
  { tool: "create_note", args: { title: "x", body: "y" } },
  { tool: "create_note", args: { title: "x", content: 5 } },
  // update_note
  { tool: "update_note", args: { id: "$note", title: "Renamed" } },
  { tool: "update_note", args: { id: "$note", content: "New body" } },
  {
    tool: "update_note",
    args: { id: "$note", is_pinned: true, color: "#E8D5F5" },
    // The stub does not apply writes; give the real side the written row.
    real: { is_pinned: true, color: "#E8D5F5" },
  },
  {
    tool: "update_note",
    args: { id: "$note", title: "x", expected_updated_at: "$noteUpdatedAt" },
  },
  {
    tool: "update_note",
    args: {
      id: "$note",
      title: "x",
      expected_updated_at: "2000-01-01T00:00:00Z",
    },
  },
  { tool: "update_note", args: { id: "$note", is_pinned: "yes" } },
  { tool: "update_note", args: { id: NOT_FOUND, title: "x" }, real: "empty" },
  // delete_note
  { tool: "delete_note", args: { id: "$note" } },
  { tool: "delete_note", args: { id: NOT_FOUND }, real: "empty" },
  // list_schedule
  { tool: "list_schedule", args: {} },
  { tool: "list_schedule", args: { date: "2026-10-10" } },
  {
    tool: "list_schedule",
    args: { start_date: "2026-10-01", end_date: "2026-10-31" },
  },
  { tool: "list_schedule", args: { start_date: "2026-10-01" } },
  { tool: "list_schedule", args: { end_date: "2026-10-31" } },
  {
    tool: "list_schedule",
    args: {
      date: "2026-10-10",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
    },
  },
  { tool: "list_schedule", args: { date: "10/10/2026" } },
  {
    tool: "list_schedule",
    args: { start_date: "2026-1-01", end_date: "2026-10-31" },
  },
  { tool: "list_schedule", args: { date: 20261010 } },
  // create_schedule_item (the spec's own examples run too — see below)
  {
    tool: "create_schedule_item",
    args: { date: "2026-10-10", title: "x", start_time: "", end_time: "09:15" },
  },
  { tool: "create_schedule_item", args: { date: "bad", title: "x" } },
  {
    tool: "create_schedule_item",
    args: {
      date: "2026-10-10",
      title: "x",
      start_time: "09:00",
      end_time: "24:00",
    },
  },
  {
    tool: "create_schedule_item",
    args: { date: "2026-10-10", title: "x", is_all_day: true, start_time: "9" },
  },
  {
    tool: "create_schedule_item",
    args: {
      date: "2026-10-10",
      title: "x",
      start_time: "09:00",
      end_time: "10:00",
      memo: "bring card",
      note: "typo for memo",
    },
  },
  {
    tool: "create_schedule_item",
    args: { date: "2026-10-10", title: "x", start_time: null },
  },
  // update_schedule_item
  { tool: "update_schedule_item", args: { id: "$event", title: "x" } },
  { tool: "update_schedule_item", args: { id: "$event" } },
  { tool: "update_schedule_item", args: { id: "$event", is_all_day: true } },
  { tool: "update_schedule_item", args: { id: "$event", is_all_day: false } },
  {
    tool: "update_schedule_item",
    args: { id: "$allDay", is_all_day: false },
    real: { start_time: null, end_time: null, is_all_day: true },
  },
  {
    tool: "update_schedule_item",
    args: {
      id: "$allDay",
      is_all_day: false,
      start_time: "10:00",
      end_time: "11:00",
    },
    real: { start_time: null, end_time: null, is_all_day: true },
  },
  { tool: "update_schedule_item", args: { id: "$event", start_time: "7:00" } },
  {
    tool: "update_schedule_item",
    args: { id: NOT_FOUND, title: "x" },
    real: "empty",
  },
  // A malformed argument is refused before the not-found read.
  {
    tool: "update_schedule_item",
    args: { id: NOT_FOUND, date: "bad" },
    real: "empty",
  },
  {
    // The real getEvent does not filter is_deleted: a trashed event is still
    // editable. Mirrored, and pinned here so a change on either side shows.
    tool: "update_schedule_item",
    args: { id: "$event", title: "after delete" },
    before: [["delete_schedule_item", { id: "$event" }]],
    real: { is_deleted: true, deleted_at: "2026-10-10T00:00:00Z" },
  },
  // delete_schedule_item
  { tool: "delete_schedule_item", args: { id: "$event" } },
  { tool: "delete_schedule_item", args: { id: "$event", scope: "this" } },
  { tool: "delete_schedule_item", args: { id: "$event", scope: "some" } },
  { tool: "delete_schedule_item", args: { id: NOT_FOUND }, real: "empty" },
  // set_schedule_complete / set_schedule_dismissed
  { tool: "set_schedule_complete", args: { id: "$event", completed: true } },
  { tool: "set_schedule_complete", args: { id: "$event", completed: false } },
  { tool: "set_schedule_complete", args: { id: "$event" } },
  { tool: "set_schedule_complete", args: { id: "$event", completed: "yes" } },
  {
    tool: "set_schedule_complete",
    args: { id: NOT_FOUND, completed: true },
    real: "empty",
  },
  { tool: "set_schedule_dismissed", args: { id: "$event", dismissed: true } },
  { tool: "set_schedule_dismissed", args: { id: "$event", dismissed: null } },
  {
    tool: "set_schedule_dismissed",
    args: { id: NOT_FOUND, dismissed: true },
    real: "empty",
  },
  // wiki tags
  { tool: "list_wiki_tags", args: {} },
  { tool: "list_wiki_tags", args: { query: "se" } },
  { tool: "list_wiki_tags", args: { query: 5 } },
  { tool: "get_entity_tags", args: { entity_id: "$todo" } },
  { tool: "get_entity_tags", args: { entity_id: NOT_FOUND } },
  { tool: "get_entity_tags", args: {} },
  { tool: "search_by_tag", args: { tag_name: "seed" } },
  { tool: "search_by_tag", args: { tag_name: "seed", entity_type: "task" } },
  { tool: "search_by_tag", args: { tag_name: "seed", entity_type: "event" } },
  {
    tool: "search_by_tag",
    args: { tag_name: "never-made" },
    real: "empty",
    specGap:
      "an unknown tag answers tag: null, while the spec's result says tag is an object",
  },
  { tool: "tag_entity", args: { tag_name: "x", entity_id: "$event" } },
  {
    tool: "tag_entity",
    args: { tag_name: "x", entity_id: "$event", entity_type: "event" },
  },
  {
    tool: "tag_entity",
    args: { tag_name: "x", entity_id: "$event", entity_type: "task" },
  },
  {
    tool: "tag_entity",
    args: { tag_name: "x", entity_id: NOT_FOUND },
    real: "empty",
  },
  { tool: "tag_entity", args: { tag_name: "x" } },
  { tool: "untag_entity", args: { tag_name: "seed", entity_id: "$todo" } },
  {
    tool: "untag_entity",
    args: { tag_name: "never-made", entity_id: "$todo" },
    real: "empty",
  },
  { tool: "untag_entity", args: { entity_id: "$todo" } },
  // search_all
  { tool: "search_all", args: { query: "renewal" } },
  { tool: "search_all", args: { query: "x", domains: ["todos", "notes"] } },
  { tool: "search_all", args: { query: "x", domains: [] } },
  { tool: "search_all", args: { query: "x", domains: ["events"] } },
  { tool: "search_all", args: { query: "x", limit: 0 } },
  { tool: "search_all", args: { query: "x", offset: -1 } },
  { tool: "search_all", args: { query: "x", offset: 1.5, limit: "3" } },
  { tool: "search_all", args: {} },
  ...KEYED_CASES(),
  ...RECORD_CASES(),
];

/** The spec's own examples, valid and invalid, ahead of the extra cases. */
const EXAMPLE_CASES: Case[] = committed.tools.flatMap((spec) => [
  ...(spec.examples?.valid ?? []).map((e) => ({
    tool: spec.name,
    args: e.args,
  })),
  ...(spec.examples?.invalid ?? []).map((e) => ({
    tool: spec.name,
    args: e.args,
  })),
]);

const CASES = [...EXAMPLE_CASES, ...EXTRA_CASES];

const label = (c: Case) =>
  `${c.tool} ${JSON.stringify(c.args)}${c.before ? " after " + c.before.map((b) => b[0]).join(",") : ""}`;

describe("every spec tool is exercised", () => {
  it("has at least one success and one failure case per tool", async () => {
    // Which side of the line each case lands on is decided by running it, so
    // this is a count over the outcomes the parity suite below produces.
    const seen = new Map<string, { ok: number; failed: number }>();
    for (const c of CASES) {
      const { gateway, values } = await seededFake();
      for (const [tool, args] of c.before ?? []) {
        await fakeOutcome(gateway, tool, fill(args, values));
      }
      const outcome = await fakeOutcome(gateway, c.tool, fill(c.args, values));
      const entry = seen.get(c.tool) ?? { ok: 0, failed: 0 };
      if (outcome.ok) entry.ok++;
      else entry.failed++;
      seen.set(c.tool, entry);
    }
    for (const spec of committed.tools) {
      const entry = seen.get(spec.name);
      expect(entry?.ok, `${spec.name}: a succeeding case`).toBeGreaterThan(0);
      if (spec.name in CANNOT_FAIL) continue;
      expect(entry?.failed, `${spec.name}: a failing case`).toBeGreaterThan(0);
    }
  });
});

describe("the fake and the real handlers answer the same calls the same way", () => {
  for (const c of CASES) {
    it(label(c), async () => {
      const { gateway, values } = await seededFake();
      for (const [tool, args] of c.before ?? []) {
        const pre = await fakeOutcome(gateway, tool, fill(args, values));
        expect(pre.ok, `before: ${tool}`).toBe(true);
      }
      const fake = await fakeOutcome(gateway, c.tool, fill(c.args, values));

      keyLookup = c.lookup ?? null;
      recordRow = c.record ?? null;
      useRealStub(c.real ?? "anyRow");
      const real = await realOutcome(c.tool, fill(c.args, REAL_VALUES));
      keyLookup = null;
      recordRow = null;

      // Ids only: an instant placeholder is left to normalize()'s own rule.
      const ids = [
        ...["$todo", "$note", "$event", "$allDay", "$record"].map(
          (key) => values[key],
        ),
        REAL_ID,
        REAL_RECORD_ID,
      ];
      expect(
        fake.ok,
        `fake: ${JSON.stringify(fake)}\nreal: ${JSON.stringify(real)}`,
      ).toBe(real.ok);
      if (!fake.ok || !real.ok) {
        expect(normalize((fake as { message: string }).message, ids)).toBe(
          normalize((real as { message: string }).message, ids),
        );
        // The code is the part a program branches on (plan R7).
        expect((fake as { code: string }).code).toBe(
          (real as { code: string }).code,
        );
        return;
      }

      // Same number of content items, and the Note (if any) word for word.
      expect(fake.texts.length).toBe(real.texts.length);
      expect(fake.texts.slice(1)).toEqual(real.texts.slice(1));

      const fakeResultValue = JSON.parse(fake.texts[0]) as unknown;
      const realResultValue = JSON.parse(real.texts[0]) as unknown;
      expectSameTopLevel(fakeResultValue, realResultValue, c.tool);
      if (c.specGap) {
        // Pinned, so the day either side starts keeping the promise, this
        // case asks for the gap note to be removed.
        expect(specProblems(c.tool, fakeResultValue)).not.toEqual([]);
        expect(specProblems(c.tool, realResultValue)).not.toEqual([]);
      } else {
        expect(specProblems(c.tool, fakeResultValue), "fake vs spec").toEqual(
          [],
        );
        expect(specProblems(c.tool, realResultValue), "real vs spec").toEqual(
          [],
        );
      }
    });
  }
});

/* ---- same state, same answer --------------------------------------------- */

/*
 * The read tools, with the real handlers reading rows built from the fake's
 * own state. ANY_ROW cannot say anything about what a list CONTAINS; this can.
 */

interface FakeState {
  todos: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  events: Record<string, unknown>[];
  tags: Record<string, unknown>[];
  assignments: Array<{ id: string; itemId: string; tagId: string; at: string }>;
}

function mirrorFake(state: FakeState): StubTables {
  const meta = (row: Record<string, unknown>, role: string): StubRow => ({
    id: row.id,
    role,
    title: row.title,
    is_deleted: false,
    deleted_at: null,
    created_at: row.createdAt,
    updated_at: row.updatedAt ?? row.createdAt,
  });
  const upper = (s: unknown) =>
    typeof s === "string" ? s.toUpperCase() : null;
  return {
    items_meta: [
      ...state.todos.map((t) => meta(t, "task")),
      ...state.notes.map((n) => meta(n, "note")),
      ...state.events.map((e) => meta(e, "event")),
    ],
    tasks_payload: state.todos.map((t) => ({
      item_id: t.id,
      parent_item_id: t.parentId,
      task_type: t.type,
      status: upper(t.status),
      content: t.content,
      time_memo: t.timeMemo,
      scheduled_at: t.scheduledAt,
      scheduled_end_at: t.scheduledEndAt,
      is_all_day: t.isAllDay,
      completed_at: t.completedAt,
      sort_order: t.order,
    })),
    notes_payload: state.notes.map((n) => ({
      item_id: n.id,
      note_type: "note",
      content_json: n.content === "" ? null : JSON.parse(n.content as string),
      is_pinned: n.isPinned,
      color: n.color ?? null,
      has_password: false,
    })),
    events_payload: state.events.map((e) => ({
      item_id: e.id,
      start_at: e.date,
      start_time: e.startTime,
      end_time: e.endTime,
      is_all_day: e.isAllDay,
      done: e.completed,
      completed_at: e.completedAt,
      is_dismissed: e.isDismissed,
      memo: e.memo,
      routine_item_id: null,
    })),
    wiki_tags: state.tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      icon: null,
      is_deleted: false,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
    wiki_tag_assignments: state.assignments.map((a) => ({
      id: a.id,
      item_id: a.itemId,
      tag_id: a.tagId,
      is_deleted: false,
      created_at: a.at,
      updated_at: a.at,
    })),
    dailies_payload: [],
  };
}

/**
 * `fromTables` refuses `.is` / `.not.is` rather than ignore them (see
 * supabaseStub.ts). list_schedule and create_todo use them for "is null" /
 * "is not null", so apply exactly those two here and hand the rest on.
 */
function withNullFilters(tables: StubTables): (call: QueryCall) => unknown {
  const run = fromTables(tables);
  return (call) => {
    const nullChecks = Object.entries(call.bounds).filter(
      ([key, value]) =>
        (key.endsWith(".is") || key.endsWith(".not.is")) && value === null,
    );
    if (nullChecks.length === 0 || call.single) return run(call);
    const bounds = { ...call.bounds };
    for (const [key] of nullChecks) delete bounds[key];
    const rows = run({ ...call, bounds }) as StubRow[];
    return rows.filter((row) =>
      nullChecks.every(([key]) => {
        const column = key.slice(0, key.indexOf("."));
        return key.endsWith(".not.is")
          ? row[column] !== null
          : row[column] === null;
      }),
    );
  };
}

describe("same state, same answer: the read tools against rows mirrored from the fake", () => {
  async function build() {
    const gateway = createFakeGateway({ token: TOKEN });
    const todos = [
      await fakeResult(gateway, "create_todo", {
        title: "Renewal call",
        content: "Phone the renewal desk",
        scheduled_at: "2026-10-10T01:00:00.000Z",
      }),
      await fakeResult(gateway, "create_todo", {
        title: "Groceries",
        status: "done",
      }),
    ];
    todos.push(
      await fakeResult(gateway, "create_todo", {
        title: "Child of renewal",
        parent_id: todos[0].id,
      }),
    );
    const notes = [
      await fakeResult(gateway, "create_note", {
        title: "Subscriptions",
        content: "# Plans\nrenewal in October",
      }),
      await fakeResult(gateway, "create_note", { title: "Empty" }),
    ];
    const events = [
      await fakeResult(gateway, "create_schedule_item", {
        date: "2026-10-10",
        title: "Renewal",
        start_time: "09:00",
        end_time: "09:15",
        memo: "card",
      }),
      await fakeResult(gateway, "create_schedule_item", {
        date: "2026-10-12",
        title: "Holiday",
        is_all_day: true,
      }),
    ];
    const tagged = await fakeResult(gateway, "tag_entity", {
      tag_name: "money",
      entity_id: todos[0].id,
    });
    await fakeResult(gateway, "tag_entity", {
      tag_name: "reading",
      entity_id: notes[0].id,
    });
    const tags = (await fakeResult(
      gateway,
      "list_wiki_tags",
      {},
    )) as unknown as Record<string, unknown>[];
    const assignments: FakeState["assignments"] = [];
    for (const item of [todos[0], notes[0]]) {
      const entity = await fakeResult(gateway, "get_entity_tags", {
        entity_id: item.id,
      });
      for (const tag of entity.tags as Array<Record<string, unknown>>) {
        assignments.push({
          id: `assign-${String(item.id)}`,
          itemId: item.id as string,
          tagId: tag.id as string,
          at: tag.assignedAt as string,
        });
      }
    }
    stub = createSupabaseStub(
      withNullFilters(mirrorFake({ todos, notes, events, tags, assignments })),
      SAVED_RPC,
    );
    return {
      gateway,
      todos,
      notes,
      events,
      tag: tagged.tag as Record<string, unknown>,
    };
  }

  const READS: Array<[string, (s: Awaited<ReturnType<typeof build>>) => Args]> =
    [
      ["list_todos", () => ({})],
      ["list_todos", () => ({ include_content: true })],
      ["list_todos", () => ({ status: "done" })],
      ["list_todos", () => ({ limit: 1 })],
      ["list_todos", (s) => ({ parent_id: s.todos[0].id })],
      [
        "list_todos",
        () => ({ date_range: { start: "2026-10-10", end: "2026-10-10" } }),
      ],
      ["get_todo", (s) => ({ id: s.todos[0].id })],
      ["list_notes", () => ({})],
      ["list_notes", () => ({ query: "renewal", include_content: true })],
      ["get_note", (s) => ({ id: s.notes[0].id })],
      ["list_schedule", () => ({ date: "2026-10-10" })],
      [
        "list_schedule",
        () => ({ start_date: "2026-10-01", end_date: "2026-10-31" }),
      ],
      ["list_wiki_tags", () => ({})],
      ["list_wiki_tags", () => ({ query: "mon" })],
      ["get_entity_tags", (s) => ({ entity_id: s.todos[0].id })],
      ["search_by_tag", () => ({ tag_name: "money" })],
      ["search_by_tag", () => ({ tag_name: "reading", entity_type: "task" })],
      ["search_all", () => ({ query: "renewal" })],
      [
        "search_all",
        () => ({ query: "renewal", domains: ["notes"], limit: 1, offset: 0 }),
      ],
    ];

  for (const [name, argsOf] of READS) {
    it(`${name} ${argsOf.toString().replace(/\s+/g, " ").slice(0, 80)}`, async () => {
      const state = await build();
      const args = argsOf(state);
      const fake = await fakeOutcome(state.gateway, name, args);
      const real = await realOutcome(name, args);
      expect(real).toEqual(expect.objectContaining({ ok: true }));
      expect(fake.ok).toBe(true);
      if (!fake.ok || !real.ok) return;
      const f = JSON.parse(fake.texts[0]) as Record<string, unknown>;
      const r = JSON.parse(real.texts[0]) as Record<string, unknown>;
      if (name === "list_schedule") {
        // The stub's ORDER BY ignores `nullsFirst: false`, so an all-day event
        // (no start_time) sorts first there and last in Postgres and the fake.
        const byId = (rows: unknown) =>
          [...(rows as Array<{ id: string }>)].sort((a, b) =>
            a.id.localeCompare(b.id),
          );
        expect(byId(f.scheduleItems)).toEqual(byId(r.scheduleItems));
        expect(f.scheduledTodos).toEqual(r.scheduledTodos);
        return;
      }
      expect(f).toEqual(r);
    });
  }
});

/* ---- same records, same answer ------------------------------------------- */

/*
 * The record reads with content (#2166). The parity cases above run the real
 * side on an empty app_records, so they compare only outcomes and top-level
 * keys. Here the real side reads rows mirrored from what the fake holds, and
 * the whole answers — the records, the buckets, the ledger's activity — must
 * match.
 */
describe("same records, same answer: list_records and list_extension_apps", () => {
  const LEDGER = [
    {
      slug: "parity-app",
      name: "Parity",
      url: "https://parity.example",
      icon: null,
      description: "the app the fake serves",
      sort_order: 1,
    },
    {
      slug: "quiet-app",
      name: "Quiet",
      url: null,
      icon: null,
      description: null,
      sort_order: 0,
    },
  ];

  async function build() {
    const gateway = createFakeGateway({
      token: TOKEN,
      app: APP.app,
      extensionApps: LEDGER,
    });
    // Two days, two kinds; the 01:00 JST record counts on its own local day.
    const made: Array<Record<string, unknown>> = [
      {
        kind: "expense",
        value: 450,
        unit: "JPY",
        occurred_at: "2026-10-11T12:10:00+09:00",
      },
      {
        kind: "expense",
        value: 980,
        unit: "JPY",
        occurred_at: "2026-10-12T01:00:00+09:00",
        dims: { category: "music" },
      },
      {
        kind: "weight",
        value: 62.5,
        unit: "kg",
        occurred_at: "2026-10-12T07:00:00+09:00",
      },
      // No occurred_at: "now", so records_30d always has one to count.
      { kind: "expense", value: 120, unit: "JPY", note: "just now" },
    ];
    for (const args of made) await fakeResult(gateway, "create_record", args);
    const listed = (await fakeResult(gateway, "list_records", {
      limit: 500,
    })) as { records: Array<Record<string, unknown>> };
    const rows = listed.records;

    stub = createSupabaseStub((call: QueryCall): unknown => {
      // The handler orders the ledger by sort_order, then slug; so does Postgres.
      if (call.table === "extension_apps") {
        return call.single
          ? null
          : [...LEDGER].sort(
              (a, b) =>
                a.sort_order - b.sort_order || a.slug.localeCompare(b.slug),
            );
      }
      if (call.table !== "app_records") return call.single ? null : [];
      let out = rows.filter((row) =>
        Object.entries(call.filters).every(
          ([key, value]) => row[key] === value,
        ),
      );
      const at = (row: Record<string, unknown>) =>
        Date.parse(row.occurred_at as string);
      const gte = call.bounds["occurred_at.gte"];
      const lt = call.bounds["occurred_at.lt"];
      if (typeof gte === "string")
        out = out.filter((r) => at(r) >= Date.parse(gte));
      if (typeof lt === "string")
        out = out.filter((r) => at(r) < Date.parse(lt));
      // The fake listed them newest first already, the order the handlers ask for.
      if (call.single) return out[0] ?? null;
      const from = call.range?.from ?? 0;
      const to = call.range?.to ?? out.length - 1;
      return out.slice(from, to + 1);
    }, SAVED_RPC);
    return gateway;
  }

  const READS: Array<[string, Args]> = [
    ["list_records", {}],
    ["list_records", { kind: "expense" }],
    ["list_records", { limit: 2 }],
    ["list_records", { from: "2026-10-12", to: "2026-10-12" }],
    ["list_records", { source_app: "parity-app", kind: "weight" }],
    ["list_records", { kind: "expense", group_by: "day" }],
    ["list_records", { kind: "expense", group_by: "week" }],
    ["list_records", { kind: "expense", group_by: "month" }],
    ["list_extension_apps", {}],
  ];

  for (const [name, args] of READS) {
    it(`${name} ${JSON.stringify(args)}`, async () => {
      const gateway = await build();
      const fake = await fakeOutcome(gateway, name, args);
      const real = await realOutcome(name, args);
      expect(real).toEqual(expect.objectContaining({ ok: true }));
      expect(fake.ok).toBe(true);
      if (!fake.ok || !real.ok) return;
      expect(JSON.parse(fake.texts[0])).toEqual(JSON.parse(real.texts[0]));
    });
  }

  it("says something worth comparing: the ledger answer carries the app's activity", async () => {
    const gateway = await build();
    const apps = (await fakeResult(gateway, "list_extension_apps", {}))
      .apps as Array<Record<string, unknown>>;
    expect(apps.map((a) => a.slug)).toEqual(["quiet-app", "parity-app"]);
    expect(apps[1].records_30d).toBeGreaterThan(0);
    expect(apps[1].last_record_at).not.toBeNull();
    expect(apps[0]).toMatchObject({ records_30d: 0, last_record_at: null });
  });
});

/* ---- HTTP surface -------------------------------------------------------- */

describe("the HTTP surface matches the Worker's", () => {
  const fake = createFakeGateway({ token: TOKEN });

  async function both(make: () => Request) {
    useRealStub("anyRow");
    const f = await fake.fetch(make());
    const r = await worker.fetch(make(), ENV);
    return { f, r };
  }

  async function expectSame(make: () => Request) {
    const { f, r } = await both(make);
    expect(f.status).toBe(r.status);
    expect(f.headers.get("allow")).toBe(r.headers.get("allow"));
    expect(f.headers.get("content-type")).toBe(r.headers.get("content-type"));
    expect(f.headers.get("www-authenticate")).toBe(
      r.headers.get("www-authenticate"),
    );
    expect(await f.text()).toBe(await r.text());
  }

  const post =
    (path: string, body: unknown, headers: Record<string, string> = {}) =>
    () =>
      new Request(`https://mcp.example.com${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
  const ping = { jsonrpc: "2.0", id: 1, method: "ping" };

  it("404s a wrong token", () =>
    expectSame(post("/mcp/wrong-token-0123456789abcde", ping)));
  it("404s a missing token", () => expectSame(post("/mcp", ping)));
  it("404s the neighbouring path /mcp-public/<token>", () =>
    expectSame(post(`/mcp-public/${TOKEN}`, ping)));
  it("404s an unrelated path", () => expectSame(post("/elsewhere", ping)));
  it("404s a wrong Bearer token", () =>
    expectSame(post("/mcp", ping, { authorization: "Bearer nope" })));
  it("accepts the Bearer header form", () =>
    expectSame(post("/mcp", ping, { authorization: `Bearer ${TOKEN}` })));
  it("accepts a correct path even beside an unrelated Authorization header", () =>
    expectSame(post(`/mcp/${TOKEN}`, ping, { authorization: "Basic abc" })));
  it("405s a GET after auth, with allow: POST", () =>
    expectSame(() => new Request(`https://mcp.example.com/mcp/${TOKEN}`)));
  it("405s a DELETE after auth", () =>
    expectSame(
      () =>
        new Request(`https://mcp.example.com/mcp/${TOKEN}`, {
          method: "DELETE",
        }),
    ));
  it("404s a GET without a token (the method is not admitted to first)", () =>
    expectSame(() => new Request("https://mcp.example.com/mcp")));
  it("answers /health", () =>
    expectSame(() => new Request("https://mcp.example.com/health")));
  it("reports invalid JSON as -32700 at HTTP 200", () =>
    expectSame(post(`/mcp/${TOKEN}`, "{not json")));
  it("refuses a batch with -32600", () =>
    expectSame(post(`/mcp/${TOKEN}`, [ping])));
  it("refuses a non-object body", () =>
    expectSame(post(`/mcp/${TOKEN}`, "42")));
  it("refuses a null body", () => expectSame(post(`/mcp/${TOKEN}`, "null")));
  it("refuses a message without a method", () =>
    expectSame(post(`/mcp/${TOKEN}`, { jsonrpc: "2.0", id: 1 })));
  it("answers a notification with 202 and no body", () =>
    expectSame(
      post(`/mcp/${TOKEN}`, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    ));
  it("answers id: null as a notification too", () =>
    expectSame(
      post(`/mcp/${TOKEN}`, { jsonrpc: "2.0", id: null, method: "ping" }),
    ));
  it("answers ping", () => expectSame(post(`/mcp/${TOKEN}`, ping)));
  it("echoes a string id", () =>
    expectSame(
      post(`/mcp/${TOKEN}`, { jsonrpc: "2.0", id: "abc", method: "ping" }),
    ));
  it("reports an unknown method with -32601", () =>
    expectSame(
      post(`/mcp/${TOKEN}`, {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/list",
      }),
    ));

  for (const version of [
    ...SUPPORTED_PROTOCOL_VERSIONS,
    "1999-01-01",
    undefined,
  ]) {
    it(`initialize with protocolVersion ${String(version)}`, () =>
      expectSame(
        post(`/mcp/${TOKEN}`, {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: version === undefined ? {} : { protocolVersion: version },
        }),
      ));
  }

  it("falls back to the SDK's latest protocol version", async () => {
    const res = await fake.fetch(
      rpcRequest("initialize", { protocolVersion: "1999-01-01" }),
    );
    const body = (await res.json()) as { result: { protocolVersion: string } };
    expect(body.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("lists exactly the spec's tools, as the gateway registry publishes them", async () => {
    const res = await fake.fetch(rpcRequest("tools/list"));
    const body = (await res.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(body.result.tools.map((t) => t.name)).toEqual(
      committed.tools.map((t) => t.name),
    );
    expect(body.result.tools).toHaveLength(28);
    // The real Worker lists the whole remote set; the gateway's registry is
    // the one the fake stands in for.
    expect(body.result.tools).toEqual(
      JSON.parse(JSON.stringify(extensionRegistry.tools)),
    );
  });

  it("answers an unknown tool as an isError result", async () => {
    await expectSame(() => rpcRequest("tools/call", { name: "no_such_tool" }));
    const res = await fake.fetch(rpcRequest("tools/call", { name: "x" }));
    expect(await res.json()).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: "Error: Unknown tool: x" }],
        isError: true,
        structuredContent: { code: "not_found", message: "Unknown tool: x" },
      },
    });
  });

  it("refuses tools/call without a tool name with -32600", () =>
    expectSame(() => rpcRequest("tools/call", {})));
  it("words invalid arguments the same", () =>
    expectSame(() =>
      rpcRequest("tools/call", {
        name: "list_todos",
        arguments: { status: 42 },
      }),
    ));
  it("words non-object arguments the same", () =>
    expectSame(() =>
      rpcRequest("tools/call", { name: "list_todos", arguments: "x" }),
    ));
  it("answers a tools/call that reaches a handler with the same envelope", async () => {
    const { f, r } = await both(() =>
      rpcRequest("tools/call", {
        name: "create_todo",
        arguments: { title: "x", memo: "y" },
      }),
    );
    expect(f.status).toBe(r.status);
    const fb = (await f.json()) as ToolCallBody & {
      jsonrpc: string;
      id: number;
    };
    const rb = (await r.json()) as ToolCallBody & {
      jsonrpc: string;
      id: number;
    };
    expect(Object.keys(fb).sort()).toEqual(Object.keys(rb).sort());
    expect(fb.result.isError).toBe(rb.result.isError);
    expect(fb.result.content.map((c) => c.type)).toEqual(
      rb.result.content.map((c) => c.type),
    );
    expect(fb.result.content[1].text).toBe(rb.result.content[1].text);
  });
  it("does not serve the test-double routes from fetch", async () => {
    // /__calls and /__reset belong to listen() only.
    await expectSame(() => new Request("https://mcp.example.com/__calls"));
    await expectSame(
      () => new Request("https://mcp.example.com/__reset", { method: "POST" }),
    );
  });
});

/* ---- over a real socket -------------------------------------------------- */

describe("listen() serves the fake over node:http", () => {
  const gateway = createFakeGateway({ token: TOKEN });
  let server: ListeningFake | undefined;

  afterAll(async () => {
    await server?.close();
  });

  it("records a tools/call, lists it at /__calls and clears it at /__reset", async () => {
    server = await listen(gateway, 0);
    expect(server.port).toBeGreaterThan(0);
    const base = `http://127.0.0.1:${server.port}`;

    const created = await fetch(`${base}/mcp/${TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "create_todo", arguments: { title: "Over the wire" } },
      }),
    });
    expect(created.status).toBe(200);
    const body = (await created.json()) as ToolCallBody & { id: number };
    expect(body.id).toBe(7);
    const todo = JSON.parse(body.result.content[0].text) as { id: string };
    expect(todo.id).toMatch(/^task-/);

    const refused = await fetch(`${base}/mcp/${TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "get_todo", arguments: {} },
      }),
    });
    expect(((await refused.json()) as ToolCallBody).result.isError).toBe(true);

    const calls = (await (await fetch(`${base}/__calls`)).json()) as Array<{
      tool: string;
      arguments: unknown;
      ok: boolean;
      error: string | null;
      timestamp: string;
    }>;
    expect(calls.map((c) => [c.tool, c.ok])).toEqual([
      ["create_todo", true],
      ["get_todo", false],
    ]);
    expect(calls[0].arguments).toEqual({ title: "Over the wire" });
    expect(calls[1].error).toBe(
      "Invalid arguments for get_todo: id is required",
    );
    expect(Number.isNaN(Date.parse(calls[0].timestamp))).toBe(false);

    // 404 / 405 travel over the socket unchanged.
    expect((await fetch(`${base}/mcp/wrong`, { method: "POST" })).status).toBe(
      404,
    );
    const get = await fetch(`${base}/mcp/${TOKEN}`);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");

    const reset = await fetch(`${base}/__reset`, { method: "POST" });
    expect(reset.status).toBe(200);
    expect(await (await fetch(`${base}/__calls`)).json()).toEqual([]);

    // The store went with it.
    const after = await fetch(`${base}/mcp/${TOKEN}`, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "get_todo", arguments: { id: todo.id } },
      }),
    });
    expect(((await after.json()) as ToolCallBody).result.content[0].text).toBe(
      `Error: Todo not found: ${todo.id}`,
    );
  });
});

/* ---- the header, the version, the imports -------------------------------- */

describe("the fake states which gateway it is", () => {
  const source = readFileSync(FAKE_PATH, "utf8");

  it("names the spec's version and commit in its header comment", () => {
    const header = source.slice(0, source.indexOf("*/"));
    expect(/Gateway version:\s+(\S+)/.exec(header)?.[1]).toBe(
      committed.gatewayVersion,
    );
    expect(/life-editor commit:\s+([0-9a-f]{40})/.exec(header)?.[1]).toBe(
      committed.lifeEditorCommit,
    );
  });

  it("exports the version and commit it read from the spec", () => {
    expect(GATEWAY_VERSION).toBe(committed.gatewayVersion);
    expect(LIFE_EDITOR_COMMIT).toBe(committed.lifeEditorCommit);
  });

  it("imports node: built-ins and nothing else", () => {
    const specifiers = [
      ...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm),
      ...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
      ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
      ...source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g),
    ].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(specifier).toMatch(/^node:/);
  });
});

/* ---- CORS (fake only until #2146) ---------------------------------------- */

describe("CORS on the fake (plan R4)", () => {
  const ORIGIN = "http://localhost:5173";
  const fake = createFakeGateway({ token: TOKEN, allowedOrigins: [ORIGIN] });
  const preflight = (origin?: string) =>
    new Request(`https://mcp.example.com/mcp/${TOKEN}`, {
      method: "OPTIONS",
      headers: {
        ...(origin ? { origin } : {}),
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, authorization",
      },
    });
  const corsHeaders = (res: Response) =>
    [...res.headers.keys()].filter((k) => k.startsWith("access-control-"));

  it("answers a preflight from an allowed origin with 204 and the allow headers", async () => {
    const res = await fake.fetch(preflight(ORIGIN));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "POST, OPTIONS",
    );
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "content-type, authorization",
    );
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("puts Access-Control-Allow-Origin on the actual POST from an allowed origin", async () => {
    const res = await fake.fetch(
      new Request(`https://mcp.example.com/mcp/${TOKEN}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });

  it("gives a disallowed origin no Access-Control-* header", async () => {
    const res = await fake.fetch(preflight("https://evil.example"));
    // Not a preflight answer: it falls through to the normal path, past the
    // token, and OPTIONS is not POST.
    expect(res.status).toBe(405);
    expect(corsHeaders(res)).toEqual([]);
    const post = await fake.fetch(
      new Request(`https://mcp.example.com/mcp/${TOKEN}`, {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
    );
    expect(corsHeaders(post)).toEqual([]);
  });

  it("gives a request without an Origin no Access-Control-* header", async () => {
    const res = await fake.fetch(preflight());
    expect(res.status).toBe(405);
    expect(corsHeaders(res)).toEqual([]);
  });

  it("allows no origin at all by default", async () => {
    const closed = createFakeGateway({ token: TOKEN });
    const res = await closed.fetch(preflight(ORIGIN));
    expect(res.status).toBe(405);
    expect(corsHeaders(res)).toEqual([]);
  });

  it("still 404s an allowed origin's POST with a wrong token", async () => {
    const res = await fake.fetch(
      new Request("https://mcp.example.com/mcp/wrong", {
        method: "POST",
        headers: { origin: ORIGIN },
        body: "{}",
      }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });

  it.todo("CORS parity with the real Worker — enable when #2146 lands");
});
