import { beforeEach, describe, expect, it } from "vitest";
import {
  OWN_WRITE_TTL_MS,
  isOwnEcho,
  noteOwnWrite,
  resetOwnWriteLedger,
} from "../src/services/ownWriteLedger";

/*
 * #2290 item 3 — the ledger that lets SyncProvider drop the Realtime echo of
 * this client's own save. What matters is the other direction: a change from
 * another device must never be taken for ours, or the screen goes stale with
 * nothing the user can do about it.
 */

const STAMP = "2026-10-21T03:00:00.123Z";
// Postgres hands the same instant back in its own spelling.
const STAMP_FROM_PG = "2026-10-21T03:00:00.123+00:00";

beforeEach(() => resetOwnWriteLedger());

describe("items_meta echoes", () => {
  it("matches the same id and instant, whatever the spelling", () => {
    noteOwnWrite("items_meta", "daily-2026-10-21", STAMP, 0);
    expect(
      isOwnEcho(
        "items_meta",
        { id: "daily-2026-10-21", updated_at: STAMP_FROM_PG },
        10,
      ),
    ).toBe(true);
  });

  it("does not match another device's write to the same row", () => {
    noteOwnWrite("items_meta", "note-1", STAMP, 0);
    expect(
      isOwnEcho(
        "items_meta",
        { id: "note-1", updated_at: "2026-10-21T03:00:00.124Z" },
        10,
      ),
    ).toBe(false);
  });

  it("records nothing without a stamp", () => {
    noteOwnWrite("items_meta", "note-1", undefined, 0);
    expect(
      isOwnEcho("items_meta", { id: "note-1", updated_at: STAMP }, 10),
    ).toBe(false);
  });

  it("absorbs one echo per write", () => {
    noteOwnWrite("items_meta", "note-1", STAMP, 0);
    const row = { id: "note-1", updated_at: STAMP };
    expect(isOwnEcho("items_meta", row, 10)).toBe(true);
    expect(isOwnEcho("items_meta", row, 20)).toBe(false);
  });
});

describe("payload echoes", () => {
  it("match on item_id inside the window", () => {
    noteOwnWrite("notes_payload", "note-1", undefined, 0);
    expect(isOwnEcho("notes_payload", { item_id: "note-1" }, 10)).toBe(true);
  });

  it("expire after the window", () => {
    noteOwnWrite("notes_payload", "note-1", undefined, 0);
    expect(
      isOwnEcho("notes_payload", { item_id: "note-1" }, OWN_WRITE_TTL_MS + 1),
    ).toBe(false);
  });

  it("are kept per table", () => {
    noteOwnWrite("notes_payload", "note-1", undefined, 0);
    expect(isOwnEcho("dailies_payload", { item_id: "note-1" }, 10)).toBe(false);
  });

  it("never match a delete (no new row)", () => {
    noteOwnWrite("notes_payload", "note-1", undefined, 0);
    expect(isOwnEcho("notes_payload", {}, 10)).toBe(false);
    expect(isOwnEcho("notes_payload", undefined, 10)).toBe(false);
  });
});
