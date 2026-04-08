import type {
  DatabaseSort,
  DatabaseProperty,
  DatabaseCell,
  DatabaseRow,
} from "../types/database";
import { getCellValue } from "./databaseCell";

function compareValues(a: string, b: string, type: string): number {
  if (type === "number") {
    const na = parseFloat(a) || 0;
    const nb = parseFloat(b) || 0;
    return na - nb;
  }
  if (type === "checkbox") {
    const ba = a === "true" ? 1 : 0;
    const bb = b === "true" ? 1 : 0;
    return ba - bb;
  }
  // text, date, select: lexicographic
  return a.localeCompare(b);
}

export function applySorts(
  rows: DatabaseRow[],
  cells: DatabaseCell[],
  properties: DatabaseProperty[],
  sorts: DatabaseSort[],
): DatabaseRow[] {
  if (sorts.length === 0) return rows;

  return [...rows].sort((rowA, rowB) => {
    for (const sort of sorts) {
      const prop = properties.find((p) => p.id === sort.propertyId);
      if (!prop) continue;
      const valA = getCellValue(rowA.id, sort.propertyId, cells);
      const valB = getCellValue(rowB.id, sort.propertyId, cells);
      const cmp = compareValues(valA, valB, prop.type);
      if (cmp !== 0) {
        return sort.direction === "asc" ? cmp : -cmp;
      }
    }
    return 0;
  });
}
