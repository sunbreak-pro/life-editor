import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  createSupabaseStub,
  type QueryCall,
  type RpcAnswer,
  type SupabaseStub,
} from "./supabaseStub.js";

let stub: SupabaseStub = createSupabaseStub();
vi.mock("../src/supabase.js", () => ({
  getSupabase: async () => stub,
}));

const { updateNote } = await import("../src/handlers/noteHandlers.js");
const { resetNoteContentWriteState } =
  await import("../src/utils/noteContentWrite.js");

/*
 * #2057 NOTE-SYNC-5 — `update_note` refuses a body built on an old read.
 *
 * The incident: a note open in the app was updated through MCP, and the app's
 * next autosave wrote its old buffer back over it. The app now saves against
 * the version it opened; this suite pins the same rule on the MCP side, so a
 * body Claude composed from a stale `get_note` cannot erase what the user typed
 * in the meantime — and so the refusal tells Claude how to recover.
 */

const STORED = "2026-10-01T09:09:00.123456+00:00";

/** Answers getNoteRows' reads; `returning` answers the fallback's UPDATE. */
const rows =
  (returning: unknown[] = [{ updated_at: "2026-10-01T09:12:00.000Z" }]) =>
  (call: QueryCall) => {
    if (call.op === "update") return returning;
    return call.table === "items_meta"
      ? {
          id: "note-1",
          title: "N",
          is_deleted: false,
          deleted_at: null,
          created_at: "2026-08-01T00:00:00Z",
          updated_at: STORED,
        }
      : {
          item_id: "note-1",
          note_type: "note",
          content_json: null,
          is_pinned: false,
          color: null,
          has_password: false,
        };
  };

const rpcCalls = (s: SupabaseStub) => s.calls.filter((c) => c.op === "rpc");
const plainWrites = (s: SupabaseStub) =>
  s.writes().filter((c) => c.op !== "rpc");

beforeEach(() => {
  resetNoteContentWriteState();
});

describe("update_note body write (RPC present)", () => {
  it("writes the body through update_note_content against the version it read", async () => {
    const saved: RpcAnswer = () => ({
      data: [{ saved: true, updated_at: "2026-10-01T09:12:00+00:00" }],
    });
    stub = createSupabaseStub(rows(), saved);

    await updateNote({ id: "note-1", content: "- [x] done", title: "T" });

    const [call] = rpcCalls(stub);
    expect(call.table).toBe("update_note_content");
    expect(call.values).toMatchObject({
      p_id: "note-1",
      p_expected_updated_at: STORED,
      p_title: "T",
    });
    expect(call.values?.p_content).toMatchObject({ type: "doc" });
    // The title rode along with the body: no second meta write for it.
    expect(plainWrites(stub)).toHaveLength(0);
  });

  it("refuses with a recoverable error when the note moved on, writing nothing else", async () => {
    const refused: RpcAnswer = () => ({
      data: [
        {
          saved: false,
          updated_at: "2026-10-01T09:15:00+00:00",
          content_json: null,
        },
      ],
    });
    stub = createSupabaseStub(rows(), refused);

    await expect(
      updateNote({ id: "note-1", content: "new", is_pinned: true }),
    ).rejects.toThrow(/changed after you read it[\s\S]*get_note/);
    expect(plainWrites(stub)).toHaveLength(0);
  });
});

describe("update_note expected_updated_at", () => {
  it("refuses before any write when the caller's version is stale", async () => {
    stub = createSupabaseStub(rows());

    await expect(
      updateNote({
        id: "note-1",
        content: "new",
        expected_updated_at: "2026-10-01T09:00:00.000Z",
      }),
    ).rejects.toThrow(/expected updated_at 2026-10-01T09:00:00.000Z/);
    expect(stub.writes()).toHaveLength(0);
  });

  it("accepts the same instant spelled differently (Z vs +00:00)", async () => {
    const saved: RpcAnswer = () => ({
      data: [{ saved: true, updated_at: "2026-10-01T09:12:00+00:00" }],
    });
    stub = createSupabaseStub(rows(), saved);

    await updateNote({
      id: "note-1",
      content: "new",
      expected_updated_at: "2026-10-01T09:09:00.123456Z",
    });

    expect(rpcCalls(stub)).toHaveLength(1);
  });

  it("tells versions a microsecond apart apart", async () => {
    stub = createSupabaseStub(rows());

    await expect(
      updateNote({
        id: "note-1",
        content: "new",
        expected_updated_at: "2026-10-01T09:09:00.123999+00:00",
      }),
    ).rejects.toThrow(/changed after you read it/);
    expect(stub.writes()).toHaveLength(0);
  });

  it("succeeds on the retry the error asks for", async () => {
    const saved: RpcAnswer = () => ({
      data: [{ saved: true, updated_at: "2026-10-01T09:12:00+00:00" }],
    });
    stub = createSupabaseStub(rows(), saved);
    const stale = updateNote({
      id: "note-1",
      content: "new",
      expected_updated_at: "2026-10-01T08:00:00Z",
    });
    await expect(stale).rejects.toThrow(/get_note/);

    // get_note returns the stored version; passing it back goes through.
    await updateNote({
      id: "note-1",
      content: "new",
      expected_updated_at: STORED,
    });
    expect(rpcCalls(stub)).toHaveLength(1);
  });

  it("checks a pin-only call too, so a stale call changes nothing", async () => {
    stub = createSupabaseStub(rows());

    await expect(
      updateNote({
        id: "note-1",
        is_pinned: true,
        expected_updated_at: "2026-09-30T00:00:00Z",
      }),
    ).rejects.toThrow(/Nothing was written/);
    expect(stub.writes()).toHaveLength(0);
  });
});

describe("update_note body write (migration 0032 not pushed yet)", () => {
  const missing: RpcAnswer = () => ({
    error: { code: "PGRST202", message: "Could not find the function" },
  });

  it("falls back to a conditional UPDATE on items_meta, then writes the body", async () => {
    stub = createSupabaseStub(rows(), missing);

    await updateNote({ id: "note-1", content: "new" });

    const writes = plainWrites(stub);
    expect(writes[0].table).toBe("items_meta");
    expect(writes[0].filters).toMatchObject({
      id: "note-1",
      role: "note",
      updated_at: STORED,
    });
    expect(writes[1].table).toBe("notes_payload");
    expect(writes[1].values).toHaveProperty("content_json");
  });

  it("refuses when the conditional UPDATE matched no row", async () => {
    stub = createSupabaseStub(rows([]), missing);

    await expect(updateNote({ id: "note-1", content: "new" })).rejects.toThrow(
      /changed after you read it/,
    );
    expect(plainWrites(stub).some((c) => c.table === "notes_payload")).toBe(
      false,
    );
  });
});
