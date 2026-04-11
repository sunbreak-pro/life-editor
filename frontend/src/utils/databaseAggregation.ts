import type { AggregationType, PropertyType } from "../types/database";

export function getAvailableAggregations(
  propertyType: PropertyType,
): AggregationType[] {
  switch (propertyType) {
    case "number":
      return ["none", "sum", "count", "countValues", "avg", "min", "max"];
    case "checkbox":
      return ["none", "count", "countChecked", "countUnchecked"];
    case "date":
      return ["none", "count", "countValues", "min", "max"];
    case "text":
    case "select":
    default:
      return ["none", "count", "countValues"];
  }
}

export function computeAggregation(
  aggregation: AggregationType,
  propertyType: PropertyType,
  values: string[],
): string {
  if (aggregation === "none") return "";

  switch (aggregation) {
    case "count":
      return String(values.length);

    case "countValues":
      return String(values.filter((v) => v !== "").length);

    case "countChecked":
      return String(values.filter((v) => v === "true").length);

    case "countUnchecked":
      return String(values.filter((v) => v !== "true").length);

    case "sum": {
      const nums = values.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
      return String(nums.reduce((a, b) => a + b, 0));
    }

    case "avg": {
      const nums = values.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
      if (nums.length === 0) return "-";
      return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
    }

    case "min": {
      if (propertyType === "date") {
        const dates = values.filter((v) => v !== "").sort();
        return dates.length > 0 ? dates[0] : "-";
      }
      const nums = values.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
      return nums.length > 0 ? String(Math.min(...nums)) : "-";
    }

    case "max": {
      if (propertyType === "date") {
        const dates = values.filter((v) => v !== "").sort();
        return dates.length > 0 ? dates[dates.length - 1] : "-";
      }
      const nums = values.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
      return nums.length > 0 ? String(Math.max(...nums)) : "-";
    }

    default:
      return "";
  }
}
