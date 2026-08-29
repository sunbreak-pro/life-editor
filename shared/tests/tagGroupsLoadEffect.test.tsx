import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTagGroupsAPI } from "../src/hooks/useTagGroupsAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { TagGroupNode } from "../src/types/tagGroup";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1173 — the saved multi-tag filters that replaced the `calendars` domain.
 *
 * Carries over the load-effect cases the retired `calendarsLoadEffect` suite
 * pinned (#672: the three states plus #296's error un-latch), because the two
 * hooks share `useDomainLoad` and those are the states it owns. What is new
 * here is the write side: a group spans two tables, so the server's answer —
 * not the optimistic guess — is what the cache must end up holding.
 */

const { sync, wrapper } = createBumpableSync();

function tagGroup(id: string, tagIds: string[] = [`tag-${id}`]): TagGroupNode {
  return {
    id,
    name: id,
    tagIds,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  };
}

/**
 * DataService stub whose `fetchTagGroups` is scripted round by round. After
 * `deferNextRound()` the read hangs until `release()`, which is how the tests
 * observe the in-flight window.
 */
function makeDS(
  rounds: Array<TagGroupNode[] | Error>,
  writes: Partial<Parameters<typeof stubDataService>[0]> = {},
) {
  let defer = false;
  const pending: Array<() => void> = [];
  const fetchTagGroups = vi.fn(() => {
    const next = rounds.shift() ?? [];
    const settle = () =>
      next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    if (!defer) return settle();
    return new Promise<TagGroupNode[]>((resolve, reject) => {
      pending.push(() => settle().then(resolve, reject));
    });
  });
  const ds = stubDataService({ fetchTagGroups, ...writes });
  return {
    ds,
    fetchTagGroups,
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

describe("useTagGroupsAPI load effect", () => {
  it("reports loading until the first read lands, then holds the rows", async () => {
    const { ds } = makeDS([[tagGroup("group-1")]]);
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.tagGroups.map((g) => g.id)).toEqual(["group-1"]);
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the tagGroups domain moves", async () => {
    const { ds, fetchTagGroups } = makeDS([
      [tagGroup("group-1")],
      [tagGroup("group-1"), tagGroup("group-2")],
    ]);
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(fetchTagGroups).toHaveBeenCalledTimes(1));

    act(() => sync.bump("tagGroups"));
    await waitFor(() => expect(fetchTagGroups).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.tagGroups).toHaveLength(2));
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, fetchTagGroups } = makeDS([[tagGroup("group-1")]]);
    renderHook(() => useTagGroupsAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTagGroups).toHaveBeenCalledTimes(1));

    // A note edit or a todo edit must not re-pull the group list (#499) — and
    // neither must a TAG edit, which is the split this domain exists for
    // (#993's rule in reverse: the `tags` counter moves on every tag edit and
    // every assignment, and the traffic in the other direction is worse still
    // — saving a group would re-pull the whole tag graph).
    act(() => {
      sync.bump("notes");
      sync.bump("todos");
      sync.bump("tags");
    });
    await act(async () => {});
    expect(fetchTagGroups).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed read as an error and stops claiming 'no data yet'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline")]);
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // A failed load must settle too — otherwise the view sits on its loading
    // line forever with no error ever shown.
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([new Error("offline"), [tagGroup("group-1")]]);
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("tagGroups"));
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.tagGroups.map((g) => g.id)).toEqual(["group-1"]);
  });
});

describe("useTagGroupsAPI writes", () => {
  it("shows the group at once, then adopts the SERVER's row", async () => {
    // The optimistic node exists to keep the panel from flashing empty. It
    // cannot be the final truth: the service mints the membership rows, so
    // only its answer knows what actually landed.
    const saved = tagGroup("tgroup-x", ["tag-work"]);
    const createTagGroup = vi.fn(() => Promise.resolve(saved));
    const { ds } = makeDS([[]], { createTagGroup });
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    let id = "";
    act(() => {
      id = hook.result.current.createTagGroup("Work", ["tag-work"]);
    });
    expect(hook.result.current.tagGroups).toHaveLength(1);
    expect(hook.result.current.tagGroups[0].name).toBe("Work");
    expect(createTagGroup).toHaveBeenCalledWith(id, "Work", ["tag-work"]);

    await waitFor(() =>
      expect(hook.result.current.tagGroups[0].id).toBe("tgroup-x"),
    );
  });

  it("takes the group back off when the write fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const createTagGroup = vi.fn(() => Promise.reject(new Error("offline")));
    const { ds } = makeDS([[]], { createTagGroup });
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => void hook.result.current.createTagGroup("Work", ["tag-work"]));
    await waitFor(() => expect(hook.result.current.tagGroups).toHaveLength(0));
  });

  it("restores the previous tag set when a re-bind fails", async () => {
    // The rollback the calendars hook never had: leaving the optimistic set in
    // place would show a filter the server does not have, and the next refresh
    // would swap the grid under the user with no action of theirs in between.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const updateTagGroup = vi.fn(() => Promise.reject(new Error("offline")));
    const { ds } = makeDS([[tagGroup("group-1", ["tag-a"])]], {
      updateTagGroup,
    });
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() =>
      hook.result.current.updateTagGroup("group-1", { tagIds: ["tag-b"] }),
    );
    expect(hook.result.current.tagGroups[0].tagIds).toEqual(["tag-b"]);
    await waitFor(() =>
      expect(hook.result.current.tagGroups[0].tagIds).toEqual(["tag-a"]),
    );
  });

  it("puts a deleted group back when the delete fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const deleteTagGroup = vi.fn(() => Promise.reject(new Error("offline")));
    const { ds } = makeDS([[tagGroup("group-1")]], { deleteTagGroup });
    const hook = renderHook(() => useTagGroupsAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.deleteTagGroup("group-1"));
    expect(hook.result.current.tagGroups).toHaveLength(0);
    await waitFor(() => expect(hook.result.current.tagGroups).toHaveLength(1));
  });
});
