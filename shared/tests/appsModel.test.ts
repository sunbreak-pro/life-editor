// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, expect, it } from "vitest";
import { buildAppsModel, daysSince } from "../src/components/Apps/appsModel";
import type { AppRecordSource } from "../src/types/appRecord";
import type { ExtensionApp } from "../src/types/extensionApp";

/*
 * The Apps section's join (#2165): registered apps with their record activity,
 * and the record sources the ledger does not list. The screen-level behaviour
 * (dialogs, the delete question, the narrow layout) is in
 * web/tests/appsScreen.test.tsx.
 */

function app(slug: string, name = slug): ExtensionApp {
  return {
    slug,
    name,
    url: null,
    icon: null,
    description: null,
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

function source(
  sourceApp: string,
  lastRecordAt: string,
  recordsLast30Days = 1,
): AppRecordSource {
  return { sourceApp, lastRecordAt, recordsLast30Days };
}

describe("buildAppsModel", () => {
  it("joins each registered app with its source, in ledger order", () => {
    const model = buildAppsModel(
      [app("ledger"), app("scale")],
      [source("scale", "2026-10-10T00:00:00Z", 4)],
    );
    expect(model.registered.map((a) => a.slug)).toEqual(["ledger", "scale"]);
    expect(model.registered[0]).toMatchObject({
      lastRecordAt: null,
      recordsLast30Days: 0,
    });
    expect(model.registered[1]).toMatchObject({
      lastRecordAt: "2026-10-10T00:00:00Z",
      recordsLast30Days: 4,
    });
  });

  it("lists unregistered sources newest first and never `claude`", () => {
    const model = buildAppsModel(
      [app("ledger")],
      [
        source("ledger", "2026-10-11T00:00:00Z"),
        source("claude", "2026-10-12T00:00:00Z"),
        source("sleep", "2026-10-01T00:00:00Z"),
        source("scale", "2026-10-09T00:00:00Z"),
      ],
    );
    expect(model.unregistered.map((s) => s.slug)).toEqual(["scale", "sleep"]);
  });
});

describe("daysSince", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");

  it("counts whole days", () => {
    expect(daysSince("2026-10-12T01:00:00Z", now)).toBe(0);
    expect(daysSince("2026-10-11T11:00:00Z", now)).toBe(1);
    expect(daysSince("2026-10-02T12:00:00Z", now)).toBe(10);
  });

  it("reads a future stamp or a broken one as today", () => {
    expect(daysSince("2026-10-13T00:00:00Z", now)).toBe(0);
    expect(daysSince("not a date", now)).toBe(0);
  });
});
