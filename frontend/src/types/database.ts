export type PropertyType = "text" | "number" | "select" | "date" | "checkbox";

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface DatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  order: number;
  config: {
    options?: SelectOption[];
  };
  createdAt: string;
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  order: number;
  createdAt: string;
}

export interface DatabaseCell {
  id: string;
  rowId: string;
  propertyId: string;
  value: string;
}

export interface DatabaseEntity {
  id: string;
  title: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseFull {
  database: DatabaseEntity;
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: DatabaseCell[];
}

// Filter & Sort
export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "greater_than"
  | "less_than"
  | "is_checked"
  | "is_not_checked"
  | "before"
  | "after";

export interface DatabaseFilter {
  id: string;
  propertyId: string;
  operator: FilterOperator;
  value: string;
}

export type SortDirection = "asc" | "desc";

export interface DatabaseSort {
  propertyId: string;
  direction: SortDirection;
}
