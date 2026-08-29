import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentNoteIds,
  recordNoteOpened,
  subscribeRecentNotes,
  clearRecentNotes,
  resolveRecentNotes,
  RECENT_NOTES_LIMIT,
} from "../src/state/recentNotesStore";

/*
 * #1149 — the persistent "recently opened notes" layer behind the Materials
 * empty state's candidates.
 *
 * The property that makes this worth a suite at all is SURVIVING A RESTART:
 * its sibling materialsSelectionStore deliberately does not, and the empty
 * state these candidates are for is the one you get on a cold start. Storage
 * is therefore asserted directly, not just the in-memory read.
 */

const STORAGE_KEY = "life-editor:recent-notes";

function stored(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  localStorage.clear();
  clearRecentNotes();
});

describe("recentNotesStore", () => {
  it("starts empty", () => {
    expect(getRecentNoteIds()).toEqual([]);
  });

  it("records opens newest-first", () => {
    recordNoteOpened("note-a");
    recordNoteOpened("note-b");

    expect(getRecentNoteIds()).toEqual(["note-b", "note-a"]);
  });

  it("moves a re-opened note to the front instead of duplicating it", () => {
    recordNoteOpened("note-a");
    recordNoteOpened("note-b");
    recordNoteOpened("note-a");

    expect(getRecentNoteIds()).toEqual(["note-a", "note-b"]);
  });

  it("caps the list, dropping from the tail", () => {
    const opened = Array.from(
      { length: RECENT_NOTES_LIMIT + 3 },
      (_, i) => `note-${i}`,
    );
    for (const id of opened) recordNoteOpened(id);

    const ids = getRecentNoteIds();
    expect(ids).toHaveLength(RECENT_NOTES_LIMIT);
    // Newest kept, oldest gone.
    expect(ids[0]).toBe(opened[opened.length - 1]);
    expect(ids).not.toContain("note-0");
  });

  it("survives a restart — the whole reason this is not materialsSelectionStore", () => {
    recordNoteOpened("note-a");
    recordNoteOpened("note-b");
    const persisted = stored();

    // A fresh process drops the module cache but not storage. clearRecentNotes
    // resets the cache (and storage), so putting the persisted value back is
    // what makes the next read a genuine cold one.
    clearRecentNotes();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

    expect(getRecentNoteIds()).toEqual(["note-b", "note-a"]);
  });

  it("writes through to localStorage under the swept prefix", () => {
    recordNoteOpened("note-a");

    expect(stored()).toEqual(["note-a"]);
    // The `life-editor:` prefix is what puts it inside resetPreferences'
    // sweep (D-20260812-materials-1) — an unprefixed key would survive a
    // "reset settings" and is simply a bug (resetPreferences.ts).
    expect(STORAGE_KEY.startsWith("life-editor:")).toBe(true);
  });

  it("treats junk in storage as an empty list rather than throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    clearRecentNotes();
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(getRecentNoteIds()).toEqual([]);

    clearRecentNotes();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["ok", 42, null, ""]));
    expect(getRecentNoteIds()).toEqual(["ok"]);
  });

  it("notifies subscribers on a real change only", () => {
    let calls = 0;
    const unsubscribe = subscribeRecentNotes(() => {
      calls++;
    });

    recordNoteOpened("note-a");
    expect(calls).toBe(1);

    // Re-opening what is already at the front changes nothing, so a re-render
    // or a hydrate retry must not churn every subscriber.
    recordNoteOpened("note-a");
    expect(calls).toBe(1);

    recordNoteOpened("note-b");
    expect(calls).toBe(2);

    unsubscribe();
    recordNoteOpened("note-c");
    expect(calls).toBe(2);
  });

  it("returns an identity-stable snapshot so useSyncExternalStore settles", () => {
    recordNoteOpened("note-a");

    expect(getRecentNoteIds()).toBe(getRecentNoteIds());
  });
});

describe("resolveRecentNotes", () => {
  const notes = [
    { id: "note-a", title: "Alpha" },
    { id: "note-b", title: "Beta" },
  ];

  it("keeps the stored order, not the notes-array order", () => {
    expect(resolveRecentNotes(["note-b", "note-a"], notes)).toEqual([
      { id: "note-b", title: "Beta" },
      { id: "note-a", title: "Alpha" },
    ]);
  });

  it("drops ids the notes array no longer has", () => {
    // This is the soft-delete story: the caller's array has already had
    // deleted rows filtered out, so a deleted note simply fails to resolve.
    expect(resolveRecentNotes(["note-a", "note-gone"], notes)).toEqual([
      { id: "note-a", title: "Alpha" },
    ]);
  });

  it("resolves to nothing when every remembered note is gone", () => {
    expect(resolveRecentNotes(["x", "y"], [])).toEqual([]);
  });
});
