import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  migrateLegacyPreferenceKeys,
  LEGACY_PREFERENCE_KEY_RENAMES,
} from "../src/utils/migrateLegacyPreferenceKeys";
import { collectPreferenceKeys } from "../src/utils/resetPreferences";

/*
 * #718 (D-20260812-materials-1 = A) — the three bare Notes keys were renamed
 * into the `life-editor:` namespace so "reset settings" can see them. This
 * covers the hand-off that makes the rename lossless: values already saved
 * under the old names are copied across at startup, then the old names go away.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LEGACY_PREFERENCE_KEY_RENAMES", () => {
  it("maps every bare key onto a name the reset sweep collects", () => {
    for (const [legacyKey, namespacedKey] of LEGACY_PREFERENCE_KEY_RENAMES) {
      expect(legacyKey.startsWith("life-editor")).toBe(false);
      localStorage.setItem(namespacedKey, "x");
    }
    expect(collectPreferenceKeys().sort()).toEqual(
      LEGACY_PREFERENCE_KEY_RENAMES.map(([, to]) => to).sort(),
    );
  });

  it("covers the three keys named in the issue", () => {
    expect(LEGACY_PREFERENCE_KEY_RENAMES.map(([from]) => from).sort()).toEqual([
      "note-sort-direction",
      "note-tag-groups-collapsed",
      "note-tree-expanded",
    ]);
  });
});

describe("migrateLegacyPreferenceKeys", () => {
  it("copies each legacy value onto the namespaced key and drops the old one", () => {
    localStorage.setItem("note-tree-expanded", '["a","b"]');
    localStorage.setItem("note-sort-direction", "desc");
    localStorage.setItem("note-tag-groups-collapsed", '["work"]');

    expect(migrateLegacyPreferenceKeys().sort()).toEqual([
      "note-sort-direction",
      "note-tag-groups-collapsed",
      "note-tree-expanded",
    ]);

    expect(localStorage.getItem("life-editor:note-tree-expanded")).toBe(
      '["a","b"]',
    );
    expect(localStorage.getItem("life-editor:note-sort-direction")).toBe(
      "desc",
    );
    expect(localStorage.getItem("life-editor:note-tag-groups-collapsed")).toBe(
      '["work"]',
    );
    expect(localStorage.getItem("note-tree-expanded")).toBeNull();
    expect(localStorage.getItem("note-sort-direction")).toBeNull();
    expect(localStorage.getItem("note-tag-groups-collapsed")).toBeNull();
  });

  it("is a no-op on a machine that never stored the legacy keys", () => {
    expect(migrateLegacyPreferenceKeys()).toEqual([]);
    expect(collectPreferenceKeys()).toEqual([]);
  });

  it("is idempotent — the second run finds nothing left to move", () => {
    localStorage.setItem("note-sort-direction", "desc");
    expect(migrateLegacyPreferenceKeys()).toEqual(["note-sort-direction"]);
    expect(migrateLegacyPreferenceKeys()).toEqual([]);
    expect(localStorage.getItem("life-editor:note-sort-direction")).toBe(
      "desc",
    );
  });

  it("keeps the newer namespaced value when both names exist, dropping the stale one", () => {
    localStorage.setItem("note-sort-direction", "asc"); // stale leftover
    localStorage.setItem("life-editor:note-sort-direction", "desc"); // in use

    expect(migrateLegacyPreferenceKeys()).toEqual(["note-sort-direction"]);
    expect(localStorage.getItem("life-editor:note-sort-direction")).toBe(
      "desc",
    );
    expect(localStorage.getItem("note-sort-direction")).toBeNull();
  });

  it("leaves unrelated origin keys alone", () => {
    localStorage.setItem("some-other-app", "keep");
    localStorage.setItem("note-tree-expanded", '["a"]');

    migrateLegacyPreferenceKeys();

    expect(localStorage.getItem("some-other-app")).toBe("keep");
  });

  it("keeps the legacy value when the write fails, so the next start can retry", () => {
    localStorage.setItem("note-sort-direction", "desc");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });

    expect(() => migrateLegacyPreferenceKeys()).not.toThrow();
    expect(migrateLegacyPreferenceKeys()).toEqual([]);

    vi.restoreAllMocks();
    expect(localStorage.getItem("note-sort-direction")).toBe("desc");
  });

  it("swallows storage read failures (private mode / blocked origin)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    expect(migrateLegacyPreferenceKeys()).toEqual([]);
  });
});
