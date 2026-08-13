import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE,
  IN_CHUNK_SIZE,
  DEFAULT_LIST_LIMIT,
  chunkIds,
  fetchAllPages,
  fetchByIdChunks,
  resolveListLimit,
  resolveListOffset,
} from "../src/utils/pagination.js";

/*
 * PostgREST caps every SELECT at max-rows and drops the tail with no error
 * (#360). These helpers are the only thing standing between a growing
 * collection and silently partial MCP results, so the stop condition and
 * the chunking boundaries are worth pinning down.
 */

const ids = (n: number, prefix = "id") =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

describe("chunkIds", () => {
  it("returns nothing for an empty list", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("keeps a short list in a single chunk", () => {
    expect(chunkIds(ids(3))).toEqual([["id-0", "id-1", "id-2"]]);
  });

  it("splits at IN_CHUNK_SIZE without losing or duplicating ids", () => {
    const chunks = chunkIds(ids(IN_CHUNK_SIZE * 2 + 1));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(IN_CHUNK_SIZE);
    expect(chunks[2]).toHaveLength(1);
    expect(chunks.flat()).toHaveLength(IN_CHUNK_SIZE * 2 + 1);
    expect(new Set(chunks.flat()).size).toBe(IN_CHUNK_SIZE * 2 + 1);
  });
});

describe("fetchAllPages", () => {
  it("stops on the first short page", async () => {
    const calls: Array<[number, number]> = [];
    const rows = await fetchAllPages<string>(async (from, to) => {
      calls.push([from, to]);
      return { data: ids(3), error: null };
    }, "test");

    expect(calls).toEqual([[0, PAGE_SIZE - 1]]);
    expect(rows).toHaveLength(3);
  });

  it("keeps paging while pages come back full", async () => {
    const total = PAGE_SIZE + 7;
    const all = ids(total);
    const rows = await fetchAllPages<string>(
      async (from, to) => ({ data: all.slice(from, to + 1), error: null }),
      "test",
    );

    expect(rows).toHaveLength(total);
    expect(rows[total - 1]).toBe(`id-${total - 1}`);
  });

  it("treats a null payload as the end of the collection", async () => {
    const rows = await fetchAllPages<string>(
      async () => ({ data: null, error: null }),
      "test",
    );
    expect(rows).toEqual([]);
  });

  it("surfaces a page error with its label", async () => {
    await expect(
      fetchAllPages<string>(
        async () => ({ data: null, error: { message: "boom" } }),
        "list notes",
      ),
    ).rejects.toThrow("list notes: boom");
  });
});

describe("resolveListLimit", () => {
  it("falls back to the default budget when the caller says nothing", () => {
    expect(resolveListLimit(undefined)).toBe(DEFAULT_LIST_LIMIT);
  });

  it("honours a caller-supplied cap", () => {
    expect(resolveListLimit(5)).toBe(5);
  });

  it("rejects a limit that would look like an empty collection", () => {
    // Returning nothing for limit:0 is the silent-failure shape #702 removes.
    expect(() => resolveListLimit(0)).toThrow(/positive integer/);
    expect(() => resolveListLimit(-3)).toThrow(/positive integer/);
    expect(() => resolveListLimit(2.5)).toThrow(/positive integer/);
  });

  it("treats an explicit null as unset, matching the validator's rule", () => {
    // toolSchema lets null through on optional properties; rejecting it here
    // would break calls that always worked.
    expect(resolveListLimit(null)).toBe(DEFAULT_LIST_LIMIT);
  });
});

describe("resolveListOffset", () => {
  it("defaults to the first page and accepts zero explicitly", () => {
    // offset:0 is valid where limit:0 is not — the asymmetry is the point.
    expect(resolveListOffset(undefined)).toBe(0);
    expect(resolveListOffset(null)).toBe(0);
    expect(resolveListOffset(0)).toBe(0);
    expect(resolveListOffset(7)).toBe(7);
  });

  it("rejects an offset that would slice from the tail", () => {
    expect(() => resolveListOffset(-1)).toThrow(/non-negative integer/);
    expect(() => resolveListOffset(1.5)).toThrow(/non-negative integer/);
  });
});

describe("fetchByIdChunks", () => {
  it("runs one request per chunk and concatenates the results", async () => {
    const seen: number[] = [];
    const rows = await fetchByIdChunks<string>(
      ids(IN_CHUNK_SIZE + 5),
      async (chunk) => {
        seen.push(chunk.length);
        return chunk;
      },
    );

    expect(seen).toEqual([IN_CHUNK_SIZE, 5]);
    expect(rows).toHaveLength(IN_CHUNK_SIZE + 5);
  });

  it("issues no request for an empty id list", async () => {
    let called = false;
    const rows = await fetchByIdChunks<string>([], async (chunk) => {
      called = true;
      return chunk;
    });

    expect(called).toBe(false);
    expect(rows).toEqual([]);
  });
});
