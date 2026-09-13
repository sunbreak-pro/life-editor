// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseWikiTagsUnifiedService } from "../src/services/SupabaseWikiTagsUnifiedService";
import type { WikiTagAssignmentRow } from "../src/services/wikiTagAssignmentMapper";

/*
 * Re-tagging an item does not pile up rows (#1593).
 *
 * The two implementations of "put this tag back on" had drifted: MCP
 * (mcp-server/src/handlers/wikiTagHandlers.ts) revived the soft-deleted
 * assignment, this service inserted a fresh one. `uq_wta_item_tag` only
 * constrains LIVE rows, so the INSERT was never rejected — it just left a
 * second, invisible row behind on every tag/untag cycle, and MCP's
 * `.maybeSingle()` lookup over the pair broke once a pair had two.
 *
 * Asserting that needs a stub that actually HOLDS rows: the question is how
 * many rows exist after a cycle, which a call-shape recorder cannot answer.
 * So this one is a tiny in-memory table rather than the staged-result stub
 * SupabaseWikiTagsUnifiedService.bulk.test.ts uses — including the partial
 * unique index, so an implementation that goes back to inserting over a LIVE
 * row fails here the way Postgres would.
 */

const NOW = "2026-09-13T00:00:00.000Z";

interface StubTable {
  rows: WikiTagAssignmentRow[];
  /** Every write the service issued, in order. */
  writes: Array<{ op: "insert" | "update"; values: Record<string, unknown> }>;
}

function makeStub(initial: WikiTagAssignmentRow[] = []): {
  client: SupabaseClient;
  table: StubTable;
} {
  const table: StubTable = { rows: [...initial], writes: [] };

  function builder(
    op: "select" | "insert" | "update",
    values?: Record<string, unknown>,
  ): Record<string, unknown> {
    const filters: Record<string, unknown> = {};
    const orders: Array<{ column: string; ascending: boolean }> = [];
    let limit: number | undefined;

    const matching = (): WikiTagAssignmentRow[] => {
      let rows = table.rows.filter((r) =>
        Object.entries(filters).every(
          (entry) =>
            (r as unknown as Record<string, unknown>)[entry[0]] === entry[1],
        ),
      );
      for (const { column, ascending } of [...orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = (a as unknown as Record<string, unknown>)[column];
          const y = (b as unknown as Record<string, unknown>)[column];
          const diff = x === y ? 0 : String(x) < String(y) ? -1 : 1;
          return ascending ? diff : -diff;
        });
      }
      return limit === undefined ? rows : rows.slice(0, limit);
    };

    const run = (): { data: unknown; error: { message: string } | null } => {
      if (op === "select") return { data: matching(), error: null };
      if (op === "insert") {
        const row = (values ?? {}) as Partial<WikiTagAssignmentRow>;
        const clash = table.rows.some(
          (r) =>
            !r.is_deleted &&
            r.item_id === row.item_id &&
            r.tag_id === row.tag_id,
        );
        if (clash) {
          // What Postgres answers through PostgREST for uq_wta_item_tag.
          return {
            data: null,
            error: {
              message:
                'duplicate key value violates unique constraint "uq_wta_item_tag"',
            },
          };
        }
        // The column defaults the table carries, spelled out: `...row` after
        // them would be a TS2783 overwrite of required fields.
        const stored: WikiTagAssignmentRow = {
          id: String(row.id),
          user_id: row.user_id ?? "u1",
          item_id: String(row.item_id),
          tag_id: String(row.tag_id),
          created_at: row.created_at ?? NOW,
          updated_at: row.updated_at ?? NOW,
          is_display_color: row.is_display_color ?? false,
          is_deleted: row.is_deleted ?? false,
          deleted_at: row.deleted_at ?? null,
        };
        table.rows.push(stored);
        table.writes.push({ op, values: { ...row } });
        return { data: [stored], error: null };
      }
      const touched = matching();
      for (const row of touched) {
        Object.assign(row, values);
      }
      table.writes.push({ op, values: { ...(values ?? {}) } });
      return { data: touched, error: null };
    };

    const self: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        filters[column] = value;
        return self;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orders.push({ column, ascending: options?.ascending !== false });
        return self;
      },
      limit(count: number) {
        limit = count;
        return self;
      },
      select() {
        return self;
      },
      maybeSingle: async () => {
        const { data, error } = run();
        const rows = (data ?? []) as unknown[];
        if (rows.length > 1) {
          // PGRST116 — the failure the old duplicate rows caused in MCP.
          return {
            data: null,
            error: { message: "JSON object requested, multiple rows returned" },
          };
        }
        return { data: rows[0] ?? null, error };
      },
      single: async () => {
        const { data, error } = run();
        const rows = (data ?? []) as unknown[];
        if (error) return { data: null, error };
        return { data: rows[0] ?? null, error: null };
      },
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(run()).then(resolve, reject),
    };
    return self;
  }

  const client = {
    from() {
      return {
        select: () => builder("select"),
        insert: (values: Record<string, unknown>) => builder("insert", values),
        update: (values: Record<string, unknown>) => builder("update", values),
      };
    },
  } as unknown as SupabaseClient;

  return { client, table };
}

describe("assignTagToItem — one row per item×tag pair (#1593)", () => {
  it("reuses the soft-deleted row instead of inserting a second one", async () => {
    const { client, table } = makeStub();
    const svc = new SupabaseWikiTagsUnifiedService(client);

    const first = await svc.assignTagToItem("tag_assign-1", "task-1", "tag-a");
    expect(table.rows).toHaveLength(1);

    await svc.unassignTagFromItem(first.id);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].is_deleted).toBe(true);

    const again = await svc.assignTagToItem("tag_assign-2", "task-1", "tag-a");

    // The point of the issue: still ONE row, and it is the original.
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].is_deleted).toBe(false);
    expect(table.rows[0].deleted_at).toBeNull();
    expect(again.id).toBe("tag_assign-1");
    expect(table.writes.filter((w) => w.op === "insert")).toHaveLength(1);
  });

  it("keeps created_at, so re-tagging does not re-order 'the tag put on first'", async () => {
    // 0030 added created_at precisely because reviving moves updated_at;
    // #1580 picks an item's default colour by created_at ascending.
    const { client, table } = makeStub([
      {
        id: "tag_assign-1",
        user_id: "u1",
        item_id: "task-1",
        tag_id: "tag-a",
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
        is_display_color: true,
        is_deleted: true,
        deleted_at: "2026-08-01T00:00:00.000Z",
      },
    ]);
    const svc = new SupabaseWikiTagsUnifiedService(client);

    const revived = await svc.assignTagToItem(
      "tag_assign-9",
      "task-1",
      "tag-a",
    );

    expect(table.rows).toHaveLength(1);
    expect(revived.createdAt).toBe("2026-05-01T00:00:00.000Z");
    expect(revived.updatedAt).not.toBe("2026-08-01T00:00:00.000Z");
    // The explicit display-colour pick comes back with the tag. It cannot
    // collide with the partial UNIQUE: setDisplayColorTag clears every row of
    // the item before marking one, so at most one row per item carries it.
    expect(revived.isDisplayColor).toBe(true);
  });

  it("is a no-op when the pair is already live", async () => {
    const { client, table } = makeStub();
    const svc = new SupabaseWikiTagsUnifiedService(client);

    const first = await svc.assignTagToItem("tag_assign-1", "task-1", "tag-a");
    const second = await svc.assignTagToItem("tag_assign-2", "task-1", "tag-a");

    expect(table.rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(table.writes).toHaveLength(1); // no second insert, no pointless update
  });

  it("still inserts for a pair that has never been assigned", async () => {
    const { client, table } = makeStub([
      {
        id: "tag_assign-other",
        user_id: "u1",
        item_id: "task-1",
        tag_id: "tag-b",
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
        is_display_color: false,
        is_deleted: false,
        deleted_at: null,
      },
    ]);
    const svc = new SupabaseWikiTagsUnifiedService(client);

    const created = await svc.assignTagToItem(
      "tag_assign-1",
      "task-1",
      "tag-a",
    );

    expect(created.id).toBe("tag_assign-1");
    expect(table.rows).toHaveLength(2);
  });
});
