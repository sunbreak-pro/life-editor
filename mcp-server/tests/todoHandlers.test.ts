import { describe, it, expect } from "vitest";
import {
  toDbStatus,
  toToolStatus,
  rangeBound,
} from "../src/handlers/todoHandlers.js";

/*
 * Pure translation seams of the Supabase todo handlers (#360). The status
 * vocabularies are the risky part: the DB CHECK constraint is UPPERCASE
 * while the MCP tool schema kept its lowercase enum, and a silent mismatch
 * would make every status filter return nothing instead of failing loudly.
 */

describe("toDbStatus", () => {
  it("maps the tool vocabulary onto the DB CHECK values", () => {
    expect(toDbStatus("not_started")).toBe("NOT_STARTED");
    expect(toDbStatus("done")).toBe("DONE");
  });

  it("rejects the retired in_progress value (#873)", () => {
    // The CHECK constraint still accepts it, so nothing but this guard stops a
    // caller from writing a status no surface can display.
    expect(() => toDbStatus("in_progress")).toThrow(/Invalid status/);
  });

  it("accepts a value that is already uppercase", () => {
    expect(toDbStatus("DONE")).toBe("DONE");
  });

  it("throws on an unknown status instead of querying for it", () => {
    expect(() => toDbStatus("finished")).toThrow(/Invalid status/);
  });
});

describe("toToolStatus", () => {
  it("round-trips every DB value back to the tool vocabulary", () => {
    for (const tool of ["not_started", "done"]) {
      expect(toToolStatus(toDbStatus(tool))).toBe(tool);
    }
  });

  it("reads a legacy IN_PROGRESS row back as not_started (#873)", () => {
    expect(toToolStatus("IN_PROGRESS")).toBe("not_started");
  });

  it("passes NULL through (legacy rows have no status)", () => {
    expect(toToolStatus(null)).toBeNull();
  });
});

describe("rangeBound", () => {
  it("expands a bare date to a UTC instant", () => {
    const start = rangeBound("2026-07-26", "start");
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(start).not.toBe("2026-07-26");
  });

  it("ends the range at the NEXT day's start, so the whole day counts", () => {
    const start = rangeBound("2026-07-26", "start");
    const end = rangeBound("2026-07-26", "end");
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it("leaves a full ISO 8601 timestamp untouched", () => {
    const iso = "2026-07-26T09:30:00.000Z";
    expect(rangeBound(iso, "start")).toBe(iso);
    expect(rangeBound(iso, "end")).toBe(iso);
  });
});
