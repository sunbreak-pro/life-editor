import type Database from "better-sqlite3";
import type {
  DatabaseEntity,
  DatabaseProperty,
  DatabaseRow,
  DatabaseCell,
  PropertyType,
} from "../types";

interface DbRow {
  id: string;
  title: string;
  is_deleted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PropRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  order_index: number;
  config_json: string;
  created_at: string;
}

interface RowRow {
  id: string;
  database_id: string;
  order_index: number;
  created_at: string;
}

interface CellRow {
  id: string;
  row_id: string;
  property_id: string;
  value: string;
}

function dbRowToEntity(row: DbRow): DatabaseEntity {
  return {
    id: row.id,
    title: row.title,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function propRowToProperty(row: PropRow): DatabaseProperty {
  let config: DatabaseProperty["config"] = {};
  try {
    config = JSON.parse(row.config_json);
  } catch (e) {
    console.warn(`[Database] Invalid config_json for property ${row.id}:`, e);
  }
  return {
    id: row.id,
    databaseId: row.database_id,
    name: row.name,
    type: row.type as PropertyType,
    order: row.order_index,
    config,
    createdAt: row.created_at,
  };
}

function rowRowToRow(row: RowRow): DatabaseRow {
  return {
    id: row.id,
    databaseId: row.database_id,
    order: row.order_index,
    createdAt: row.created_at,
  };
}

function cellRowToCell(row: CellRow): DatabaseCell {
  return {
    id: row.id,
    rowId: row.row_id,
    propertyId: row.property_id,
    value: row.value,
  };
}

export function createDatabaseRepository(db: Database.Database) {
  const stmts = {
    // Database CRUD
    fetchAll: db.prepare(
      `SELECT * FROM databases WHERE is_deleted = 0 ORDER BY updated_at DESC`,
    ),
    fetchById: db.prepare(`SELECT * FROM databases WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO databases (id, title, is_deleted, created_at, updated_at)
      VALUES (@id, @title, 0, datetime('now'), datetime('now'))
    `),
    updateDb: db.prepare(`
      UPDATE databases SET title = @title, updated_at = datetime('now')
      WHERE id = @id
    `),
    softDelete: db.prepare(`
      UPDATE databases SET is_deleted = 1, deleted_at = datetime('now')
      WHERE id = @id
    `),
    permanentDelete: db.prepare(`DELETE FROM databases WHERE id = ?`),

    // Properties
    fetchProperties: db.prepare(
      `SELECT * FROM database_properties WHERE database_id = ? ORDER BY order_index ASC`,
    ),
    insertProperty: db.prepare(`
      INSERT INTO database_properties (id, database_id, name, type, order_index, config_json, created_at)
      VALUES (@id, @databaseId, @name, @type, @orderIndex, @configJson, datetime('now'))
    `),
    updateProperty: db.prepare(`
      UPDATE database_properties SET name = @name, type = @type, order_index = @orderIndex, config_json = @configJson
      WHERE id = @id
    `),
    deleteProperty: db.prepare(`DELETE FROM database_properties WHERE id = ?`),

    // Rows
    fetchRows: db.prepare(
      `SELECT * FROM database_rows WHERE database_id = ? ORDER BY order_index ASC`,
    ),
    insertRow: db.prepare(`
      INSERT INTO database_rows (id, database_id, order_index, created_at)
      VALUES (@id, @databaseId, @orderIndex, datetime('now'))
    `),
    updateRowOrder: db.prepare(`
      UPDATE database_rows SET order_index = @orderIndex WHERE id = @id
    `),
    deleteRow: db.prepare(`DELETE FROM database_rows WHERE id = ?`),

    // Cells
    fetchCells: db.prepare(`
      SELECT c.* FROM database_cells c
      JOIN database_rows r ON c.row_id = r.id
      WHERE r.database_id = ?
    `),
    upsertCell: db.prepare(`
      INSERT INTO database_cells (id, row_id, property_id, value)
      VALUES (@id, @rowId, @propertyId, @value)
      ON CONFLICT(row_id, property_id) DO UPDATE SET value = @value
    `),
    deleteCell: db.prepare(`DELETE FROM database_cells WHERE id = ?`),
  };

  return {
    // Database
    fetchAll(): DatabaseEntity[] {
      return (stmts.fetchAll.all() as DbRow[]).map(dbRowToEntity);
    },

    fetchById(id: string): DatabaseEntity | undefined {
      const row = stmts.fetchById.get(id) as DbRow | undefined;
      return row ? dbRowToEntity(row) : undefined;
    },

    create(id: string, title: string): DatabaseEntity {
      stmts.insert.run({ id, title });
      return dbRowToEntity(stmts.fetchById.get(id) as DbRow);
    },

    update(id: string, title: string): DatabaseEntity {
      stmts.updateDb.run({ id, title });
      return dbRowToEntity(stmts.fetchById.get(id) as DbRow);
    },

    softDelete(id: string): void {
      stmts.softDelete.run({ id });
    },

    permanentDelete(id: string): void {
      stmts.permanentDelete.run(id);
    },

    // Full fetch
    fetchFull(id: string):
      | {
          database: DatabaseEntity;
          properties: DatabaseProperty[];
          rows: DatabaseRow[];
          cells: DatabaseCell[];
        }
      | undefined {
      const dbRow = stmts.fetchById.get(id) as DbRow | undefined;
      if (!dbRow) return undefined;
      return {
        database: dbRowToEntity(dbRow),
        properties: (stmts.fetchProperties.all(id) as PropRow[]).map(
          propRowToProperty,
        ),
        rows: (stmts.fetchRows.all(id) as RowRow[]).map(rowRowToRow),
        cells: (stmts.fetchCells.all(id) as CellRow[]).map(cellRowToCell),
      };
    },

    // Properties
    addProperty(
      id: string,
      databaseId: string,
      name: string,
      type: PropertyType,
      order: number,
      config: DatabaseProperty["config"],
    ): DatabaseProperty {
      stmts.insertProperty.run({
        id,
        databaseId,
        name,
        type,
        orderIndex: order,
        configJson: JSON.stringify(config),
      });
      return {
        id,
        databaseId,
        name,
        type,
        order,
        config,
        createdAt: new Date().toISOString(),
      };
    },

    updateProperty(
      id: string,
      updates: {
        name?: string;
        type?: PropertyType;
        order?: number;
        config?: DatabaseProperty["config"];
      },
    ): void {
      const current = db
        .prepare(`SELECT * FROM database_properties WHERE id = ?`)
        .get(id) as PropRow | undefined;
      if (!current) return;
      stmts.updateProperty.run({
        id,
        name: updates.name ?? current.name,
        type: updates.type ?? current.type,
        orderIndex: updates.order ?? current.order_index,
        configJson:
          updates.config !== undefined
            ? JSON.stringify(updates.config)
            : current.config_json,
      });
    },

    removeProperty(id: string): void {
      stmts.deleteProperty.run(id);
    },

    // Rows
    addRow(id: string, databaseId: string, order: number): DatabaseRow {
      stmts.insertRow.run({ id, databaseId, orderIndex: order });
      return {
        id,
        databaseId,
        order,
        createdAt: new Date().toISOString(),
      };
    },

    removeRow(id: string): void {
      stmts.deleteRow.run(id);
    },

    // Cells
    upsertCell(
      id: string,
      rowId: string,
      propertyId: string,
      value: string,
    ): DatabaseCell {
      stmts.upsertCell.run({ id, rowId, propertyId, value });
      return { id, rowId, propertyId, value };
    },
  };
}

export type DatabaseRepository = ReturnType<typeof createDatabaseRepository>;
