import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DailyNode } from "../src/types/daily";

/*
 * #2309 — on a slow network, typing into a day that has no Daily yet created
 * it twice: the editor's next debounced save read "no row" before the first
 * create had landed, both inserted `daily-<date>`, and the second hit
 * duplicate key (409).
 *
 * The fake server below has the real upsert's shape (read the row, update it
 * when present, create it when absent) and holds each create's response until
 * the test releases it — the 1500ms delay chat-main reproduced it with. A
 * second create of the same date fails with the error the service throws.
 */

const DATE = "2026-10-19";
const STAMP = "2026-10-19T00:00:00.000Z";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    {
      value: {
        syncVersion: 0,
        domainVersions: uniformDomainVersions(0),
        triggerSync: async () => {},
      },
    },
    children,
  );
}

function slowServer(opts: { failFirstCreate?: boolean } = {}) {
  const rows = new Map<string, DailyNode>();
  const pendingCreates: Array<() => void> = [];
  const log: string[] = [];
  let failNext = opts.failFirstCreate ?? false;

  const upsert = vi.fn(
    async (date: string, content: string): Promise<DailyNode> => {
      const existing = rows.get(date);
      if (existing) {
        log.push(`update:${content}`);
        const next = { ...existing, content };
        rows.set(date, next);
        return next;
      }
      log.push(`create:${content}`);
      await new Promise<void>((release) => pendingCreates.push(release));
      if (failNext) {
        failNext = false;
        throw new Error("createDailyUnified meta failed: Failed to fetch");
      }
      if (rows.has(date)) {
        throw new Error(
          'createDailyUnified meta failed: duplicate key value violates unique constraint "items_meta_pkey"',
        );
      }
      const node: DailyNode = {
        id: `daily-${date}`,
        date,
        content,
        createdAt: STAMP,
        updatedAt: STAMP,
      };
      rows.set(date, node);
      return node;
    },
  );

  const ds = stubDataService({
    listDailySummariesUnified: () => Promise.resolve([]),
    upsertDailyByDateUnified: upsert,
  });

  /** Let the oldest held create's response arrive. */
  const releaseCreate = async (): Promise<void> => {
    await act(async () => {
      pendingCreates.shift()?.();
    });
  };

  return { ds, rows, log, upsert, releaseCreate, pendingCreates };
}

async function mountHook(ds: ReturnType<typeof slowServer>["ds"]) {
  const hook = renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
    wrapper,
  });
  // Let the mount load settle first — its setDailies([]) would otherwise
  // land on top of the optimistic insert.
  await act(async () => {});
  return hook;
}

describe("useDailiesUnifiedAPI — a day's first create on a slow network (#2309)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends one create and turns the saves typed behind it into updates", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = slowServer();
    const { result } = await mountHook(server.ds);

    const saves: Array<Promise<DailyNode | null>> = [];
    await act(async () => {
      saves.push(result.current.upsertDaily(DATE, "a"));
    });
    await act(async () => {
      saves.push(result.current.upsertDaily(DATE, "ab"));
    });
    await act(async () => {
      saves.push(result.current.upsertDaily(DATE, "abc"));
    });

    // The create has not answered yet: only it has gone out.
    expect(server.upsert).toHaveBeenCalledTimes(1);
    expect(server.pendingCreates).toHaveLength(1);

    await server.releaseCreate();
    const settled = await Promise.all(saves);

    expect(server.log).toEqual(["create:a", "update:ab", "update:abc"]);
    expect(settled.map((n) => n?.content)).toEqual(["a", "ab", "abc"]);
    expect(server.rows.get(DATE)?.content).toBe("abc");
    expect(warn).not.toHaveBeenCalled();
  });

  it("lets writes to a day that already exists run side by side again", async () => {
    const server = slowServer();
    const { result } = await mountHook(server.ds);

    let first: Promise<DailyNode | null> | undefined;
    await act(async () => {
      first = result.current.upsertDaily(DATE, "a");
    });
    await server.releaseCreate();
    await first;

    // Hold the next two updates open; both must be sent before either lands.
    const held: Array<() => void> = [];
    server.upsert.mockImplementation(
      (date: string, content: string) =>
        new Promise<DailyNode>((resolve) => {
          held.push(() => resolve({ ...server.rows.get(date)!, content }));
        }),
    );
    let second: Promise<DailyNode | null> | undefined;
    let third: Promise<DailyNode | null> | undefined;
    await act(async () => {
      second = result.current.upsertDaily(DATE, "ab");
      third = result.current.upsertDaily(DATE, "abc");
    });

    expect(server.upsert).toHaveBeenCalledTimes(3);
    held.forEach((release) => release());
    await expect(second).resolves.toMatchObject({ content: "ab" });
    await expect(third).resolves.toMatchObject({ content: "abc" });
  });

  it("still saves the queued text when the first create fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = slowServer({ failFirstCreate: true });
    const { result } = await mountHook(server.ds);

    let first: Promise<DailyNode | null> | undefined;
    let second: Promise<DailyNode | null> | undefined;
    await act(async () => {
      first = result.current.upsertDaily(DATE, "a");
    });
    await act(async () => {
      second = result.current.upsertDaily(DATE, "ab");
    });

    await server.releaseCreate();
    await expect(first).resolves.toBeNull();
    // The queued save found no row and created it itself.
    await server.releaseCreate();
    await expect(second).resolves.toMatchObject({ content: "ab" });

    expect(server.log).toEqual(["create:a", "create:ab"]);
    expect(server.rows.get(DATE)?.content).toBe("ab");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[Daily] sync: createDailyUnified meta failed"),
    );
  });
});
