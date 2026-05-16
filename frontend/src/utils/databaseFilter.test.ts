import { describe, it, expect } from "vitest";
import { applyFilters, getOperatorsForType } from "./databaseFilter";
import type {
  DatabaseProperty,
  DatabaseCell,
  DatabaseRow,
  DatabaseFilter,
  FilterOperator,
  PropertyType,
} from "../types/database";

// ---------------------------------------------------------------------------
// Characterization tests for the database filter engine.
//
// NOTE: `evaluateFilter` is NOT exported from databaseFilter.ts (it is a
// module-private helper). It is therefore exercised INDIRECTLY through
// `applyFilters`, which calls it per row/filter. All 11 operators and the
// per-type operator map are covered. Expectations describe ACTUAL behavior,
// including quirks:
//   - getCellValue returns "" for a missing cell, so null/absent cells are
//     evaluated as the empty string (is_empty -> true, contains -> false).
//   - greater_than / less_than parse with parseFloat; non-numeric -> false.
//   - before / after use Date(...).getTime(); unparseable dates -> false.
//   - An unknown operator falls through to `default: return true`.
//   - A filter referencing a missing propertyId passes the row (return true).
// ---------------------------------------------------------------------------

function prop(id: string, type: PropertyType): DatabaseProperty {
  return {
    id,
    databaseId: "db1",
    name: id,
    type,
    order: 0,
    config: {},
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

function row(id: string): DatabaseRow {
  return {
    id,
    databaseId: "db1",
    order: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

function cell(rowId: string, propertyId: string, value: string): DatabaseCell {
  return { id: `${rowId}:${propertyId}`, rowId, propertyId, value };
}

function filter(
  propertyId: string,
  operator: FilterOperator,
  value: string,
): DatabaseFilter {
  return { propertyId, operator, value } as DatabaseFilter;
}

const properties = [
  prop("p_text", "text"),
  prop("p_num", "number"),
  prop("p_sel", "select"),
  prop("p_date", "date"),
  prop("p_check", "checkbox"),
];

describe("applyFilters - passthrough cases", () => {
  it("returns all rows unchanged when there are no filters", () => {
    const rows = [row("r1"), row("r2")];
    expect(applyFilters(rows, [], properties, [])).toEqual(rows);
  });

  it("passes a row when the filter references a missing propertyId", () => {
    const rows = [row("r1")];
    const result = applyFilters(rows, [], properties, [
      filter("does_not_exist", "equals", "x"),
    ]);
    expect(result.map((r) => r.id)).toEqual(["r1"]);
  });

  it("passes every matched-property row when the operator is unknown (default: return true)", () => {
    // BEHAVIOR LOCK: evaluateFilter's switch has `default: return true`
    // (databaseFilter.ts:54-55). An operator outside FilterOperator (injected
    // here via a type escape) therefore makes the filter a no-op rather than
    // excluding rows. propertyId resolves and cells exist, so the only path
    // exercised is the unknown-operator fall-through. This pins the lenient
    // current behavior; it is not idealized into a strict reject.
    const rows = [row("r1"), row("r2")];
    const cells = [cell("r1", "p_text", "alpha"), cell("r2", "p_text", "beta")];
    const unknown = filter(
      "p_text",
      "totally_unknown_op" as unknown as FilterOperator,
      "alpha",
    );
    const out = applyFilters(rows, cells, properties, [unknown]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("applyFilters - text operators", () => {
  const rows = [row("r1"), row("r2"), row("r3")];
  const cells = [
    cell("r1", "p_text", "Hello World"),
    cell("r2", "p_text", "goodbye"),
    // r3 has no cell -> getCellValue returns ""
  ];

  it("equals", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "equals", "goodbye"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r2"]);
  });

  it("not_equals", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "not_equals", "goodbye"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("contains is case-insensitive", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "contains", "WORLD"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  it("not_contains", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "not_contains", "o"),
    ]);
    // "Hello World" has o, "goodbye" has o, "" has none
    expect(out.map((r) => r.id)).toEqual(["r3"]);
  });

  it("is_empty matches missing/empty cell", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "is_empty", ""),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r3"]);
  });

  it("is_not_empty", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "is_not_empty", ""),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("applyFilters - number operators", () => {
  const rows = [row("r1"), row("r2"), row("r3")];
  const cells = [
    cell("r1", "p_num", "10"),
    cell("r2", "p_num", "5"),
    cell("r3", "p_num", "not-a-number"),
  ];

  it("greater_than (numeric parse)", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_num", "greater_than", "7"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  it("less_than", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_num", "less_than", "7"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r2"]);
  });

  it("greater_than excludes non-numeric values (NaN -> false)", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_num", "greater_than", "0"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("comparison against a non-numeric filter value yields no matches", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_num", "greater_than", "abc"),
    ]);
    expect(out).toEqual([]);
  });
});

describe("applyFilters - select operators", () => {
  const rows = [row("r1"), row("r2")];
  const cells = [cell("r1", "p_sel", "optA"), cell("r2", "p_sel", "optB")];

  it("equals matches the selected value", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_sel", "equals", "optA"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  it("not_equals", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_sel", "not_equals", "optA"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r2"]);
  });
});

describe("applyFilters - date operators", () => {
  const rows = [row("r1"), row("r2"), row("r3")];
  const cells = [
    cell("r1", "p_date", "2025-01-01"),
    cell("r2", "p_date", "2025-12-31"),
    cell("r3", "p_date", "garbage"),
  ];

  it("before", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_date", "before", "2025-06-01"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  it("after", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_date", "after", "2025-06-01"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r2"]);
  });

  it("unparseable date is excluded (NaN getTime -> false)", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_date", "after", "2000-01-01"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("applyFilters - checkbox operators", () => {
  const rows = [row("r1"), row("r2"), row("r3")];
  const cells = [
    cell("r1", "p_check", "true"),
    cell("r2", "p_check", "false"),
    // r3 missing -> ""
  ];

  it("is_checked matches only the literal string 'true'", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_check", "is_checked", ""),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  it("is_not_checked matches anything that is not 'true' (incl. missing)", () => {
    const out = applyFilters(rows, cells, properties, [
      filter("p_check", "is_not_checked", ""),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r2", "r3"]);
  });
});

describe("applyFilters - combined (every() AND semantics)", () => {
  it("all filters must pass for a row to be included", () => {
    const rows = [row("r1"), row("r2")];
    const cells = [
      cell("r1", "p_text", "alpha"),
      cell("r1", "p_num", "9"),
      cell("r2", "p_text", "alpha"),
      cell("r2", "p_num", "1"),
    ];
    const out = applyFilters(rows, cells, properties, [
      filter("p_text", "equals", "alpha"),
      filter("p_num", "greater_than", "5"),
    ]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("getOperatorsForType", () => {
  it("text", () => {
    expect(getOperatorsForType("text")).toEqual([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "is_empty",
      "is_not_empty",
    ]);
  });

  it("number", () => {
    expect(getOperatorsForType("number")).toEqual([
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "is_empty",
      "is_not_empty",
    ]);
  });

  it("select", () => {
    expect(getOperatorsForType("select")).toEqual([
      "equals",
      "not_equals",
      "is_empty",
      "is_not_empty",
    ]);
  });

  it("date", () => {
    expect(getOperatorsForType("date")).toEqual([
      "equals",
      "before",
      "after",
      "is_empty",
      "is_not_empty",
    ]);
  });

  it("checkbox", () => {
    expect(getOperatorsForType("checkbox")).toEqual([
      "is_checked",
      "is_not_checked",
    ]);
  });

  it("unknown type falls back to the default operator set", () => {
    expect(getOperatorsForType("mystery" as unknown as PropertyType)).toEqual([
      "equals",
      "not_equals",
      "is_empty",
      "is_not_empty",
    ]);
  });
});
