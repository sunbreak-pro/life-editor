import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { WikiTag } from "../src/types/wikiTagUnified";

/*
 * #891 — the load effect of useWikiTagsUnifiedAPI, moved onto the shared
 * `useDomainLoad` (#672). The #300 no-flicker rule has its own suite
 * (wikiTagsRefreshLoading.test.tsx), left untouched; this one covers what the
 * hand-written version had nothing for.
 *
 * The effect it replaces had NO catch. A failed bulk load became an unhandled
 * rejection (`void refresh()`), the three caches stayed empty, and every tag
 * surface showed an empty graph with nothing to say why.
 *
 * `loading` is written here as `in flight AND nothing has ever landed` rather
 * than `refetchReportsLoading: false`, because the two differ after a FAILED
 * first load — the old code re-armed its flag on the next attempt, and there
 * genuinely is no data yet in that state. The "re-arms" case below is what
 * pins that difference.
 */

const { sync, wrapper } = createBumpableSync();

function makeTag(id: string): WikiTag {
  return {
    id,
    name: id,
    color: null,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

interface Round {
  tags: WikiTag[] | Error;
}

/**
 * DataService stub whose tag master read is scripted round by round; the two
 * relation reads always resolve empty. The three run inside one Promise.all,
 * so hanging the first one is enough to hold the whole load in flight —
 * `deferNextRound()` does that until `release()`.
 */
function makeDS(rounds: Round[]) {
  let defer = false;
  const pending: Array<() => void> = [];

  const listAllWikiTagsUnified = vi.fn(() => {
    const round = rounds.shift() ?? { tags: [] };
    const settle = () =>
      round.tags instanceof Error
        ? Promise.reject(round.tags)
        : Promise.resolve(round.tags);
    if (!defer) return settle();
    return new Promise<WikiTag[]>((resolve, reject) => {
      pending.push(() => settle().then(resolve, reject));
    });
  });
  const listAllTagAssignments = vi.fn(() => Promise.resolve([]));
  const listAllTagConnections = vi.fn(() => Promise.resolve([]));

  const ds = stubDataService({
    listAllWikiTagsUnified,
    listAllTagAssignments,
    listAllTagConnections,
  });
  return {
    ds,
    listAllWikiTagsUnified,
    deferNextRound: () => {
      defer = true;
    },
    release: () => {
      defer = false;
      pending.splice(0).forEach((settle) => settle());
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useWikiTagsUnifiedAPI load effect (#891)", () => {
  it("holds the three bulk caches once the first load lands", async () => {
    const { ds } = makeDS([{ tags: [makeTag("tag-1")] }]);
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.allTags.map((t) => t.id)).toEqual(["tag-1"]);
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the tags domain moves", async () => {
    const { ds, listAllWikiTagsUnified } = makeDS([
      { tags: [makeTag("tag-1")] },
      { tags: [makeTag("tag-1"), makeTag("tag-2")] },
    ]);
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() =>
      expect(listAllWikiTagsUnified).toHaveBeenCalledTimes(1),
    );

    act(() => sync.bump("tags"));
    await waitFor(() =>
      expect(listAllWikiTagsUnified).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(hook.result.current.allTags).toHaveLength(2));
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, listAllWikiTagsUnified } = makeDS([{ tags: [makeTag("t")] }]);
    renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), { wrapper });
    await waitFor(() =>
      expect(listAllWikiTagsUnified).toHaveBeenCalledTimes(1),
    );

    // A todo edit or a note edit must not re-pull the tag graph (#499).
    act(() => {
      sync.bump("todos");
      sync.bump("notes");
    });
    await act(async () => {});
    expect(listAllWikiTagsUnified).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed load and stops claiming 'no data yet'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([{ tags: new Error("offline") }]);
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // Matches the `finally` of the effect this replaces: a settled attempt
    // drops the flag whether or not it succeeded.
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.allTags).toEqual([]);
  });

  it("re-arms loading on the next attempt after a failed first load", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds, deferNextRound, release, listAllWikiTagsUnified } = makeDS([
      { tags: new Error("offline") },
      { tags: [makeTag("tag-1")] },
    ]);
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    expect(hook.result.current.loading).toBe(false);

    // Nothing has ever landed, so the retry is still "no data yet" — this is
    // the `if (!hasLoadedRef.current) setLoading(true)` of the old code, and
    // the reason `loading` is not simply `refetchReportsLoading: false`.
    deferNextRound();
    act(() => sync.bump("tags"));
    await waitFor(() =>
      expect(listAllWikiTagsUnified).toHaveBeenCalledTimes(2),
    );
    expect(hook.result.current.loading).toBe(true);

    await act(async () => release());
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.allTags.map((t) => t.id)).toEqual(["tag-1"]);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([
      { tags: new Error("offline") },
      { tags: [makeTag("tag-1")] },
    ]);
    const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("tags"));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.allTags.map((t) => t.id)).toEqual(["tag-1"]);
  });
});
