// @vitest-environment node (no DOM — service over the PostgREST stub)
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SupabaseDailiesUnifiedService } from "../src/services/SupabaseDailiesUnifiedService";
import { isOwnEcho, resetOwnWriteLedger } from "../src/services/ownWriteLedger";
import { makeStub, USER } from "./helpers/supabaseNotesStub";

/*
 * #2325 — a Daily save is one RPC (`save_daily_content`, migration 0043).
 *
 * It used to be six requests (look the day up by date, read its meta, bump
 * the meta, write the payload, read both back), and the editor saves every
 * 800ms while typing. These tests pin the call shape, the mapping of the row
 * the function hands back, and the fallback: until 0043 is pushed the
 * function does not exist, so a "no such function" answer drops this save —
 * and every later one on the same service — onto the old path. Any other
 * error is a real failure and must not be papered over by a second write.
 */

const DATE = "2026-10-20";
const ID = `daily-${DATE}`;
const BODY = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
});
const NOW = "2026-10-20T09:30:00.000Z";

/** One row of save_daily_content: meta and payload side by side. */
function saveRow(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    user_id: USER,
    role: "daily",
    title: DATE,
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-10-20T00:00:00.000Z",
    updated_at: NOW,
    item_id: ID,
    date: DATE,
    content_json: JSON.parse(BODY),
    is_pinned: true,
    is_edit_locked: false,
    has_password: true,
    evening_published_at: "2026-10-20T20:00:00.000Z",
    evening_notes: { mood: "4" },
    morning_comment: ["good morning"],
    ...over,
  };
}

function metaRow() {
  return {
    id: ID,
    user_id: USER,
    role: "daily",
    title: DATE,
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-10-20T00:00:00.000Z",
    updated_at: NOW,
  };
}

function payloadRow(content: unknown) {
  return {
    item_id: ID,
    user_id: USER,
    date: DATE,
    content_json: content,
    is_pinned: false,
    is_edit_locked: false,
    has_password: false,
  };
}

/** The error PostgREST answers when the function is not in its schema cache. */
function rpcError(code: string, message = "function not found") {
  // A variable, not a literal: the stub's error type only names `message`.
  const error = { message, code };
  return { data: null, error };
}

type Stub = ReturnType<typeof makeStub>;

/** Stage the old six-request update path for an existing day. */
function stageOldUpdatePath(stub: Stub, content: unknown) {
  // getDailyByDateUnified: payload by date, then meta by id.
  stub.stage("dailies_payload", "select", {
    data: payloadRow({ type: "doc", content: [] }),
    error: null,
  });
  stub.stage("items_meta", "select", { data: metaRow(), error: null });
  // updateDailyUnified: meta bump, payload write, both read back.
  stub.stage("items_meta", "update", { data: null, error: null });
  stub.stage("dailies_payload", "update", { data: null, error: null });
  stub.stage("items_meta", "select", { data: metaRow(), error: null });
  stub.stage("dailies_payload", "select", {
    data: payloadRow(content),
    error: null,
  });
}

const rpcCalls = (stub: Stub) => stub.calls.filter((c) => c.op === "rpc");

describe("upsertDailyByDateUnified → save_daily_content (#2325)", () => {
  let stub: Stub;
  let service: SupabaseDailiesUnifiedService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    stub = makeStub();
    service = new SupabaseDailiesUnifiedService(stub.client);
    resetOwnWriteLedger();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends one RPC with the date, the body as JSON and an ISO stamp", async () => {
    stub.stage("save_daily_content", "rpc", { data: [saveRow()], error: null });

    await service.upsertDailyByDateUnified(DATE, BODY);

    expect(stub.calls).toEqual([
      {
        table: "save_daily_content",
        op: "rpc",
        args: [
          {
            p_date: DATE,
            // The parsed object, not the string: the column is jsonb.
            p_content: JSON.parse(BODY),
            p_updated_at: NOW,
          },
        ],
      },
    ]);
  });

  it("sends null for an empty body (the column's empty value)", async () => {
    stub.stage("save_daily_content", "rpc", {
      data: [saveRow({ content_json: null })],
      error: null,
    });
    const node = await service.upsertDailyByDateUnified(DATE, "");
    expect(
      (rpcCalls(stub)[0].args[0] as { p_content: unknown }).p_content,
    ).toBeNull();
    expect(node.content).toBe("");
  });

  it("maps the returned row to a DailyNode, password_hash never included", async () => {
    stub.stage("save_daily_content", "rpc", {
      // A row that (wrongly) carried the hash must still not leak it.
      data: [saveRow({ password_hash: "pbkdf2$secret" })],
      error: null,
    });

    const node = await service.upsertDailyByDateUnified(DATE, BODY);

    expect(node).toMatchObject({
      id: ID,
      date: DATE,
      content: BODY,
      createdAt: "2026-10-20T00:00:00.000Z",
      updatedAt: NOW,
      isPinned: true,
      hasPassword: true,
      isEditLocked: false,
      isDeleted: false,
      eveningPublishedAt: "2026-10-20T20:00:00.000Z",
      eveningNotes: { mood: "4" },
      morningComment: ["good morning"],
    });
    expect(JSON.stringify(node)).not.toContain("secret");
    expect(JSON.stringify(node)).not.toContain("password_hash");
  });

  it("accepts a single object as well as an array", async () => {
    stub.stage("save_daily_content", "rpc", { data: saveRow(), error: null });
    const node = await service.upsertDailyByDateUnified(DATE, BODY);
    expect(node.id).toBe(ID);
  });

  it("throws when the RPC hands back no row", async () => {
    stub.stage("save_daily_content", "rpc", { data: [], error: null });
    await expect(service.upsertDailyByDateUnified(DATE, BODY)).rejects.toThrow(
      /no row came back/,
    );
    // No silent second write on the old path.
    expect(stub.calls.filter((c) => c.op !== "rpc")).toEqual([]);
  });

  it.each(["PGRST202", "42883"])(
    "falls back to the old path on %s, and stops calling the RPC",
    async (code) => {
      stub.stage("save_daily_content", "rpc", rpcError(code));
      stageOldUpdatePath(stub, JSON.parse(BODY));

      const first = await service.upsertDailyByDateUnified(DATE, BODY);
      expect(first.content).toBe(BODY);
      expect(rpcCalls(stub)).toHaveLength(1);
      expect(stub.calls).toContainEqual({
        table: "dailies_payload",
        op: "update",
        args: [{ content_json: JSON.parse(BODY) }],
      });

      // The next save goes straight down the old path.
      const second = JSON.stringify({ type: "doc", content: [] });
      stageOldUpdatePath(stub, JSON.parse(second));
      const node = await service.upsertDailyByDateUnified(DATE, second);
      expect(node.content).toBe(second);
      expect(rpcCalls(stub)).toHaveLength(1);
    },
  );

  it("throws on any other RPC error, without falling back", async () => {
    stub.stage(
      "save_daily_content",
      "rpc",
      rpcError("42501", "permission denied"),
    );

    await expect(service.upsertDailyByDateUnified(DATE, BODY)).rejects.toThrow(
      "upsertDailyByDateUnified failed: permission denied",
    );
    expect(stub.calls.filter((c) => c.op !== "rpc")).toEqual([]);

    // Not latched: the next save tries the RPC again.
    stub.stage("save_daily_content", "rpc", { data: [saveRow()], error: null });
    await service.upsertDailyByDateUnified(DATE, BODY);
    expect(rpcCalls(stub)).toHaveLength(2);
  });

  it("rejects a malformed date before any request", async () => {
    await expect(
      service.upsertDailyByDateUnified("2026/10/20", BODY),
    ).rejects.toThrow(/invalid date/);
    expect(stub.calls).toEqual([]);
  });

  describe("own echo (#2325 follow-up to #2290)", () => {
    // Postgres hands the same instant back in its own spelling.
    const NOW_FROM_PG = "2026-10-20T09:30:00+00:00";

    it("records the meta and payload rows, so their echoes refetch nothing", async () => {
      stub.stage("save_daily_content", "rpc", {
        data: [saveRow()],
        error: null,
      });

      await service.upsertDailyByDateUnified(DATE, BODY, { ownEcho: true });

      expect(isOwnEcho("items_meta", { id: ID, updated_at: NOW_FROM_PG })).toBe(
        true,
      );
      expect(isOwnEcho("dailies_payload", { item_id: ID })).toBe(true);
    });

    it("records before the request, so an echo that outruns the answer matches", async () => {
      let echoBeforeAnswer: boolean | null = null;
      const rpc = stub.client.rpc.bind(stub.client);
      vi.spyOn(stub.client, "rpc").mockImplementation(((
        ...args: Parameters<typeof rpc>
      ) => {
        echoBeforeAnswer = isOwnEcho("items_meta", {
          id: ID,
          updated_at: NOW,
        });
        return rpc(...args);
      }) as typeof rpc);
      stub.stage("save_daily_content", "rpc", {
        data: [saveRow()],
        error: null,
      });

      await service.upsertDailyByDateUnified(DATE, BODY, { ownEcho: true });

      expect(echoBeforeAnswer).toBe(true);
    });

    it("records nothing without ownEcho", async () => {
      stub.stage("save_daily_content", "rpc", {
        data: [saveRow()],
        error: null,
      });

      await service.upsertDailyByDateUnified(DATE, BODY);

      expect(isOwnEcho("items_meta", { id: ID, updated_at: NOW })).toBe(false);
      expect(isOwnEcho("dailies_payload", { item_id: ID })).toBe(false);
    });

    it("does not take another device's later write to the day for ours", async () => {
      stub.stage("save_daily_content", "rpc", {
        data: [saveRow()],
        error: null,
      });

      await service.upsertDailyByDateUnified(DATE, BODY, { ownEcho: true });

      expect(
        isOwnEcho("items_meta", {
          id: ID,
          updated_at: "2026-10-20T09:30:01.000Z",
        }),
      ).toBe(false);
    });

    it("records a day whose id names another date from the answer", async () => {
      // The function finds the day by date, so its id need not match the date.
      const legacy = "daily-2026-10-19";
      stub.stage("save_daily_content", "rpc", {
        data: [saveRow({ id: legacy, item_id: legacy })],
        error: null,
      });

      await service.upsertDailyByDateUnified(DATE, BODY, { ownEcho: true });

      expect(isOwnEcho("items_meta", { id: legacy, updated_at: NOW })).toBe(
        true,
      );
      expect(isOwnEcho("dailies_payload", { item_id: legacy })).toBe(true);
    });
  });
});
