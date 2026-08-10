import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseNotesUnifiedService } from "../src/services/SupabaseNotesUnifiedService";
import type { NoteNode } from "../src/types/note";

/*
 * #587 split guard: the write paths (create / update / move / soft-delete)
 * had no service-level pin — SupabaseNotesUnifiedService.test.ts covers the
 * DU-G PR1 additions (Trash / search / password / lock) but not these four.
 * Written against the pre-split service so the extraction has a green
 * baseline to preserve. Stub is the same in-memory query-builder as the
 * sibling suite (records calls, stages FIFO results per `<table>.<op>`).
 */

interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

interface StagedResult {
  data: unknown;
  error: { message: string } | null;
}

function makeStub() {
  const calls: RecordedCall[] = [];
  const staged: Map<string, StagedResult[]> = new Map();

  function stage(table: string, op: string, result: StagedResult): void {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (list) list.push(result);
    else staged.set(key, [result]);
  }

  function consume(table: string, op: string): StagedResult {
    const key = `${table}.${op}`;
    const list = staged.get(key);
    if (!list || list.length === 0) {
      throw new Error(
        `Stub: no staged result for ${key}. Stage one with stub.stage("${table}", "${op}", { data, error }).`,
      );
    }
    return list.shift()!;
  }

  function builderFor(table: string, op: string): unknown {
    const result = () => consume(table, op);
    const builder: Record<string, unknown> = {
      eq(_col: string, _val: unknown) {
        calls.push({ table, op: "eq", args: [_col, _val] });
        return builder;
      },
      in(_col: string, _vals: unknown[]) {
        calls.push({ table, op: "in", args: [_col, _vals] });
        return builder;
      },
      order(_col: string, _opts: unknown) {
        calls.push({ table, op: "order", args: [_col, _opts] });
        return builder;
      },
      range(_from: number, _to: number) {
        calls.push({ table, op: "range", args: [_from, _to] });
        return builder;
      },
      maybeSingle() {
        calls.push({ table, op: "maybeSingle", args: [] });
        return Promise.resolve(result());
      },
      single() {
        calls.push({ table, op: "single", args: [] });
        return Promise.resolve(result());
      },
      then(resolve: (v: StagedResult) => unknown) {
        return Promise.resolve(result()).then(resolve);
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          calls.push({ table, op: "select", args: [cols] });
          return builderFor(table, "select");
        },
        insert(rows: unknown) {
          calls.push({ table, op: "insert", args: [rows] });
          return builderFor(table, "insert");
        },
        update(patch: unknown) {
          calls.push({ table, op: "update", args: [patch] });
          return builderFor(table, "update");
        },
        delete() {
          calls.push({ table, op: "delete", args: [] });
          return builderFor(table, "delete");
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

const USER = "00000000-0000-0000-0000-000000000000";

function makeMetaRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "note-001",
    user_id: USER,
    role: "note",
    title: "Hello",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-24T10:00:00.000Z",
    updated_at: "2026-05-24T11:00:00.000Z",
    version: 3,
    ...overrides,
  };
}

function makePayloadRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    item_id: "note-001",
    user_id: USER,
    parent_item_id: null,
    parent_item_role: "note",
    note_type: "note",
    content_json: { type: "doc", content: [{ type: "paragraph" }] },
    sort_order: 0,
    is_pinned: false,
    is_edit_locked: false,
    color: null,
    icon: null,
    has_password: false,
    ...overrides,
  };
}

function makeNode(overrides: Partial<NoteNode> = {}): NoteNode {
  return {
    id: "note-001",
    type: "note",
    title: "Hello",
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T11:00:00.000Z",
    ...overrides,
  };
}

/** Stage the meta+payload pair a trailing getNoteUnified round-trip reads. */
function stageGetNote(stub: ReturnType<typeof makeStub>) {
  stub.stage("items_meta", "select", { data: makeMetaRow(), error: null });
  stub.stage("notes_payload", "select", {
    data: makePayloadRow(),
    error: null,
  });
}

describe("SupabaseNotesUnifiedService — write paths (#587 split guard)", () => {
  let stub: ReturnType<typeof makeStub>;
  let service: SupabaseNotesUnifiedService;

  beforeEach(() => {
    stub = makeStub();
    service = new SupabaseNotesUnifiedService(stub.client);
  });

  describe("createNoteUnified", () => {
    it("inserts items_meta BEFORE notes_payload (FK ordering) and strips user_id", async () => {
      stub.stage("items_meta", "insert", { data: null, error: null });
      stub.stage("notes_payload", "insert", { data: null, error: null });
      stageGetNote(stub);

      const created = await service.createNoteUnified(makeNode());
      expect(created.id).toBe("note-001");

      const inserts = stub.calls.filter((c) => c.op === "insert");
      expect(inserts.map((c) => c.table)).toEqual([
        "items_meta",
        "notes_payload",
      ]);
      // user_id is stripped so the DB default auth.uid() fills it (RLS).
      for (const call of inserts) {
        expect(call.args[0]).not.toHaveProperty("user_id");
      }
    });

    it("hard-deletes the orphan items_meta row when the payload INSERT fails (R2)", async () => {
      stub.stage("items_meta", "insert", { data: null, error: null });
      stub.stage("notes_payload", "insert", {
        data: null,
        error: { message: "boom" },
      });
      stub.stage("items_meta", "delete", { data: null, error: null });

      await expect(service.createNoteUnified(makeNode())).rejects.toThrow(
        /payload failed/,
      );

      const del = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "delete",
      );
      expect(del).toBeDefined();
      const delEq = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "eq" && c.args[0] === "id",
      );
      expect(delEq?.args[1]).toBe("note-001");
    });
  });

  describe("updateNoteUnified", () => {
    it("meta-only update (title) issues NO notes_payload UPDATE", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });
      stageGetNote(stub);

      await service.updateNoteUnified("note-001", { title: "Renamed" });

      const payloadUpdates = stub.calls.filter(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payloadUpdates).toHaveLength(0);
      const metaUpdate = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      // The meta patch always bumps updated_at (LWW cursor — DB-Q2).
      expect(metaUpdate?.args[0]).toHaveProperty("updated_at");
      expect(metaUpdate?.args[0]).toHaveProperty("title", "Renamed");
    });

    it("payload-side update (content) updates BOTH tables", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", { data: null, error: null });
      stageGetNote(stub);

      await service.updateNoteUnified("note-001", { content: "new body" });

      const metaUpdate = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect(metaUpdate?.args[0]).toHaveProperty("updated_at");
      const payloadUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payloadUpdate).toBeDefined();
    });
  });

  describe("softDeleteNoteUnified", () => {
    it("flips is_deleted + stamps deleted_at/updated_at, scoped to id AND role", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });

      await service.softDeleteNoteUnified("note-001");

      const update = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      const patch = update?.args[0] as Record<string, unknown>;
      expect(patch.is_deleted).toBe(true);
      expect(patch.deleted_at).toBeTruthy();
      expect(patch.updated_at).toBeTruthy();
      const eqs = stub.calls.filter(
        (c) => c.table === "items_meta" && c.op === "eq",
      );
      expect(eqs.map((c) => `${c.args[0]}=${c.args[1]}`)).toEqual([
        "id=note-001",
        "role=note",
      ]);
    });
  });

  describe("moveNoteUnified", () => {
    it("bumps items_meta.updated_at and patches parent/sort on notes_payload", async () => {
      stub.stage("items_meta", "update", { data: null, error: null });
      stub.stage("notes_payload", "update", { data: null, error: null });

      await service.moveNoteUnified("note-001", "note-parent", 4);

      const metaUpdate = stub.calls.find(
        (c) => c.table === "items_meta" && c.op === "update",
      );
      expect(Object.keys(metaUpdate?.args[0] as object)).toEqual([
        "updated_at",
      ]);
      const payloadUpdate = stub.calls.find(
        (c) => c.table === "notes_payload" && c.op === "update",
      );
      expect(payloadUpdate?.args[0]).toEqual({
        parent_item_id: "note-parent",
        sort_order: 4,
      });
    });
  });
});
