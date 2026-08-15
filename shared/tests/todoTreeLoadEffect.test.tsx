import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTodoTreeAPI } from "../src/hooks/useTodoTreeAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import { makeTodo } from "./helpers/nodeFixtures";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #891 — the load effect of useTodoTreeAPI, moved onto the shared
 * `useDomainLoad` (#672). The hand-written effect it replaces had no test:
 * nothing pinned that a failed read still settles, and nothing pinned #296's
 * error un-latch — which this hook did not have at all, so one transient
 * failure kept the error up for the rest of the session.
 *
 * The third case is the one that constrains the extraction. This hook's old
 * effect only ever wrote `isLoading` to false, never back to true, so a
 * re-read left the board on screen. `useDomainLoad` reports a re-read as
 * loading by default, and KanbanView swaps itself for a skeleton while that is
 * true — with Realtime echoing the tab's own writes back, the board would have
 * blinked on every edit. Hence `refetchReportsLoading: false`.
 */

const { sync, wrapper } = createBumpableSync();

interface Round {
  active: TodoNode[] | Error;
  deleted?: TodoNode[];
}

/**
 * DataService stub whose todo reads are scripted round by round. After
 * `deferNextRound()` both reads hang until `release()`, which is how the tests
 * observe the in-flight window.
 */
function makeDS(rounds: Round[]) {
  let defer = false;
  const pending: Array<() => void> = [];
  let round: Round = { active: [] };

  function scripted<T>(pick: (r: Round) => T | Error) {
    return () => {
      const value = pick(round);
      const settle = () =>
        value instanceof Error
          ? Promise.reject(value)
          : Promise.resolve(value as T);
      if (!defer) return settle();
      return new Promise<T>((resolve, reject) => {
        pending.push(() => settle().then(resolve, reject));
      });
    };
  }

  // Both reads run inside one Promise.all, so the round has to advance once
  // per load rather than once per call: fetchTodoTree pulls the next round,
  // fetchDeletedTodos reads whatever that round left in place.
  const fetchTodoTree = vi.fn(() => {
    round = rounds.shift() ?? { active: [] };
    return scripted<TodoNode[]>((r) => r.active)();
  });
  const fetchDeletedTodos = vi.fn(scripted<TodoNode[]>((r) => r.deleted ?? []));

  const ds = stubDataService({ fetchTodoTree, fetchDeletedTodos });
  return {
    ds,
    fetchTodoTree,
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

describe("useTodoTreeAPI load effect (#891)", () => {
  it("reports loading until the first read lands, then holds the rows", async () => {
    const { ds } = makeDS([
      {
        active: [makeTodo({ id: "task-1" })],
        deleted: [makeTodo({ id: "task-2", isDeleted: true })],
      },
    ]);
    const hook = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
      wrapper,
    });

    expect(hook.result.current.isLoading).toBe(true);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(hook.result.current.nodes.map((n) => n.id)).toEqual(["task-1"]);
    expect(hook.result.current.deletedNodes.map((n) => n.id)).toEqual([
      "task-2",
    ]);
    expect(hook.result.current.error).toBeNull();
  });

  it("refetches when the todos domain moves", async () => {
    const { ds, fetchTodoTree } = makeDS([
      { active: [makeTodo({ id: "task-1" })] },
      { active: [makeTodo({ id: "task-1" }), makeTodo({ id: "task-2" })] },
    ]);
    const hook = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(1));

    act(() => sync.bump("todos"));
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.nodes).toHaveLength(2));
  });

  it("keeps the board on screen while a bump-driven refetch is in flight", async () => {
    const { ds, fetchTodoTree, deferNextRound, release } = makeDS([
      { active: [makeTodo({ id: "task-1" })] },
      { active: [makeTodo({ id: "task-2" })] },
    ]);
    const hook = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    // Realtime echoes the tab's own writes back (syncDomains.ts), so this is
    // what every local edit looks like. KanbanView renders a skeleton INSTEAD
    // of the board while isLoading is true — flipping it here would blink the
    // board on each save.
    deferNextRound();
    act(() => sync.bump("todos"));
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(2));
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.nodes.map((n) => n.id)).toEqual(["task-1"]);

    await act(async () => release());
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.nodes.map((n) => n.id)).toEqual(["task-2"]);
  });

  it("ignores a bump on a domain it does not read", async () => {
    const { ds, fetchTodoTree } = makeDS([
      { active: [makeTodo({ id: "task-1" })] },
    ]);
    renderHook(() => useTodoTreeAPI({ dataService: ds }), { wrapper });
    await waitFor(() => expect(fetchTodoTree).toHaveBeenCalledTimes(1));

    // A note edit or a calendar edit must not re-pull the todo tree (#499).
    act(() => {
      sync.bump("notes");
      sync.bump("calendars");
    });
    await act(async () => {});
    expect(fetchTodoTree).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed read as an error and stops claiming 'no data yet'", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([{ active: new Error("offline") }]);
    const hook = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
      wrapper,
    });

    await waitFor(() => expect(hook.result.current.error).toBe("offline"));
    // A failed load must settle too — otherwise the board sits on its
    // skeleton forever with no error ever shown.
    expect(hook.result.current.isLoading).toBe(false);
  });

  it("un-latches the error once a later read succeeds (#296)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([
      { active: new Error("offline") },
      { active: [makeTodo({ id: "task-1" })] },
    ]);
    const hook = renderHook(() => useTodoTreeAPI({ dataService: ds }), {
      wrapper,
    });
    await waitFor(() => expect(hook.result.current.error).toBe("offline"));

    act(() => sync.bump("todos"));
    // Before this change nothing in the hook ever wrote `error` back to null,
    // so the error card stayed up for the rest of the session.
    await waitFor(() => expect(hook.result.current.error).toBeNull());
    expect(hook.result.current.nodes.map((n) => n.id)).toEqual(["task-1"]);
  });
});
