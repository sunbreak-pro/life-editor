import type {
  DatabaseFilter,
  DatabaseProperty,
  DatabaseCell,
  DatabaseRow,
  FilterOperator,
  PropertyType,
} from "../types/database";
import { getCellValue } from "./databaseCell";

function evaluateFilter(
  value: string,
  operator: FilterOperator,
  filterValue: string,
  _type: PropertyType,
): boolean {
  switch (operator) {
    case "equals":
      return value === filterValue;
    case "not_equals":
      return value !== filterValue;
    case "contains":
      return value.toLowerCase().includes(filterValue.toLowerCase());
    case "not_contains":
      return !value.toLowerCase().includes(filterValue.toLowerCase());
    case "is_empty":
      return value === "";
    case "is_not_empty":
      return value !== "";
    case "greater_than": {
      const a = parseFloat(value);
      const b = parseFloat(filterValue);
      return !isNaN(a) && !isNaN(b) && a > b;
    }
    case "less_than": {
      const a = parseFloat(value);
      const b = parseFloat(filterValue);
      return !isNaN(a) && !isNaN(b) && a < b;
    }
    case "is_checked":
      return value === "true";
    case "is_not_checked":
      return value !== "true";
    case "before": {
      const d1 = new Date(value).getTime();
      const d2 = new Date(filterValue).getTime();
      return !isNaN(d1) && !isNaN(d2) && d1 < d2;
    }
    case "after": {
      const d1 = new Date(value).getTime();
      const d2 = new Date(filterValue).getTime();
      return !isNaN(d1) && !isNaN(d2) && d1 > d2;
    }
    default:
      return true;
  }
}

export function applyFilters(
  rows: DatabaseRow[],
  cells: DatabaseCell[],
  properties: DatabaseProperty[],
  filters: DatabaseFilter[],
): DatabaseRow[] {
  if (filters.length === 0) return rows;

  return rows.filter((row) =>
    filters.every((filter) => {
      const prop = properties.find((p) => p.id === filter.propertyId);
      if (!prop) return true;
      const value = getCellValue(row.id, filter.propertyId, cells);
      return evaluateFilter(value, filter.operator, filter.value, prop.type);
    }),
  );
}

export function getOperatorsForType(type: PropertyType): FilterOperator[] {
  switch (type) {
    case "text":
      return [
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "is_empty",
        "is_not_empty",
      ];
    case "number":
      return [
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "is_empty",
        "is_not_empty",
      ];
    case "select":
      return ["equals", "not_equals", "is_empty", "is_not_empty"];
    case "date":
      return ["equals", "before", "after", "is_empty", "is_not_empty"];
    case "checkbox":
      return ["is_checked", "is_not_checked"];
    default:
      return ["equals", "not_equals", "is_empty", "is_not_empty"];
  }
}
