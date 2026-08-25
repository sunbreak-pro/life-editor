// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  requireSingleRow,
  fetchMaybeSingleRow,
  requireRowPair,
  type PostgrestSingleResult,
} from "../src/services/postgrestSingle";

/*
 * #674 / C7 — the single-row PostgREST helpers pulled out of ~50 hand-written
 * copies across 10 services.
 *
 * What is pinned here is what a reader cannot see from the signature and what
 * the call sites silently relied on: the label is a PREFIX (the three wordings
 * in the layer must survive verbatim — D-20260812-materials-2 = B), a
 * `maybeSingle` miss is `null` rather than a throw, and `requireRowPair` keeps
 * BOTH reads in flight while still reporting the FIRST label when both fail.
 */

/** Already-settled result, the shape an awaited PostgREST builder produces. */
function result(
  data: unknown,
  error: { message: string } | null = null,
): PromiseLike<PostgrestSingleResult> {
  return Promise.resolve({ data, error });
}

describe("requireSingleRow", () => {
  it("returns the row typed by the call site's type argument", async () => {
    const row = await requireSingleRow<{ id: string; done: boolean }>(
      result({ id: "task-1", done: true }),
      "createTodo tasks_payload",
    );
    expect(row.id).toBe("task-1");
    expect(row.done).toBe(true);
  });

  it("prefixes the label verbatim, adding only `: `", async () => {
    // Both wordings in the layer ride through the same helper unchanged.
    await expect(
      requireSingleRow(
        result(null, { message: "boom" }),
        "createTodo items_meta",
      ),
    ).rejects.toThrow("createTodo items_meta: boom");
    await expect(
      requireSingleRow(
        result(null, { message: "boom" }),
        "createPlaylist failed",
      ),
    ).rejects.toThrow("createPlaylist failed: boom");
  });
});

describe("fetchMaybeSingleRow", () => {
  it("returns the row when one matched", async () => {
    const row = await fetchMaybeSingleRow<{ sort_order: number }>(
      result({ sort_order: 4 }),
      "addPlaylistItem read failed",
    );
    expect(row?.sort_order).toBe(4);
  });

  it("returns null for a miss instead of throwing", async () => {
    // The call sites branch on this: some return null, some throw their own
    // worded error, some fall back to a default (max sort_order + 1).
    expect(
      await fetchMaybeSingleRow(result(null), "getNoteUnified meta failed"),
    ).toBeNull();
  });

  it("still throws label-prefixed on a query error", async () => {
    await expect(
      fetchMaybeSingleRow(
        result(null, { message: "denied" }),
        "getNoteUnified meta failed",
      ),
    ).rejects.toThrow("getNoteUnified meta failed: denied");
  });
});

describe("requireRowPair", () => {
  it("returns both rows in argument order", async () => {
    const [meta, payload] = await requireRowPair<
      { id: string },
      { item_id: string }
    >(
      result({ id: "task-1" }),
      "updateTodo read items_meta",
      result({ item_id: "task-1" }),
      "updateTodo read tasks_payload",
    );
    expect(meta.id).toBe("task-1");
    expect(payload.item_id).toBe("task-1");
  });

  it("keeps both reads in flight (the second does not wait for the first)", async () => {
    // A builder only starts on `.then()`, so a sequential `await` here would
    // silently turn one round-trip into two. The first read is gated on the
    // second having STARTED: if the helper serialised them, nothing would ever
    // release the gate and this test would time out.
    let releaseFirst!: () => void;
    const secondStarted = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first: PromiseLike<PostgrestSingleResult> = {
      then: (onfulfilled, onrejected) =>
        secondStarted
          .then(() => ({ data: { id: "meta" }, error: null }))
          .then(onfulfilled, onrejected),
    };
    const second: PromiseLike<PostgrestSingleResult> = {
      then: (onfulfilled, onrejected) => {
        releaseFirst();
        return Promise.resolve({
          data: { item_id: "payload" },
          error: null,
        }).then(onfulfilled, onrejected);
      },
    };

    const [meta, payload] = await requireRowPair<
      { id: string },
      { item_id: string }
    >(first, "read meta", second, "read payload");
    expect(meta.id).toBe("meta");
    expect(payload.item_id).toBe("payload");
  });

  it("reports the FIRST label when both reads fail", async () => {
    // Matches the hand-written order (`if (metaErr) … if (payloadErr) …`).
    await expect(
      requireRowPair(
        result(null, { message: "meta down" }),
        "updateTodo read items_meta",
        result(null, { message: "payload down" }),
        "updateTodo read tasks_payload",
      ),
    ).rejects.toThrow("updateTodo read items_meta: meta down");
  });

  it("reports the second label when only the second read fails", async () => {
    await expect(
      requireRowPair(
        result({ id: "task-1" }),
        "updateTodo read items_meta",
        result(null, { message: "payload down" }),
        "updateTodo read tasks_payload",
      ),
    ).rejects.toThrow("updateTodo read tasks_payload: payload down");
  });
});
