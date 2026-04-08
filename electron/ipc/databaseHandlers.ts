import { query, mutation } from "./handlerUtil";
import type { DatabaseRepository } from "../database/databaseRepository";
import type { PropertyType, DatabaseProperty } from "../types";

const VALID_PROPERTY_TYPES: PropertyType[] = [
  "text",
  "number",
  "select",
  "date",
  "checkbox",
];

function validatePropertyFields(fields: {
  name?: string;
  type?: PropertyType;
  order?: number;
  config?: DatabaseProperty["config"];
}): void {
  if (fields.name !== undefined) {
    if (
      typeof fields.name !== "string" ||
      fields.name.length === 0 ||
      fields.name.length > 255
    )
      throw new Error("name must be 1-255 characters");
  }
  if (fields.type !== undefined) {
    if (!VALID_PROPERTY_TYPES.includes(fields.type))
      throw new Error("invalid property type");
  }
  if (fields.order !== undefined) {
    if (
      typeof fields.order !== "number" ||
      fields.order < 0 ||
      !Number.isInteger(fields.order)
    )
      throw new Error("order must be a non-negative integer");
  }
  if (fields.config !== undefined && fields.config !== null) {
    if (typeof fields.config !== "object" || Array.isArray(fields.config))
      throw new Error("config must be a plain object or null");
  }
}

export function registerDatabaseHandlers(repo: DatabaseRepository): void {
  // Database CRUD
  query("db:database:fetchAll", "Database", "fetchAll", () => repo.fetchAll());

  query(
    "db:database:fetchFull",
    "Database",
    "fetchFull",
    (_event, id: string) => repo.fetchFull(id),
  );

  mutation(
    "db:database:create",
    "Database",
    "create",
    "database",
    "create",
    (_event, id: string, title: string) => repo.create(id, title),
  );

  mutation(
    "db:database:update",
    "Database",
    "update",
    "database",
    "update",
    (_event, id: string, title: string) => repo.update(id, title),
  );

  mutation(
    "db:database:softDelete",
    "Database",
    "softDelete",
    "database",
    "delete",
    (_event, id: string) => repo.softDelete(id),
  );

  mutation(
    "db:database:permanentDelete",
    "Database",
    "permanentDelete",
    "database",
    "delete",
    (_event, id: string) => repo.permanentDelete(id),
  );

  // Properties
  mutation(
    "db:database:addProperty",
    "Database",
    "addProperty",
    "database",
    "update",
    (
      _event,
      id: string,
      databaseId: string,
      name: string,
      type: PropertyType,
      order: number,
      config: DatabaseProperty["config"],
    ) => {
      validatePropertyFields({ name, type, order, config });
      return repo.addProperty(id, databaseId, name, type, order, config);
    },
  );

  mutation(
    "db:database:updateProperty",
    "Database",
    "updateProperty",
    "database",
    "update",
    (
      _event,
      id: string,
      updates: {
        name?: string;
        type?: PropertyType;
        order?: number;
        config?: DatabaseProperty["config"];
      },
    ) => {
      validatePropertyFields(updates);
      return repo.updateProperty(id, updates);
    },
  );

  mutation(
    "db:database:removeProperty",
    "Database",
    "removeProperty",
    "database",
    "update",
    (_event, id: string) => repo.removeProperty(id),
  );

  // Rows
  mutation(
    "db:database:addRow",
    "Database",
    "addRow",
    "database",
    "update",
    (_event, id: string, databaseId: string, order: number) =>
      repo.addRow(id, databaseId, order),
  );

  mutation(
    "db:database:removeRow",
    "Database",
    "removeRow",
    "database",
    "update",
    (_event, id: string) => repo.removeRow(id),
  );

  // Cells
  mutation(
    "db:database:upsertCell",
    "Database",
    "upsertCell",
    "database",
    "update",
    (_event, id: string, rowId: string, propertyId: string, value: string) =>
      repo.upsertCell(id, rowId, propertyId, value),
  );
}
