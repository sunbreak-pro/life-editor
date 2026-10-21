import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import {
  resetMaterialsSelection,
  setDailySelection,
} from "../src/state/materialsSelectionStore";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { DailyNode } from "../src/types/daily";

/*
 * #2325 — the Daily hook fetches only the OPEN day's body.
 *
 * The list read is light (`bodyLoaded: false`, `content: ""`). The hook then
 * reads the selected day's whole row with getDailyByDateUnified, and only
 * that day's — the other days stay light until opened. Two races are pinned:
 *
 *   - a local write for the open day that lands while its body read is out
 *     wins: the late body must not put the older text back over it;
 *   - a Realtime echo that moved the open day's row keeps the text on screen
 *     (blanking it would unmount the editor) and re-reads the body.
 */

const { sync, wrapper } = createBumpableSync();

const OPEN = "2026-10-20";
const OTHER = "2026-10-19";
const T0 = "2026-10-20T00:00:00.000Z";
const T1 = "2026-10-20T01:00:00.000Z";

const doc = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

function light(date: string, updatedAt = T0, head = true): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    bodyLoaded: false,
    ...(head ? { headContent: doc(`head of ${date}`) } : {}),
    createdAt: T0,
    updatedAt,
  };
}

function full(date: string, content: string, updatedAt = T0): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content,
    createdAt: T0,
    updatedAt,
  };
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** The list rounds are served in order; the last one repeats. */
function makeDS(rounds: DailyNode[][]) {
  const listDailySummariesUnified = vi.fn(async () => {
    const round = rounds.length > 1 ? rounds.shift()! : rounds[0];
    return round.map((r) => ({ ...r }));
  });
  const fetchDailyBodiesUnified = vi.fn(
    async (ids: readonly string[]): Promise<Record<string, string>> =>
      Object.fromEntries(ids.map((id) => [id, `plain body of ${id}`])),
  );
  const getDailyByDateUnified = vi.fn(
    async (date: string): Promise<DailyNode | null> =>
      full(date, doc(`body of ${date}`)),
  );
  const upsertDailyByDateUnified = vi.fn(
    async (date: string, content: string): Promise<DailyNode> =>
      full(date, content, T1),
  );
  const ds = stubDataService({
    listDailySummariesUnified,
    fetchDailyBodiesUnified,
    getDailyByDateUnified,
    upsertDailyByDateUnified,
  });
  return {
    ds,
    listDailySummariesUnified,
    fetchDailyBodiesUnified,
    getDailyByDateUnified,
    upsertDailyByDateUnified,
  };
}

function mount(ds: ReturnType<typeof makeDS>["ds"]) {
  return renderHook(() => useDailiesUnifiedAPI({ dataService: ds }), {
    wrapper,
  });
}

const rowFor = (
  hook: ReturnType<typeof mount>,
  date: string,
): DailyNode | undefined =>
  hook.result.current.dailies.find((d) => d.date === date);

beforeEach(() => {
  // The hook opens the stored selection; pin it off "today".
  setDailySelection(OPEN);
});

afterEach(() => {
  resetMaterialsSelection();
  vi.restoreAllMocks();
});

describe("useDailiesUnifiedAPI — the open day's body (#2325)", () => {
  it("reads the body of the selected day only, and marks it loaded", async () => {
    const server = makeDS([[light(OPEN), light(OTHER)]]);
    const hook = mount(server.ds);

    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));
    expect(rowFor(hook, OPEN)?.content).toBe(doc(`body of ${OPEN}`));
    expect(server.getDailyByDateUnified.mock.calls).toEqual([[OPEN]]);
    // The other day stays light: nothing opened it.
    expect(rowFor(hook, OTHER)).toMatchObject({
      bodyLoaded: false,
      content: "",
    });
    // Every row had a head: no body is fetched for the excerpts.
    expect(server.fetchDailyBodiesUnified).not.toHaveBeenCalled();
  });

  it("fetches the whole body for a row whose head could not be read", async () => {
    const server = makeDS([[light(OPEN), light(OTHER, T0, false)]]);
    const hook = mount(server.ds);

    await waitFor(() => expect(rowFor(hook, OTHER)?.bodyLoaded).toBe(true));
    expect(server.fetchDailyBodiesUnified.mock.calls).toEqual([
      [[`daily-${OTHER}`]],
    ]);
    expect(rowFor(hook, OTHER)?.content).toBe(`plain body of daily-${OTHER}`);
  });

  it("drops a body read that a local write for the same day overtook", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const server = makeDS([[light(OPEN)]]);
    const late = deferred<DailyNode | null>();
    server.getDailyByDateUnified.mockImplementation(() => late.promise);
    const hook = mount(server.ds);
    await waitFor(() =>
      expect(server.getDailyByDateUnified).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      void hook.result.current.upsertDaily(OPEN, doc("typed"));
    });
    expect(rowFor(hook, OPEN)).toMatchObject({
      content: doc("typed"),
      bodyLoaded: true,
    });

    // The read that left before the write comes back with the older text.
    await act(async () => {
      late.resolve(full(OPEN, doc("older server text")));
    });
    expect(rowFor(hook, OPEN)?.content).toBe(doc("typed"));
    // And it is not read again: the written text is the whole body.
    expect(server.getDailyByDateUnified).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the open day's text on a moved echo and re-reads its body", async () => {
    const server = makeDS([[light(OPEN, T0)], [light(OPEN, T1)]]);
    const hook = mount(server.ds);
    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));
    expect(rowFor(hook, OPEN)?.content).toBe(doc(`body of ${OPEN}`));

    const reread = deferred<DailyNode | null>();
    server.getDailyByDateUnified.mockImplementation(() => reread.promise);
    act(() => sync.bump("dailies"));
    await waitFor(() =>
      expect(server.listDailySummariesUnified).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(server.getDailyByDateUnified).toHaveBeenCalledTimes(2),
    );

    // While the re-read is out, the text stays: no light row, no blank.
    expect(rowFor(hook, OPEN)).toMatchObject({
      content: doc(`body of ${OPEN}`),
      bodyLoaded: true,
      updatedAt: T1,
    });

    await act(async () => {
      reread.resolve(full(OPEN, doc("edited elsewhere"), T1));
    });
    expect(rowFor(hook, OPEN)).toMatchObject({
      content: doc("edited elsewhere"),
      bodyLoaded: true,
    });
  });

  it("does not re-read the body when the echo did not move the row", async () => {
    const server = makeDS([[light(OPEN, T0)], [light(OPEN, T0)]]);
    const hook = mount(server.ds);
    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));

    act(() => sync.bump("dailies"));
    await waitFor(() =>
      expect(server.listDailySummariesUnified).toHaveBeenCalledTimes(2),
    );
    await act(async () => {});
    expect(server.getDailyByDateUnified).toHaveBeenCalledTimes(1);
    expect(rowFor(hook, OPEN)?.content).toBe(doc(`body of ${OPEN}`));
  });

  it("reads the newly selected day's body when the selection moves", async () => {
    const server = makeDS([[light(OPEN), light(OTHER)]]);
    const hook = mount(server.ds);
    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));

    act(() => hook.result.current.setSelectedDate(OTHER));
    await waitFor(() => expect(rowFor(hook, OTHER)?.bodyLoaded).toBe(true));
    expect(server.getDailyByDateUnified.mock.calls).toEqual([[OPEN], [OTHER]]);
  });

  it("opens a day gone from the server as empty instead of waiting forever", async () => {
    const { ds, getDailyByDateUnified } = makeDS([[light(OPEN)]]);
    getDailyByDateUnified.mockResolvedValueOnce(null);
    const hook = mount(ds);

    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));
    expect(rowFor(hook, OPEN)?.content).toBe("");
  });

  it("tries a failed body read again after a pause", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ds, getDailyByDateUnified } = makeDS([[light(OPEN)]]);
    getDailyByDateUnified.mockRejectedValueOnce(new Error("offline"));
    const hook = mount(ds);

    await waitFor(() => expect(getDailyByDateUnified).toHaveBeenCalledTimes(1));
    expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(false);
    // The retry waits BODY_RETRY_MS (3s) of real time.
    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true), {
      timeout: 5000,
    });
    expect(getDailyByDateUnified).toHaveBeenCalledTimes(2);
    expect(rowFor(hook, OPEN)?.content).toBe(doc(`body of ${OPEN}`));
  }, 10000);

  it("does not re-read the open day's body for the echo of its own save", async () => {
    // upsertDailyByDateUnified answers with T1; the echo's list read says T1.
    const server = makeDS([[light(OPEN, T0)], [light(OPEN, T1)]]);
    const hook = mount(server.ds);
    await waitFor(() => expect(rowFor(hook, OPEN)?.bodyLoaded).toBe(true));

    await act(async () => {
      await hook.result.current.upsertDaily(OPEN, doc("typed"));
    });
    expect(rowFor(hook, OPEN)?.updatedAt).toBe(T1);

    act(() => sync.bump("dailies"));
    await waitFor(() =>
      expect(server.listDailySummariesUnified).toHaveBeenCalledTimes(2),
    );
    await act(async () => {});
    expect(server.getDailyByDateUnified).toHaveBeenCalledTimes(1);
    expect(rowFor(hook, OPEN)?.content).toBe(doc("typed"));
  });

  it("fetches a headless row's whole body once per version (QA I-3)", async () => {
    const server = makeDS([[light(OTHER, T0, false), light(OPEN, T0)]]);
    const hook = mount(server.ds);
    await waitFor(() =>
      expect(server.fetchDailyBodiesUnified).toHaveBeenCalledTimes(1),
    );

    act(() => sync.bump("dailies"));
    await waitFor(() =>
      expect(server.listDailySummariesUnified).toHaveBeenCalledTimes(2),
    );
    await act(async () => {});
    expect(server.fetchDailyBodiesUnified).toHaveBeenCalledTimes(1);
    // The body fetched the first time is still what the list holds.
    expect(rowFor(hook, OTHER)).toMatchObject({
      content: `plain body of daily-${OTHER}`,
      bodyLoaded: true,
    });
  });
});
