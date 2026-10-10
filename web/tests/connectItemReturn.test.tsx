import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { GoalsTodosScreen } from "../src/connect/GoalsTodosScreen";
import { useShellNavigation } from "../src/hooks/useShellNavigation";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";
import { stubDataService } from "./helpers";

/*
 * #2143 — a todo opened from Connect lands in Schedule's todo detail, and
 * closing that detail used to leave the user on the Schedule calendar
 * underneath. The shell now remembers where a Connect jump came from and goes
 * back there when the detail for THAT todo closes.
 *
 * Pinned at the hook and at the descriptor rows rather than through
 * MainScreen, which needs a session and the whole Provider chain
 * (rules/frontend.md §テスト環境の制約). The detail's own half — that closing
 * it reports which todo it was showing — is scheduleTodoDetailReturn.test.tsx.
 */

beforeEach(() => {
  localStorage.clear();
});

function onConnectTab(tab: "tags" | "goals") {
  const hook = renderHook(() => useShellNavigation());
  act(() => hook.result.current.setSection("connect"));
  act(() => hook.result.current.setConnectTab(tab));
  return hook;
}

describe("going back to Connect after a todo detail closes (#2143)", () => {
  it("returns to the Goals & Todos tab the todo was opened from", () => {
    const { result } = onConnectTab("goals");

    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    // The jump itself is unchanged: Schedule, with the todo's detail asked for.
    expect(result.current.section).toBe("schedule");
    expect(result.current.pendingTodoSelect).toBe("t1");

    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("connect");
    expect(result.current.connectTab).toBe("goals");
  });

  it("returns to the Tags tab for a todo opened from the tag hub", () => {
    const { result } = onConnectTab("tags");
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("connect");
    expect(result.current.connectTab).toBe("tags");
  });

  it("goes back only once", () => {
    const { result } = onConnectTab("goals");
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    act(() => result.current.returnFromItem("t1"));
    // Opening the same todo again from Schedule's own list and closing it is
    // an ordinary close: the return point was spent the first time.
    act(() => result.current.setSection("schedule"));
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("schedule");
  });

  it("leaves a todo opened inside Schedule closing onto Schedule", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.setSection("schedule"));
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("schedule");
  });

  it("does not go back when a different todo's detail closes", () => {
    const { result } = onConnectTab("goals");
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    act(() => result.current.returnFromItem("t2"));
    expect(result.current.section).toBe("schedule");
  });

  it("forgets the return point once the user moves on by any other route", () => {
    const { result } = onConnectTab("goals");
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    // A "[[" link inside the todo body: an ordinary one-way jump.
    act(() => result.current.navigateToItem({ id: "n1", role: "note" }));
    act(() => result.current.setSection("schedule"));
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("schedule");

    // The nav rail, too.
    act(() => result.current.setSection("connect"));
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    act(() => result.current.setSection("briefing"));
    act(() => result.current.setSection("schedule"));
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("schedule");
  });

  it("keeps the old one-way jump for every other caller", () => {
    const { result } = onConnectTab("goals");
    act(() => result.current.navigateToItem({ id: "t1", role: "task" }));
    act(() => result.current.returnFromItem("t1"));
    expect(result.current.section).toBe("schedule");
  });

  it("asks the leave guard before going back", async () => {
    const answers: ((ok: boolean) => void)[] = [];
    const confirmLeave = vi.fn(
      () => new Promise<boolean>((resolve) => answers.push(resolve)),
    );
    const { result } = renderHook(() => useShellNavigation({ confirmLeave }));
    const say = async (ok: boolean) => {
      await act(async () => answers.shift()?.(ok));
    };

    act(() => result.current.setSection("connect"));
    await say(true);
    act(() =>
      result.current.navigateToItemWithReturn({ id: "t1", role: "task" }),
    );
    await say(true);
    await waitFor(() => expect(result.current.section).toBe("schedule"));

    act(() => result.current.returnFromItem("t1"));
    await say(false);
    expect(result.current.section).toBe("schedule");

    // A refusal keeps the return point: the next close may still go back.
    act(() => result.current.returnFromItem("t1"));
    await say(true);
    await waitFor(() => expect(result.current.section).toBe("connect"));
  });
});

describe("the shell wiring for #2143", () => {
  it("opens Connect's items through the returning jump, on both tabs", () => {
    const { result } = renderHook(() => useShellNavigation());
    const body = () =>
      SECTION_DESCRIPTORS.connect.body({
        ds: stubDataService(),
        nav: result.current,
        narrowTabRow: undefined,
        loadingFallback: null,
        onConnectCounts: () => undefined,
      }) as ReactElement;

    const tags = body() as ReactElement<{
      children: ReactElement<{ onNavigateToItem?: unknown }>;
    }>;
    expect(tags.props.children.props.onNavigateToItem).toBe(
      result.current.navigateToItemWithReturn,
    );

    act(() => result.current.setConnectTab("goals"));
    const goals = body() as ReactElement<{ onNavigateToItem?: unknown }>;
    expect(goals.type).toBe(GoalsTodosScreen);
    expect(goals.props.onNavigateToItem).toBe(
      result.current.navigateToItemWithReturn,
    );
  });

  it("hands Schedule the shell's go-back as its todo-detail close", () => {
    const { result } = renderHook(() => useShellNavigation());
    // Schedule's body is a Provider stack; walk the single-child chain down to
    // the screen at the bottom.
    let el = SECTION_DESCRIPTORS.schedule.body({
      ds: stubDataService(),
      nav: result.current,
      narrowTabRow: undefined,
      loadingFallback: null,
      onConnectCounts: () => undefined,
    }) as ReactElement<{ children?: unknown; onTodoDetailClose?: unknown }>;
    while (el.props.onTodoDetailClose === undefined && el.props.children) {
      el = el.props.children as typeof el;
    }
    expect(el.props.onTodoDetailClose).toBe(result.current.returnFromItem);
  });
});
