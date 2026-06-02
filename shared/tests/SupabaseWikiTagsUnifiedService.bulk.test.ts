import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseWikiTagsUnifiedService } from "../src/services/SupabaseWikiTagsUnifiedService";

/*
 * Service-level tests for the two bulk-load methods added to eliminate the
 * TagPicker / LinkPanel per-row N+1 fetches:
 *   - listAllTagAssignments()  → one wiki_tag_assignments query
 *   - listAllTagConnections()  → one wiki_tag_connections query
 *
 * Mirrors the in-memory query-builder stub from
 * SupabaseNotesUnifiedService.test.ts: it records (table, op, args) calls
 * and lets each test stage a single `{ data, error }` result consumed at
 * the terminal `await`. Filter chain methods (.eq) are recorded no-ops so
 * a test asserts the query shape via `.calls` rather than modelling
 * PostgREST semantics.
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
      throw new Error(`Stub: no staged result for ${key}.`);
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
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls, stage };
}

describe("SupabaseWikiTagsUnifiedService — bulk loaders (N+1 elimination)", () => {
  describe("listAllTagAssignments", () => {
    it("maps rows from a single wiki_tag_assignments select filtered on is_deleted=false", async () => {
      const { client, calls, stage } = makeStub();
      stage("wiki_tag_assignments", "select", {
        data: [
          {
            id: "tag_assign-1",
            user_id: "u1",
            item_id: "task-1",
            tag_id: "tag-a",
            updated_at: "2026-06-01T00:00:00.000Z",
            is_deleted: false,
            deleted_at: null,
          },
          {
            id: "tag_assign-2",
            user_id: "u1",
            item_id: "task-2",
            tag_id: "tag-b",
            updated_at: "2026-06-01T00:00:00.000Z",
            is_deleted: false,
            deleted_at: null,
          },
        ],
        error: null,
      });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      const result = await svc.listAllTagAssignments();

      expect(result).toEqual([
        {
          id: "tag_assign-1",
          itemId: "task-1",
          tagId: "tag-a",
          updatedAt: "2026-06-01T00:00:00.000Z",
          isDeleted: false,
          deletedAt: null,
        },
        {
          id: "tag_assign-2",
          itemId: "task-2",
          tagId: "tag-b",
          updatedAt: "2026-06-01T00:00:00.000Z",
          isDeleted: false,
          deletedAt: null,
        },
      ]);
      // Exactly one select on the assignments table (no per-item fan-out).
      expect(
        calls.filter(
          (c) => c.table === "wiki_tag_assignments" && c.op === "select",
        ),
      ).toHaveLength(1);
      expect(
        calls.some(
          (c) =>
            c.op === "eq" && c.args[0] === "is_deleted" && c.args[1] === false,
        ),
      ).toBe(true);
    });

    it("returns [] when data is null", async () => {
      const { client, stage } = makeStub();
      stage("wiki_tag_assignments", "select", { data: null, error: null });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      await expect(svc.listAllTagAssignments()).resolves.toEqual([]);
    });

    it("throws on a Supabase error", async () => {
      const { client, stage } = makeStub();
      stage("wiki_tag_assignments", "select", {
        data: null,
        error: { message: "boom" },
      });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      await expect(svc.listAllTagAssignments()).rejects.toThrow(
        /listAllTagAssignments failed: boom/,
      );
    });
  });

  describe("listAllTagConnections", () => {
    it("maps rows from a single wiki_tag_connections select filtered on is_deleted=false", async () => {
      const { client, calls, stage } = makeStub();
      stage("wiki_tag_connections", "select", {
        data: [
          {
            id: "link-1",
            user_id: "u1",
            from_item_id: "note-1",
            to_item_id: "task-9",
            updated_at: "2026-06-01T00:00:00.000Z",
            is_deleted: false,
            deleted_at: null,
          },
        ],
        error: null,
      });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      const result = await svc.listAllTagConnections();

      expect(result).toEqual([
        {
          id: "link-1",
          fromItemId: "note-1",
          toItemId: "task-9",
          updatedAt: "2026-06-01T00:00:00.000Z",
          isDeleted: false,
          deletedAt: null,
        },
      ]);
      expect(
        calls.filter(
          (c) => c.table === "wiki_tag_connections" && c.op === "select",
        ),
      ).toHaveLength(1);
      expect(
        calls.some(
          (c) =>
            c.op === "eq" && c.args[0] === "is_deleted" && c.args[1] === false,
        ),
      ).toBe(true);
    });

    it("returns [] when data is null", async () => {
      const { client, stage } = makeStub();
      stage("wiki_tag_connections", "select", { data: null, error: null });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      await expect(svc.listAllTagConnections()).resolves.toEqual([]);
    });

    it("throws on a Supabase error", async () => {
      const { client, stage } = makeStub();
      stage("wiki_tag_connections", "select", {
        data: null,
        error: { message: "kaboom" },
      });
      const svc = new SupabaseWikiTagsUnifiedService(client);

      await expect(svc.listAllTagConnections()).rejects.toThrow(
        /listAllTagConnections failed: kaboom/,
      );
    });
  });
});
