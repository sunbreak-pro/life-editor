import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  getConnectItemSelection,
  getConnectTagSelection,
  resetConnectSelection,
  setConnectItemSelection,
  setConnectTagSelection,
} from "@life-editor/shared";
import { useShellNavigation } from "../src/hooks/useShellNavigation";

/*
 * #2407 — 「タグの色を変える →」 in the Schedule's event editor opens the tag on
 * Connect's tag screen. The shell does it with no pending intent: ConnectScreen
 * seeds its open tag from the module-level store (#1473) on every mount, so the
 * hook writes the store and then switches. What can break is the order and the
 * guard — a refused move must leave Connect pointed where it was.
 */

beforeEach(() => {
  localStorage.clear();
  resetConnectSelection();
});

describe("useShellNavigation — openTagInConnect (#2407)", () => {
  it("lands on Connect's Tags tab with that tag selected", () => {
    const { result } = renderHook(() => useShellNavigation());
    // Start somewhere else, on the other Connect tab, so neither is a default.
    act(() => result.current.setSection("schedule"));
    act(() => result.current.setConnectTab("goals"));

    act(() => result.current.openTagInConnect("tag-health"));

    expect(result.current.section).toBe("connect");
    expect(result.current.connectTab).toBe("tags");
    expect(getConnectTagSelection()).toBe("tag-health");
  });

  it("raises the intent a mounted ConnectScreen consumes, once (#2395)", () => {
    const { result } = renderHook(() => useShellNavigation());
    expect(result.current.pendingConnectTag).toBeNull();

    act(() => result.current.openTagInConnect("tag-health"));
    expect(result.current.pendingConnectTag).toBe("tag-health");

    act(() => result.current.consumeConnectTag());
    expect(result.current.pendingConnectTag).toBeNull();
  });

  it("raises no intent on a refusal (#2395)", async () => {
    const { result } = renderHook(() =>
      useShellNavigation({ confirmLeave: async () => false }),
    );

    await act(async () => result.current.openTagInConnect("tag-health"));

    expect(result.current.pendingConnectTag).toBeNull();
  });

  it("drops the row the panel was reading under another tag", () => {
    setConnectTagSelection("tag-work");
    setConnectItemSelection("note-1");
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.openTagInConnect("tag-health"));

    expect(getConnectItemSelection()).toBeNull();
  });

  it("keeps that row when the tag is the one already open", () => {
    setConnectTagSelection("tag-health");
    setConnectItemSelection("note-1");
    const { result } = renderHook(() => useShellNavigation());

    act(() => result.current.openTagInConnect("tag-health"));

    expect(getConnectItemSelection()).toBe("note-1");
  });

  it("asks the leave guard first and changes nothing on a refusal", async () => {
    let answer: (ok: boolean) => void = () => {};
    const confirmLeave = vi.fn(
      () => new Promise<boolean>((resolve) => (answer = resolve)),
    );
    setConnectTagSelection("tag-work");
    const { result } = renderHook(() => useShellNavigation({ confirmLeave }));
    act(() => result.current.setConnectTab("goals"));
    const before = result.current.section;

    act(() => result.current.openTagInConnect("tag-health"));
    expect(confirmLeave).toHaveBeenCalledTimes(1);
    // Asked, not moved: the store is written inside the guard too.
    expect(getConnectTagSelection()).toBe("tag-work");

    await act(async () => answer(false));
    expect(result.current.section).toBe(before);
    expect(result.current.connectTab).toBe("goals");
    expect(getConnectTagSelection()).toBe("tag-work");
  });

  it("moves once the guard agrees", async () => {
    let answer: (ok: boolean) => void = () => {};
    const confirmLeave = vi.fn(
      () => new Promise<boolean>((resolve) => (answer = resolve)),
    );
    const { result } = renderHook(() => useShellNavigation({ confirmLeave }));

    act(() => result.current.openTagInConnect("tag-health"));
    await act(async () => answer(true));

    await waitFor(() => expect(result.current.section).toBe("connect"));
    expect(result.current.connectTab).toBe("tags");
    expect(getConnectTagSelection()).toBe("tag-health");
  });
});
