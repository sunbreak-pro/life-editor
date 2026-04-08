import type { DatabaseCell } from "../types/database";

export function getCellValue(
  rowId: string,
  propertyId: string,
  cells: DatabaseCell[],
): string {
  return (
    cells.find((c) => c.rowId === rowId && c.propertyId === propertyId)
      ?.value ?? ""
  );
}
