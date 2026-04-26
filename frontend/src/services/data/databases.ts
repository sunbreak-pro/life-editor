import type {
  DatabaseCell,
  DatabaseEntity,
  DatabaseFull,
  DatabaseProperty,
  DatabaseRow,
  PropertyType,
} from "../../types/database";
import { tauriInvoke } from "../bridge";

export const databasesApi = {
  fetchAllDatabases(): Promise<DatabaseEntity[]> {
    return tauriInvoke("db_database_fetch_all");
  },
  fetchDatabaseFull(id: string): Promise<DatabaseFull | undefined> {
    return tauriInvoke("db_database_fetch_full", { id });
  },
  createDatabase(id: string, title: string): Promise<DatabaseEntity> {
    return tauriInvoke("db_database_create", { id, title });
  },
  updateDatabase(id: string, title: string): Promise<DatabaseEntity> {
    return tauriInvoke("db_database_update", { id, title });
  },
  softDeleteDatabase(id: string): Promise<void> {
    return tauriInvoke("db_database_soft_delete", { id });
  },
  permanentDeleteDatabase(id: string): Promise<void> {
    return tauriInvoke("db_database_permanent_delete", { id });
  },
  addDatabaseProperty(
    id: string,
    databaseId: string,
    name: string,
    type: PropertyType,
    order: number,
    config: DatabaseProperty["config"],
  ): Promise<DatabaseProperty> {
    return tauriInvoke("db_database_add_property", {
      id,
      databaseId,
      name,
      propertyType: type,
      order,
      config,
    });
  },
  updateDatabaseProperty(
    id: string,
    updates: {
      name?: string;
      type?: PropertyType;
      order?: number;
      config?: DatabaseProperty["config"];
    },
  ): Promise<void> {
    return tauriInvoke("db_database_update_property", { id, updates });
  },
  removeDatabaseProperty(id: string): Promise<void> {
    return tauriInvoke("db_database_remove_property", { id });
  },
  addDatabaseRow(
    id: string,
    databaseId: string,
    order: number,
  ): Promise<DatabaseRow> {
    return tauriInvoke("db_database_add_row", {
      id,
      databaseId,
      order,
    });
  },
  reorderDatabaseRows(rowIds: string[]): Promise<void> {
    return tauriInvoke("db_database_reorder_rows", { rowIds });
  },
  removeDatabaseRow(id: string): Promise<void> {
    return tauriInvoke("db_database_remove_row", { id });
  },
  upsertDatabaseCell(
    id: string,
    rowId: string,
    propertyId: string,
    value: string,
  ): Promise<DatabaseCell> {
    return tauriInvoke("db_database_upsert_cell", {
      id,
      rowId,
      propertyId,
      value,
    });
  },
};
