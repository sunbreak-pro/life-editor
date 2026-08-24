import { describe, it, expect, beforeEach } from "vitest";
import {
  resetLocalPreferences,
  collectPreferenceKeys,
} from "../src/utils/resetPreferences";

/*
 * Reset preferences §216 — clears the app's localStorage namespace only
 * (the life-editor- hyphen, life-editor: colon and life-editor. dot keys),
 * leaving unrelated origin keys untouched. reload:false keeps jsdom from
 * calling location.reload.
 *
 * #718: the dot family used to slip through, so "reset settings" left the
 * sidebar collapsed and the Connect graph pinned to its old layout. The real
 * keys are listed below with their owning file so a rename shows up here.
 */

/**
 * Every namespaced key the app actually writes, by owning module. Kept as
 * literals on purpose: the owning constants are module-private, so this list
 * is the one place that states what "the app's namespace" contains in
 * practice. A key added without a `life-editor` prefix will fail the sweep
 * test below.
 */
const REAL_KEYS = [
  // hyphen — settings screen prefs
  "life-editor-theme", // context/ThemeContext.tsx
  "life-editor-language", // i18n/index.ts
  "life-editor-shortcut-config", // context/ShortcutConfigContext.tsx
  "life-editor-startup-section", // hooks/useStartupSection.ts
  "life-editor-day-start-hour", // utils/dateKey.ts
  // colon — per-surface view prefs
  "life-editor:kanban-view-mode", // components/Kanban/viewModeStorage.ts
  "life-editor:note-sort-mode", // hooks/notesUnifiedHelpers.ts
  "life-editor:note-sort-direction", // same (#718 — renamed from bare)
  "life-editor:note-tree-expanded", // same (#718 — renamed from bare)
  "life-editor:note-tag-groups-collapsed", // web/src/notes/hooks/useNoteListState.tsx (#718)
  "life-editor:daily-sort-direction", // web/src/daily/DailyView.tsx
  // dot — layout / canvas state (#718)
  "life-editor.shell.sidebar-collapsed", // components/AppShell.tsx
  "life-editor.shell.right-sidebar-width", // context/RightSidebarContext.tsx
  "life-editor.connect.pointGraph.positions", // components/Connect/graph/graphStorage.ts
  "life-editor.connect.pointGraph.viewport", // same
];

beforeEach(() => {
  localStorage.clear();
});

describe("collectPreferenceKeys", () => {
  it("collects hyphen-, colon- and dot-namespaced keys, ignoring others", () => {
    localStorage.setItem("life-editor-theme", "dark");
    localStorage.setItem("life-editor:kanban-view-mode", "folder");
    localStorage.setItem("life-editor.shell.sidebar-collapsed", "true");
    localStorage.setItem("some-other-app", "keep");
    expect(collectPreferenceKeys().sort()).toEqual(
      [
        "life-editor-theme",
        "life-editor:kanban-view-mode",
        "life-editor.shell.sidebar-collapsed",
      ].sort(),
    );
  });

  it("covers every key the app writes under the namespace", () => {
    for (const key of REAL_KEYS) localStorage.setItem(key, "x");
    expect(collectPreferenceKeys().sort()).toEqual([...REAL_KEYS].sort());
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

  it("clears the dot-namespaced layout state too (#718)", () => {
    // These four survived a reset before #718: the shell kept its collapsed
    // sidebar and stored width, and the Connect graph kept the node positions
    // and viewport it had saved.
    const dotKeys = REAL_KEYS.filter((k) => k.startsWith("life-editor."));
    for (const key of dotKeys) localStorage.setItem(key, "x");

    expect(resetLocalPreferences({ reload: false }).sort()).toEqual(
      [...dotKeys].sort(),
    );
    for (const key of dotKeys) expect(localStorage.getItem(key)).toBeNull();
  });

  it("clears the renamed Notes view keys too (#718)", () => {
    // These three used to be stored bare (`note-tree-expanded`,
    // `note-sort-direction`, `note-tag-groups-collapsed`) and survived a reset,
    // leaving Notes half-reset: sort MODE back to default, DIRECTION + tree
    // expansion + folded tag groups untouched. D-20260812-materials-1 chose to
    // rename them into the namespace (values carried over by
    // migrateLegacyPreferenceKeys) rather than keep an exception list here.
    const notesKeys = [
      "life-editor:note-tree-expanded",
      "life-editor:note-sort-direction",
      "life-editor:note-tag-groups-collapsed",
    ];
    for (const key of notesKeys) localStorage.setItem(key, "x");

    expect(resetLocalPreferences({ reload: false }).sort()).toEqual(
      [...notesKeys].sort(),
    );
    for (const key of notesKeys) expect(localStorage.getItem(key)).toBeNull();
  });

  it("does not touch bare keys left over from before the #718 rename", () => {
    // The sweep matches by prefix and has no exception list. A bare key is
    // whatever the startup migration has not consumed yet (or another app on
    // the same origin), so leaving it alone is the correct behaviour — see
    // migrateLegacyPreferenceKeys.test.ts for the hand-off.
    localStorage.setItem("note-tree-expanded", '["a"]');

    expect(resetLocalPreferences({ reload: false })).toEqual([]);
    expect(localStorage.getItem("note-tree-expanded")).toBe('["a"]');
  });
});
