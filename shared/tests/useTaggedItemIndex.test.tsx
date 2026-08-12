import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useTaggedItemIndex } from "../src/hooks/useTaggedItemIndex";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * useTaggedItemIndex (#409) — pinned for #586. The contract under guard:
 * the itemId → { role, title } lookup resolves the four user-facing roles
 * (dailies keyed by their DATE, soft-deleted rows dropped), `loading`
 * settles false once the fetch lands, settles false immediately when there
 * is NO service to read from, and stays true while the hook is disabled
 * (the panel is closed — nothing has been fetched yet).
 */

function syncWrapper({ children }: { children: ReactNode }) {
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

function makeDS() {
  const fetchTaskTree = vi.fn(async () => [
    { id: "task-1", title: "Ship the panel", isDeleted: false },
    { id: "task-2", title: "Old chore", isDeleted: true },
  ]);
  const ds = stubDataService({
    fetchTaskTree,
    fetchEvents: async () => [
      { id: "event-1", title: "Standup", isDeleted: false },
    ],
    listNotesUnified: async () => [
      { id: "note-1", title: "Scratch", isDeleted: false },
    ],
    listDailiesUnified: async () => [
      { id: "daily-2026-08-10", date: "2026-08-10", isDeleted: false },
    ],
  });
  return { ds, fetchTaskTree };
}

describe("useTaggedItemIndex (#409 / #586 pins)", () => {
  it("resolves the four roles, keys dailies by date, drops deleted rows", async () => {
    const { ds } = makeDS();
    const { result } = renderHook(() => useTaggedItemIndex(ds), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const { index } = result.current;
    expect(index.get("task-1")).toEqual({
      role: "task",
      title: "Ship the panel",
    });
    expect(index.get("event-1")).toEqual({ role: "event", title: "Standup" });
    expect(index.get("note-1")).toEqual({ role: "note", title: "Scratch" });
    // The date IS the daily's name.
    expect(index.get("daily-2026-08-10")).toEqual({
      role: "daily",
      title: "2026-08-10",
    });
    expect(index.has("task-2")).toBe(false);
  });

  it("settles loading=false when there is no service to read from", async () => {
    const { result } = renderHook(() => useTaggedItemIndex(undefined), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.index.size).toBe(0);
  });

  it("stays loading (and fetches nothing) while disabled", async () => {
    const { ds, fetchTaskTree } = makeDS();
    const { result } = renderHook(() => useTaggedItemIndex(ds, false), {
      wrapper: syncWrapper,
    });
    // Give any (wrong) fetch a chance to fire before asserting it did not.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.loading).toBe(true);
    expect(fetchTaskTree).not.toHaveBeenCalled();
  });
});
