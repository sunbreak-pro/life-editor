import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import type { DataService } from "@life-editor/shared";

/*
 * #1334 — the pool has to GO AND GET the soft-deleted rows.
 *
 * #1292 taught `useItemLinkTargets` to carry a deleted row flagged instead of
 * dropping it, so a link whose target is in the Trash keeps its title rather
 * than printing a shortened id. The flag was set from `row.isDeleted` — but the
 * three reads it set it from (`listNotesUnified` / `listDailiesUnified` /
 * `fetchTodoTree`) each filter `is_deleted = false` in the query, so the flag
 * was structurally always false and the fallback still fired for every real
 * deletion.
 *
 * `linkPanel.test.tsx` could not catch that: it hands the panel a pool with a
 * deleted row already in it, which is exactly the step that was broken. So the
 * fake service here models the SPLIT instead of the result — one row table per
 * domain, and each read serves only its own `is_deleted` bucket, the way the
 * Supabase services do. A pool built from the live reads alone cannot pass.
 */

const state = vi.hoisted(() => ({
  outgoing: [] as unknown[],
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    // No SyncProvider in this render tree; the pool's staleness is not what is
    // under test (useLazyStalePool has its own suite).
    useSyncDomains: () => 0,
    useWikiTagsUnifiedContext: () => ({
      loading: false,
      allAssignments: [],
      getTagsForItem: () => [],
      getLinksForItem: () => ({ outgoing: state.outgoing, incoming: [] }),
      createItemLink: vi.fn(() => Promise.resolve()),
      deleteItemLink: vi.fn(() => Promise.resolve()),
    }),
  };
});

const { i18n } = await import("@life-editor/shared");
const { useItemLinkTargets } = await import("../src/notes/useItemLinkTargets");
const { LinkPanel } = await import("../src/wikitag/LinkPanel");

/** One row table per domain; `isDeleted` is what the two reads split on. */
const NOTES = [
  { id: "note-2", title: "Kitchen rebuild", isDeleted: false },
  { id: "note-3", title: "Last winter's plan", isDeleted: true },
];
const DAILIES = [
  { id: "daily-2026-08-12", date: "2026-08-12", isDeleted: false },
  { id: "daily-2026-07-01", date: "2026-07-01", isDeleted: true },
];
const TODOS = [
  { id: "task-9", title: "Order the tiles", isDeleted: false },
  { id: "task-1786544440797", title: "Return the extra tiles", isDeleted: true },
];

const bucket = <T extends { isDeleted: boolean }>(rows: T[], deleted: boolean) =>
  rows.filter((r) => r.isDeleted === deleted);

const reads = {
  listNotesUnified: vi.fn(async () => bucket(NOTES, false)),
  fetchDeletedNotesUnified: vi.fn(async () => bucket(NOTES, true)),
  listDailiesUnified: vi.fn(async () => bucket(DAILIES, false)),
  fetchDeletedDailiesUnified: vi.fn(async () => bucket(DAILIES, true)),
  fetchTodoTree: vi.fn(async () => bucket(TODOS, false)),
  fetchDeletedTodos: vi.fn(async () => bucket(TODOS, true)),
};
const dataService = reads as unknown as DataService;

beforeEach(() => {
  state.outgoing = [];
  for (const read of Object.values(reads)) read.mockClear();
});

function loadPool() {
  const { result } = renderHook(() => useItemLinkTargets(dataService));
  return result.current({ allowStale: false });
}

describe("useItemLinkTargets — soft-deleted targets (#1334)", () => {
  it("reads both is_deleted buckets of every domain", async () => {
    await loadPool();

    for (const read of Object.values(reads)) {
      expect(read).toHaveBeenCalledTimes(1);
    }
  });

  it("carries each domain's trashed rows flagged, not dropped", async () => {
    const pool = await loadPool();

    expect(pool).toContainEqual({
      id: "task-1786544440797",
      label: "Return the extra tiles",
      role: "task",
      isDeleted: true,
    });
    expect(pool).toContainEqual({
      id: "note-3",
      label: "Last winter's plan",
      role: "note",
      isDeleted: true,
    });
    expect(pool).toContainEqual({
      id: "daily-2026-07-01",
      label: "2026-07-01",
      role: "daily",
      isDeleted: true,
    });
  });

  it("leaves live rows unflagged and ahead of the trashed ones", async () => {
    const pool = await loadPool();
    const at = (id: string) => pool.findIndex((t) => t.id === id);

    expect(pool[at("task-9")].isDeleted).toBe(false);
    // Ordering matters only for the surfaces that OFFER a target: they rank
    // what is left after dropping the flagged tail, so live rows come first.
    expect(at("task-9")).toBeLessThan(at("task-1786544440797"));
    expect(at("note-2")).toBeLessThan(at("note-3"));
  });
});

/*
 * The reported symptom, end to end: the same hook feeding the same panel that
 * printed `…44440797` for a link to a trashed todo. Nothing hands the pool over
 * by hand here — if the reads go back to the live lists only, this row goes
 * back to the id fragment.
 */
describe("LinkPanel over the real pool (#1334)", () => {
  function Host() {
    const loadTargets = useItemLinkTargets(dataService);
    return <LinkPanel itemId="note-1" loadTargets={loadTargets} />;
  }

  it("names a link to a trashed todo instead of falling back to its id", async () => {
    state.outgoing = [
      {
        id: "l1",
        fromItemId: "note-1",
        toItemId: "task-1786544440797",
        origin: "manual",
        isDeleted: false,
      },
    ];

    render(<Host />);

    const label = i18n.t("materials.links.deletedTarget", {
      title: "Return the extra tiles",
    });
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.queryByText("…44440797")).toBeNull();
  });
});
