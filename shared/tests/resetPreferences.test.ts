import { describe, it, expect, beforeEach } from "vitest";
import {
  resetLocalPreferences,
  collectPreferenceKeys,
} from "../src/utils/resetPreferences";

/*
 * Reset preferences §216 — clears the app's localStorage namespace only
 * (both life-editor- hyphen and life-editor: colon keys), leaving unrelated
 * origin keys untouched. reload:false keeps jsdom from calling location.reload.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("collectPreferenceKeys", () => {
  it("collects hyphen- and colon-namespaced keys, ignoring others", () => {
    localStorage.setItem("life-editor-theme", "dark");
    localStorage.setItem("life-editor:kanban-view-mode", "folder");
    localStorage.setItem("some-other-app", "keep");
    expect(collectPreferenceKeys().sort()).toEqual(
      ["life-editor-theme", "life-editor:kanban-view-mode"].sort(),
    );
  });
});

describe("resetLocalPreferences", () => {
  it("removes only the app-namespaced keys and returns them", () => {
    localStorage.setItem("life-editor-theme", "dark");
    localStorage.setItem("life-editor-theme-mode", "system");
    localStorage.setItem("life-editor:kanban-view-mode", "status");
    localStorage.setItem("unrelated-key", "keep-me");

    const removed = resetLocalPreferences({ reload: false });

    expect(removed.sort()).toEqual(
      [
        "life-editor-theme",
        "life-editor-theme-mode",
        "life-editor:kanban-view-mode",
      ].sort(),
    );
    expect(localStorage.getItem("life-editor-theme")).toBeNull();
    expect(localStorage.getItem("life-editor-theme-mode")).toBeNull();
    expect(localStorage.getItem("life-editor:kanban-view-mode")).toBeNull();
    expect(localStorage.getItem("unrelated-key")).toBe("keep-me");
  });

  it("is a no-op (returns empty) when nothing is stored", () => {
    expect(resetLocalPreferences({ reload: false })).toEqual([]);
  });
});
