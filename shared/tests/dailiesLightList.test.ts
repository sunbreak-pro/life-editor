// @vitest-environment node (no DOM — mapper + service over the PostgREST stub)
import { describe, it, expect, beforeEach } from "vitest";
import { SupabaseDailiesUnifiedService } from "../src/services/SupabaseDailiesUnifiedService";
import {
  DAILIES_PAYLOAD_LIGHT_COLUMNS,
  DAILY_HEAD_BLOCKS,
  ITEMS_META_DAILY_COLUMNS,
  rowsToDailyNodeLight,
  type DailiesPayloadLightRow,
  type ItemsMetaDailyRow,
} from "../src/services/dailiesUnifiedMapper";
import { makeStub, USER } from "./helpers/supabaseNotesStub";

/*
 * #2325 — the Daily list without the bodies.
 *
 * The list used to carry every day's whole body and re-read all of them on
 * each save's echo. The light read selects every payload column BUT
 * `content_json`, plus the body's first DAILY_HEAD_BLOCKS top-level blocks
 * through PostgREST JSON-path aliases (b0…b23) for the excerpt. A light row
 * must say so (`bodyLoaded: false`) — its `content: ""` is not the body, and
 * a writer that took it for one would save the emptiness over the day.
 */

const ID = "daily-2026-10-20";
const DATE = "2026-10-20";

function metaRow(over: Partial<ItemsMetaDailyRow> = {}): ItemsMetaDailyRow {
  return {
    id: ID,
    user_id: USER,
    role: "daily",
    title: DATE,
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-10-20T00:00:00.000Z",
    updated_at: "2026-10-20T01:00:00.000Z",
    ...over,
  } as ItemsMetaDailyRow;
}

function lightRow(
  blocks: Record<string, unknown> = {},
): DailiesPayloadLightRow {
  const row: Record<string, unknown> = {
    item_id: ID,
    user_id: USER,
    date: DATE,
    is_pinned: true,
    is_edit_locked: false,
    has_password: false,
    evening_published_at: null,
    evening_notes: null,
    morning_comment: null,
  };
  for (let i = 0; i < DAILY_HEAD_BLOCKS; i++) row[`b${i}`] = null;
  return { ...row, ...blocks } as DailiesPayloadLightRow;
}

const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

describe("rowsToDailyNodeLight (#2325)", () => {
  it("marks the row as not loaded, with an empty content", () => {
    const node = rowsToDailyNodeLight(metaRow(), lightRow({ b0: para("a") }));
    expect(node.content).toBe("");
    expect(node.bodyLoaded).toBe(false);
    // The non-body columns still map as in the full read.
    expect(node).toMatchObject({
      id: ID,
      date: DATE,
      isPinned: true,
      updatedAt: "2026-10-20T01:00:00.000Z",
    });
  });

  it("builds headContent from the non-null blocks, in order", () => {
    const node = rowsToDailyNodeLight(
      metaRow(),
      lightRow({ b0: para("first"), b1: null, b2: para("third") }),
    );
    expect(JSON.parse(node.headContent ?? "null")).toEqual({
      type: "doc",
      content: [para("first"), para("third")],
    });
  });

  it("ignores scalar path results (a legacy plain-text body has no blocks)", () => {
    // `content_json->content->0` on a jsonb string is null in Postgres, but a
    // hand-edited row could still yield a scalar; only objects are blocks.
    const node = rowsToDailyNodeLight(
      metaRow(),
      lightRow({ b0: "text", b1: 3 }),
    );
    expect(node.headContent).toBeUndefined();
  });

  it("leaves headContent undefined when no block could be read", () => {
    const node = rowsToDailyNodeLight(metaRow(), lightRow());
    expect(node.headContent).toBeUndefined();
    expect("headContent" in node).toBe(false);
  });
});

describe("DAILIES_PAYLOAD_LIGHT_COLUMNS (#2325)", () => {
  it("does not select the body", () => {
    expect(DAILIES_PAYLOAD_LIGHT_COLUMNS).not.toMatch(
      /(^|[ ,])content_json([ ,]|$)/,
    );
  });

  it("has one JSON-path alias per head block, b0 to b23", () => {
    const aliases = DAILIES_PAYLOAD_LIGHT_COLUMNS.split(",")
      .map((c) => c.trim())
      .filter((c) => /^b\d+:/.test(c));
    expect(DAILY_HEAD_BLOCKS).toBe(24);
    expect(aliases).toHaveLength(24);
    expect(aliases[0]).toBe("b0:content_json->content->0");
    expect(aliases[23]).toBe("b23:content_json->content->23");
  });

  it("does not select password_hash", () => {
    expect(DAILIES_PAYLOAD_LIGHT_COLUMNS).not.toContain("password_hash");
  });
});

describe("SupabaseDailiesUnifiedService light reads (#2325)", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseDailiesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseDailiesUnifiedService(stub.client);
  });

  it("listDailySummariesUnified joins meta-first with the light payload columns", async () => {
    stub.stage("items_meta", "select", { data: [metaRow()], error: null });
    stub.stage("dailies_payload", "select", {
      data: [lightRow({ b0: para("head") })],
      error: null,
    });

    const out = await service.listDailySummariesUnified();

    const selects = stub.calls.filter((c) => c.op === "select");
    expect(selects.map((c) => [c.table, c.args[0]])).toEqual([
      ["items_meta", ITEMS_META_DAILY_COLUMNS],
      ["dailies_payload", DAILIES_PAYLOAD_LIGHT_COLUMNS],
    ]);
    expect(stub.calls).toContainEqual({
      table: "items_meta",
      op: "eq",
      args: ["role", "daily"],
    });
    expect(stub.calls).toContainEqual({
      table: "items_meta",
      op: "eq",
      args: ["is_deleted", false],
    });
    expect(out).toHaveLength(1);
    expect(out[0].bodyLoaded).toBe(false);
    expect(out[0].content).toBe("");
    expect(out[0].headContent).toContain("head");
  });

  it("fetchDailyBodiesUnified returns the bodies keyed by id", async () => {
    const doc = { type: "doc", content: [para("whole")] };
    stub.stage("dailies_payload", "select", {
      data: [
        { item_id: ID, content_json: doc },
        { item_id: "daily-2026-10-19", content_json: "legacy plain text" },
      ],
      error: null,
    });

    const out = await service.fetchDailyBodiesUnified([ID, "daily-2026-10-19"]);

    expect(out).toEqual({
      [ID]: JSON.stringify(doc),
      "daily-2026-10-19": "legacy plain text",
    });
    expect(stub.calls).toContainEqual({
      table: "dailies_payload",
      op: "select",
      args: ["item_id, content_json", undefined],
    });
    expect(stub.calls).toContainEqual({
      table: "dailies_payload",
      op: "in",
      args: ["item_id", [ID, "daily-2026-10-19"]],
    });
  });

  it("fetchDailyBodiesUnified with no ids sends no request", async () => {
    await expect(service.fetchDailyBodiesUnified([])).resolves.toEqual({});
    expect(stub.calls).toEqual([]);
  });

  it("fetchDailyBodiesUnified surfaces a failed read", async () => {
    stub.stage("dailies_payload", "select", {
      data: null,
      error: { message: "boom" },
    });
    await expect(service.fetchDailyBodiesUnified([ID])).rejects.toThrow(
      /fetchDailyBodiesUnified failed: boom/,
    );
  });
});
