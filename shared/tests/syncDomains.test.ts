// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { REALTIME_TABLES } from "../src/context/SyncContext";
import {
  SYNC_DOMAINS,
  TABLE_DOMAIN_MAP,
  domainsForChange,
  type SyncDomain,
} from "../src/context/syncDomains";

/*
 * #499 — a Realtime change must move only the domains it actually affects.
 *
 * The measured symptom was that one note edit re-pulled every table four times
 * (~86 REST requests), including a POST to `timer_settings` because reading
 * the timer settings materialises its row. Routing each change to a domain is
 * what stops a note edit from touching the timer at all — so the tests that
 * matter are the NEGATIVE ones: which domains stay still.
 *
 * The lockstep test is the load-bearing one over time: a table added to
 * REALTIME_TABLES without a domain would subscribe to Realtime and then bump
 * nothing, which looks exactly like "sync is broken for that feature" and has
 * no other alarm.
 */

const ITEM_DOMAINS: SyncDomain[] = ["todos", "notes", "dailies", "schedule"];

describe("syncDomains — lockstep with REALTIME_TABLES", () => {
  it("routes every subscribed table to a domain", () => {
    const unrouted = REALTIME_TABLES.filter(
      (t) => t !== "items_meta" && !(t in TABLE_DOMAIN_MAP),
    );
    expect(unrouted).toEqual([]);
  });

  it("maps no table that is not subscribed", () => {
    const subscribed = new Set<string>(REALTIME_TABLES);
    const orphans = Object.keys(TABLE_DOMAIN_MAP).filter(
      (t) => !subscribed.has(t),
    );
    expect(orphans).toEqual([]);
  });

  it("only names declared domains", () => {
    const declared = new Set<string>(SYNC_DOMAINS);
    const undeclared = Object.values(TABLE_DOMAIN_MAP).filter(
      (d) => !declared.has(d),
    );
    expect(undeclared).toEqual([]);
  });
});

describe("syncDomains — payload tables", () => {
  it("routes each payload table to its own domain", () => {
    expect(domainsForChange("notes_payload")).toEqual(["notes"]);
    expect(domainsForChange("tasks_payload")).toEqual(["todos"]);
    expect(domainsForChange("dailies_payload")).toEqual(["dailies"]);
  });

  it("puts events and routines both under schedule", () => {
    // A Routine is an Event template, not a domain of its own (CLAUDE.md §4).
    expect(domainsForChange("events_payload")).toEqual(["schedule"]);
    expect(domainsForChange("routines_payload")).toEqual(["schedule"]);
  });

  it("keeps the session log off the timer counter (#993)", () => {
    // Reading the timer settings materialises a row (#499), so the
    // write-heavy session log must not share TimerProvider's counter.
    expect(domainsForChange("timer_sessions")).toEqual(["sessions"]);
    expect(domainsForChange("timer_sessions")).not.toContain("timer");
    expect(domainsForChange("timer_settings")).toEqual(["timer"]);
    expect(domainsForChange("pomodoro_presets")).toEqual(["timer"]);
  });

  it("leaves the timer alone when a note changes", () => {
    // The whole point: fetching timer settings WRITES, so a note edit that
    // bumped the timer domain would POST to timer_settings.
    expect(domainsForChange("notes_payload")).not.toContain("timer");
    expect(domainsForChange("notes_payload")).not.toContain("audio");
    expect(domainsForChange("notes_payload")).not.toContain("todos");
  });

  it("returns nothing for a table it does not know", () => {
    expect(domainsForChange("some_future_table")).toEqual([]);
  });
});

describe("syncDomains — items_meta is routed by role", () => {
  it("sends a row to the domain its role belongs to", () => {
    expect(domainsForChange("items_meta", { role: "note" })).toEqual(["notes"]);
    expect(domainsForChange("items_meta", { role: "task" })).toEqual(["todos"]);
    expect(domainsForChange("items_meta", { role: "daily" })).toEqual([
      "dailies",
    ]);
    expect(domainsForChange("items_meta", { role: "event" })).toEqual([
      "schedule",
    ]);
    expect(domainsForChange("items_meta", { role: "routine" })).toEqual([
      "schedule",
    ]);
  });

  it("falls back to the old row's role when the new one is absent", () => {
    expect(domainsForChange("items_meta", undefined, { role: "note" })).toEqual(
      ["notes"],
    );
  });

  it("bumps every item domain when the role cannot be read", () => {
    // A hard DELETE carries only the replica-identity columns, so the role is
    // usually missing. A missed bump is stale data the user cannot refresh; an
    // extra bump only costs a fetch, so the unknown case fans out.
    expect(domainsForChange("items_meta", { id: "note-1" })).toEqual(
      ITEM_DOMAINS,
    );
    expect(domainsForChange("items_meta")).toEqual(ITEM_DOMAINS);
    expect(domainsForChange("items_meta", { role: 42 })).toEqual(ITEM_DOMAINS);
  });

  /*
   * #625 Event <-> Todo conversion: the row keeps its id and changes ROLE, so
   * TWO section lists have to refetch — the one that loses the item and the one
   * that gains it. This pins where that comes from.
   *
   * The items_meta UPDATE alone is NOT enough, and that is the trap: this
   * function routes items_meta by the role on the CHANGED row, which after a
   * conversion is only ever the destination. The source domain refetches
   * because the conversion also writes both payload tables, and those are
   * routed by TABLE, not by role. Anyone rewriting the conversion to touch
   * items_meta alone would leave the source list holding a row that no longer
   * exists, with no way for the user to clear it.
   */
  it("moves BOTH domains for an Event->Todo conversion (#625)", () => {
    const moved = new Set([
      ...domainsForChange("events_payload"),
      ...domainsForChange("items_meta", { role: "task" }),
      ...domainsForChange("tasks_payload"),
    ]);
    expect([...moved].sort()).toEqual(["schedule", "todos"]);
    // The role-routed half on its own is one-lunged, in both directions.
    expect(domainsForChange("items_meta", { role: "task" })).toEqual(["todos"]);
    expect(domainsForChange("items_meta", { role: "event" })).toEqual([
      "schedule",
    ]);
  });

  it("never routes an item change to the timer or audio domains", () => {
    for (const role of ["task", "note", "daily", "event", "routine"]) {
      const domains = domainsForChange("items_meta", { role });
      expect(domains).not.toContain("timer");
      expect(domains).not.toContain("audio");
      expect(domains).not.toContain("tags");
      expect(domains).not.toContain("calendars");
    }
  });
});
