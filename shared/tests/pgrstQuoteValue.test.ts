import { describe, it, expect } from "vitest";
import { pgrstQuoteValue } from "../src/services/SupabaseDataService";

/*
 * PostgREST filter-value escaping (A audit Top5 #2). PostgREST treats
 * reserved chars (`,` `.` `:` `(` `)` whitespace) as grammar terminators
 * inside a filter value; the documented remedy is to double-quote the
 * value and backslash-escape embedded `"` and `\`. These tests pin the
 * break-out-prevention contract that searchNotes / deleteNoteConnectionByPair
 * both rely on.
 *
 * M1 KNOWN GAP — INTENTIONAL CURRENT-BEHAVIOUR RECORDING: SQL LIKE/ILIKE
 * wildcards `%` and `_` are NOT escaped by this helper (it only handles
 * PostgREST grammar, not LIKE pattern semantics). The `%`/`_` cases below
 * are NOT a desired-behaviour assertion; they freeze the EXISTING
 * behaviour so the M1 gap is documented and any future change is a
 * deliberate, visible diff. This file fixes no bug — it records reality.
 */

describe("pgrstQuoteValue — PostgREST grammar break-out prevention", () => {
  it("wraps a plain value in double quotes", () => {
    expect(pgrstQuoteValue("hello")).toBe('"hello"');
  });

  it("neutralises reserved chars by quoting (comma / parens / dot / colon / space)", () => {
    // Quoted -> PostgREST treats the whole thing literally; the reserved
    // chars survive verbatim inside the quotes (that is the point).
    expect(pgrstQuoteValue("a,b")).toBe('"a,b"');
    expect(pgrstQuoteValue("or(id.eq.1)")).toBe('"or(id.eq.1)"');
    expect(pgrstQuoteValue("a.b.c")).toBe('"a.b.c"');
    expect(pgrstQuoteValue("a:b")).toBe('"a:b"');
    expect(pgrstQuoteValue("a b")).toBe('"a b"');
  });

  it("backslash-escapes an embedded double quote", () => {
    expect(pgrstQuoteValue('a"b')).toBe('"a\\"b"');
  });

  it("backslash-escapes an embedded backslash", () => {
    expect(pgrstQuoteValue("a\\b")).toBe('"a\\\\b"');
  });

  it("escapes backslash before quote so a trailing escape cannot break out", () => {
    // Input: backslash then quote. Backslash doubled first, then quote
    // escaped -> the quote can never terminate the wrapper early.
    expect(pgrstQuoteValue('\\"')).toBe('"\\\\\\""');
  });

  it("handles an injection-style payload literally", () => {
    const evil = '",or(is_deleted.eq.false))--';
    const out = pgrstQuoteValue(evil);
    // Leading `"` is escaped so it cannot close the wrapper early.
    expect(out.startsWith('"\\"')).toBe(true);
    expect(out.endsWith('"')).toBe(true);
  });

  // --- M1 KNOWN GAP (intentional: recording current behaviour) ---

  it("M1 GAP: LIKE wildcard '%' is NOT escaped (current behaviour, not a fix)", () => {
    // % survives verbatim inside the quotes. This helper only guards
    // PostgREST grammar, NOT LIKE semantics, so an ilike pattern can still
    // be widened by a literal %. Recorded, not corrected (M1).
    expect(pgrstQuoteValue("50%")).toBe('"50%"');
  });

  it("M1 GAP: LIKE wildcard '_' is NOT escaped (current behaviour, not a fix)", () => {
    expect(pgrstQuoteValue("a_b")).toBe('"a_b"');
  });
});
