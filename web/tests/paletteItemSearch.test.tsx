import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/*
 * usePaletteItemSearch (#503) — the host half of the palette's cross-item
 * search. Two things are worth pinning here and nowhere else:
 *
 *   - LAZINESS. #430 made the "[[" pool stop fetching on every sync bump; this
 *     hook must not undo that for the palette, which is opened far more often
 *     than it is searched. Opening it, and typing nothing, must cost zero
 *     queries.
 *   - THE EVENT'S DATE travels with the open-intent. The Calendar fetches only
 *     its visible window and its navigation never reaches outside it, so an id
 *     alone would select a row on whatever week happened to be open.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useSyncDomains: () => 0,
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { usePaletteItemSearch } =
  await import("../src/hooks/usePaletteItemSearch");

const listNotesUnified = vi.fn();
const listDailiesUnified = vi.fn();
const fetchTaskTree = vi.fn();
const fetchEvents = vi.fn();

function makeDS() {
  listNotesUnified.mockResolvedValue([
    { id: "n1", title: "テスト２", isDeleted: false },
    { id: "n-gone", title: "テスト削除済み", isDeleted: true },
  ]);
  listDailiesUnified.mockResolvedValue([
    { id: "daily-2026-07-30", date: "2026-07-30", isDeleted: false },
  ]);
  fetchTaskTree.mockResolvedValue([
    { id: "t1", title: "これはテストです", isDeleted: false },
  ]);
  fetchEvents.mockResolvedValue([
    { id: "e1", title: "朝会", date: "2026-07-31", isDeleted: false },
  ]);
  return {
    listNotesUnified,
    listDailiesUnified,
    fetchTaskTree,
    fetchEvents,
  } as unknown as Parameters<typeof usePaletteItemSearch>[0]["dataService"];
}

function setup(onOpenItem = vi.fn()) {
  const ds = makeDS();
  const view = renderHook(
    ({ isOpen }: { isOpen: boolean }) =>
      usePaletteItemSearch({ dataService: ds, isOpen, onOpenItem }),
    { initialProps: { isOpen: true } },
  );
  return { view, onOpenItem };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePaletteItemSearch", () => {
  it("fetches nothing until a non-empty query is typed", async () => {
    const { view } = setup();
    expect(listNotesUnified).not.toHaveBeenCalled();

    // The palette reports its reset-on-open as an empty query — still no read.
    act(() => view.result.current.handleQueryChange(""));
    expect(fetchEvents).not.toHaveBeenCalled();

    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(fetchEvents).toHaveBeenCalledTimes(1));
  });

  it("returns palette rows for the matching items", async () => {
    const { view } = setup();
    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(view.result.current.results).toHaveLength(2));
    const titles = view.result.current.results.map((r) => r.title);
    expect(titles).toEqual(["テスト２", "これはテストです"]);
    // The soft-deleted note never enters the pool.
    expect(titles).not.toContain("テスト削除済み");
  });

  it("opens an event WITH its date, which the Calendar needs to jump", async () => {
    const onOpenItem = vi.fn();
    const { view } = setup(onOpenItem);
    act(() => view.result.current.handleQueryChange("朝会"));
    await waitFor(() => expect(view.result.current.results).toHaveLength(1));

    const row = view.result.current.results[0];
    // The date is on the row too, so the user can tell two same-named events apart.
    expect(row.title).toContain("2026-07-31");
    act(() => row.action());
    expect(onOpenItem).toHaveBeenCalledWith({
      id: "e1",
      role: "event",
      date: "2026-07-31",
    });
  });

  it("serves the cache for later queries in the same opening", async () => {
    const { view } = setup();
    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(fetchEvents).toHaveBeenCalledTimes(1));
    act(() => view.result.current.handleQueryChange("朝会"));
    await waitFor(() => expect(view.result.current.results).toHaveLength(1));
    expect(fetchEvents).toHaveBeenCalledTimes(1);
  });

  it("clears the results when the query is emptied", async () => {
    const { view } = setup();
    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(view.result.current.results).toHaveLength(2));
    // The palette reports its reset-on-open this way, so this is also what
    // stops the previous session's hits from surviving into the next one.
    act(() => view.result.current.handleQueryChange(""));
    expect(view.result.current.results).toHaveLength(0);
  });

  it("does not re-read on a close/open when nothing has changed", async () => {
    // Closing ends the session, so the next opening is ALLOWED to read fresh —
    // but "allowed" is not "must". With no sync bump since, the cache is still
    // current, and re-reading it would be four queries for the same answer.
    const { view } = setup();
    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(fetchEvents).toHaveBeenCalledTimes(1));

    view.rerender({ isOpen: false });
    view.rerender({ isOpen: true });

    act(() => view.result.current.handleQueryChange("テスト"));
    await waitFor(() => expect(view.result.current.results).toHaveLength(2));
    expect(fetchEvents).toHaveBeenCalledTimes(1);
  });
});
