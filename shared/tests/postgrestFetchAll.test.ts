// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import {
  POSTGREST_PAGE_SIZE,
  POSTGREST_IN_CHUNK_SIZE,
  fetchAllPages,
  chunkIds,
  fetchByIdChunks,
  forEachIdChunk,
  forEachIdChunkReturning,
} from "../src/services/postgrestFetchAll";

/*
 * Pure-logic tests for the #172 pagination/chunking helpers. The fake
 * "server" below reproduces the PostgREST behaviours the helpers are
 * built around: `.range(from, to)` slicing and the silent max-rows cap
 * (rows past the cap are dropped, NO error).
 */

function makeRows(n: number): { id: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row-${String(i).padStart(6, "0")}`,
  }));
}

/** Simulates a table read with an optional server-side max-rows cap. */
function pageServer(rows: { id: string }[], maxRows = POSTGREST_PAGE_SIZE) {
  return (from: number, to: number) => {
    const requested = to - from + 1;
    const slice = rows.slice(from, from + Math.min(requested, maxRows));
    return Promise.resolve({ data: slice, error: null });
  };
}

describe("fetchAllPages", () => {
  it("returns everything below one page in a single request", async () => {
    const rows = makeRows(3);
    let calls = 0;
    const result = await fetchAllPages<{ id: string }>((from, to) => {
      calls++;
      return pageServer(rows)(from, to);
    }, "t");
    expect(result).toEqual(rows);
    expect(calls).toBe(1);
  });

  it("stitches multiple pages past the max-rows cap in order", async () => {
    // 012's failure shape: 2.5 pages worth of rows. A single un-paged
    // SELECT would silently return only the first POSTGREST_PAGE_SIZE.
    const rows = makeRows(POSTGREST_PAGE_SIZE * 2 + 500);
    const result = await fetchAllPages<{ id: string }>(pageServer(rows), "t");
    expect(result).toEqual(rows);
  });

  it("issues one extra empty page when the total is an exact multiple", async () => {
    const rows = makeRows(POSTGREST_PAGE_SIZE);
    let calls = 0;
    const result = await fetchAllPages<{ id: string }>((from, to) => {
      calls++;
      return pageServer(rows)(from, to);
    }, "t");
    expect(result).toEqual(rows);
    expect(calls).toBe(2); // full page → can't know it's the end → one empty read
  });

  it("returns [] for an empty table", async () => {
    const result = await fetchAllPages<{ id: string }>(pageServer([]), "t");
    expect(result).toEqual([]);
  });

  it("treats null data as an empty page (PostgREST error-shape parity)", async () => {
    const result = await fetchAllPages<{ id: string }>(
      () => Promise.resolve({ data: null, error: null }),
      "t",
    );
    expect(result).toEqual([]);
  });

  it("throws label-prefixed on page error", async () => {
    await expect(
      fetchAllPages(
        () => Promise.resolve({ data: null, error: { message: "boom" } }),
        "fetchX items_meta",
      ),
    ).rejects.toThrow("fetchX items_meta: boom");
  });
});

describe("chunkIds", () => {
  it("splits on the chunk boundary", () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE + 1).map((r) => r.id);
    const chunks = chunkIds(ids);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(POSTGREST_IN_CHUNK_SIZE);
    expect(chunks[1]).toHaveLength(1);
    expect(chunks.flat()).toEqual(ids);
  });

  it("returns no chunks for an empty list", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("returns a single chunk at exactly the chunk size", () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE).map((r) => r.id);
    expect(chunkIds(ids)).toHaveLength(1);
  });
});

describe("fetchByIdChunks", () => {
  it("concatenates chunk results in id-list order", async () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE * 2 + 10).map((r) => r.id);
    const seen: number[] = [];
    const result = await fetchByIdChunks(ids, (chunk) => {
      seen.push(chunk.length);
      return Promise.resolve(chunk.map((id) => ({ item_id: id })));
    });
    expect(seen).toEqual([
      POSTGREST_IN_CHUNK_SIZE,
      POSTGREST_IN_CHUNK_SIZE,
      10,
    ]);
    expect(result.map((r) => r.item_id)).toEqual(ids);
  });

  it("never calls fetchChunk for an empty id list", async () => {
    let calls = 0;
    const result = await fetchByIdChunks<never>([], () => {
      calls++;
      return Promise.resolve([]);
    });
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("forEachIdChunk", () => {
  it("runs the mutation once per chunk", async () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE + 5).map((r) => r.id);
    const batches: string[][] = [];
    await forEachIdChunk(
      ids,
      (chunk) => {
        batches.push(chunk);
        return Promise.resolve({ error: null });
      },
      "t",
    );
    expect(batches).toHaveLength(2);
    expect(batches.flat()).toEqual(ids);
  });

  it("throws label-prefixed and stops on the first failing chunk", async () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE * 3).map((r) => r.id);
    let calls = 0;
    await expect(
      forEachIdChunk(
        ids,
        () => {
          calls++;
          return Promise.resolve(
            calls === 2 ? { error: { message: "nope" } } : { error: null },
          );
        },
        "softDeleteRoutine events",
      ),
    ).rejects.toThrow("softDeleteRoutine events: nope");
    expect(calls).toBe(2);
  });
});

/*
 * forEachIdChunk's read-back sibling (#1140). The reason it exists is the
 * asymmetry these cases pin: a filtered write that matches nothing is
 * indistinguishable from one that matched everything unless the rows come
 * back, because PostgREST reports both as `error: null`.
 */
describe("forEachIdChunkReturning", () => {
  it("concatenates the rows every chunk actually touched", async () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE + 5).map((r) => r.id);
    const batches: string[][] = [];
    const rows = await forEachIdChunkReturning<{ id: string }>(
      ids,
      (chunk) => {
        batches.push(chunk);
        return Promise.resolve({
          data: chunk.map((id) => ({ id })),
          error: null,
        });
      },
      "t",
    );
    expect(batches).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(ids);
  });

  it("reports fewer rows than ids when the filter spared some", async () => {
    // The shape permanentDeleteRoutine reads: same request, same lack of an
    // error, fewer rows. Without the read-back the caller sees success.
    const ids = ["a", "b", "c"];
    const rows = await forEachIdChunkReturning<{ id: string }>(
      ids,
      (chunk) =>
        Promise.resolve({
          data: chunk.filter((id) => id !== "b").map((id) => ({ id })),
          error: null,
        }),
      "t",
    );
    expect(rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("treats null data as no rows touched", async () => {
    const rows = await forEachIdChunkReturning<{ id: string }>(
      ["a"],
      () => Promise.resolve({ data: null, error: null }),
      "t",
    );
    expect(rows).toEqual([]);
  });

  it("never runs for an empty id list", async () => {
    let calls = 0;
    const rows = await forEachIdChunkReturning<{ id: string }>(
      [],
      () => {
        calls++;
        return Promise.resolve({ data: [], error: null });
      },
      "t",
    );
    expect(rows).toEqual([]);
    expect(calls).toBe(0);
  });

  it("throws label-prefixed and stops on the first failing chunk", async () => {
    const ids = makeRows(POSTGREST_IN_CHUNK_SIZE * 3).map((r) => r.id);
    let calls = 0;
    await expect(
      forEachIdChunkReturning(
        ids,
        () => {
          calls++;
          return Promise.resolve(
            calls === 2
              ? { data: null, error: { message: "nope" } }
              : { data: [], error: null },
          );
        },
        "permanentDeleteRoutine events",
      ),
    ).rejects.toThrow("permanentDeleteRoutine events: nope");
    expect(calls).toBe(2);
  });
});
