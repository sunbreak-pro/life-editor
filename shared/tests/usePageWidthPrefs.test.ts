import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePageWidthPrefs } from "../src/hooks/usePageWidthPrefs";

/*
 * Layout Standard v2 §5 — per-section width-tab persistence. One localStorage
 * entry holds a scope→mode map so every section's choice stays live while the
 * host switches sections (useLocalStorage reads its key once on mount).
 */

const STORAGE_KEY = "life-editor.layout.page-width";

afterEach(() => {
  localStorage.clear();
});

describe("usePageWidthPrefs", () => {
  it("starts empty and records one scope without touching the others", () => {
    const { result } = renderHook(() => usePageWidthPrefs());
    expect(result.current[0]).toEqual({});

    act(() => result.current[1]("work", "wide"));
    act(() => result.current[1]("settings", "narrow"));

    expect(result.current[0]).toEqual({ work: "wide", settings: "narrow" });
  });

  it("persists the map under the single storage key and rehydrates on mount", () => {
    const first = renderHook(() => usePageWidthPrefs());
    act(() => first.result.current[1]("materials:notes", "wide"));
    first.unmount();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")).toEqual({
      "materials:notes": "wide",
    });

    // A fresh mount (= reload) sees the persisted choice.
    const second = renderHook(() => usePageWidthPrefs());
    expect(second.result.current[0]["materials:notes"]).toBe("wide");
  });

  it("overwrites an existing scope on a repeat choice", () => {
    const { result } = renderHook(() => usePageWidthPrefs());
    act(() => result.current[1]("work", "wide"));
    act(() => result.current[1]("work", "narrow"));
    expect(result.current[0]).toEqual({ work: "narrow" });
  });
});
