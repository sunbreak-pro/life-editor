import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import { resetMaterialsSelection } from "../src/state/materialsSelectionStore";
import type { DataService } from "../src/services/DataService";

/*
 * #283 — sort MODE persistence at the hook level. The Materials Notes provider
 * unmounts on tab/section switch; the chosen sort mode must survive via
 * localStorage (namespaced key `life-editor:note-sort-mode`), mirroring the
 * existing un-namespaced `note-sort-direction`. A stored value outside the
 * NoteSortMode union falls back to the "updatedAt" default.
 */

const LS_SORT_MODE = "life-editor:note-sort-mode";

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    { value: { syncVersion: 0, triggerSync: async () => {} } },
    children,
  );
}

const emptyNotesDS = {
  listNotesUnified: async () => [],
  fetchDeletedNotesUnified: async () => [],
} as unknown as DataService;

describe("Note sort-mode persistence (#283)", () => {
  beforeEach(() => {
    resetMaterialsSelection();
    localStorage.clear();
  });

  it("persists setSortMode('title') to the namespaced localStorage key", async () => {
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: emptyNotesDS }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Default before any change.
    expect(result.current.sortMode).toBe("updatedAt");

    act(() => {
      result.current.setSortMode("title");
    });

    expect(result.current.sortMode).toBe("title");
    expect(localStorage.getItem(LS_SORT_MODE)).toBe("title");
  });

  it("restores a valid stored mode on mount", async () => {
    localStorage.setItem(LS_SORT_MODE, "createdAt");
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: emptyNotesDS }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sortMode).toBe("createdAt");
  });

  it("falls back to 'updatedAt' when the stored value is invalid", async () => {
    localStorage.setItem(LS_SORT_MODE, "bogus-mode");
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: emptyNotesDS }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sortMode).toBe("updatedAt");
  });
});
