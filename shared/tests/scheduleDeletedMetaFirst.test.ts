// @vitest-environment node (no DOM)
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseScheduleItemsService } from "../src/services/SupabaseScheduleItemsService";

/*
 * #2326 — the trashed-events read starts from items_meta.
 *
 * It used to start from events_payload with no filter at all (`is_deleted`
 * lives on the meta row), paging through the whole event history and then
 * every id's meta to keep the few in the Trash. Pinned here: the first read
 * is the trashed event metas, and an empty Trash never
 * touches events_payload.
 */

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

function makeClient(metaRows: unknown[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        select(cols: string) {
          calls.push({ table, method: "select", args: [cols] });
          const builder: Record<string, unknown> = {};
          for (const method of ["eq", "in", "order", "range"]) {
            builder[method] = (...args: unknown[]) => {
              calls.push({ table, method, args });
              return builder;
            };
          }
          builder.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: table === "items_meta" ? metaRows : [],
              error: null,
            }).then(resolve);
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("fetchDeletedScheduleItems reads the trashed metas first (#2326)", () => {
  it("asks items_meta for trashed events, in id order", async () => {
    const { client, calls } = makeClient([]);
    await new SupabaseScheduleItemsService(client).fetchDeletedScheduleItems();

    expect(calls[0]).toMatchObject({ table: "items_meta", method: "select" });
    const metaCalls = calls.filter((c) => c.table === "items_meta");
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      method: "eq",
      args: ["role", "event"],
    });
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      method: "eq",
      args: ["is_deleted", true],
    });
    // Same order the Trash showed before (#2326 changes the read, not the list).
    expect(metaCalls).toContainEqual({
      table: "items_meta",
      method: "order",
      args: ["id"],
    });
  });

  it("never reads events_payload when the Trash is empty", async () => {
    const { client, calls } = makeClient([]);
    const out = await new SupabaseScheduleItemsService(
      client,
    ).fetchDeletedScheduleItems();

    expect(out).toEqual([]);
    expect(calls.some((c) => c.table === "events_payload")).toBe(false);
  });

  it("reads only the trashed ids' payload rows", async () => {
    const { client, calls } = makeClient([
      { id: "event-1" },
      { id: "event-2" },
    ]);
    await new SupabaseScheduleItemsService(client).fetchDeletedScheduleItems();

    expect(calls).toContainEqual({
      table: "events_payload",
      method: "in",
      args: ["item_id", ["event-1", "event-2"]],
    });
  });
});
