import type Database from "better-sqlite3";
import type { Template } from "../types";
import { prepareSoftDeleteStatements } from "./repositoryHelpers";

interface TemplateRow {
  id: string;
  name: string;
  content: string;
  is_deleted: number;
  deleted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTemplateRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM templates WHERE is_deleted = 0 ORDER BY created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM templates WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO templates (id, name, content, is_deleted, created_at, updated_at)
      VALUES (@id, @name, '', 0, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE templates
      SET name = COALESCE(@name, name),
          content = COALESCE(@content, content),
          version = version + 1,
          updated_at = datetime('now')
      WHERE id = @id
    `),
    ...prepareSoftDeleteStatements(db, "templates"),
  };

  return {
    fetchAll(): Template[] {
      return (stmts.fetchAll.all() as TemplateRow[]).map(rowToNode);
    },

    fetchById(id: string): Template | undefined {
      const row = stmts.fetchById.get(id) as TemplateRow | undefined;
      return row ? rowToNode(row) : undefined;
    },

    create(id: string, name: string): Template {
      stmts.insert.run({ id, name });
      const row = stmts.fetchById.get(id) as TemplateRow;
      return rowToNode(row);
    },

    update(id: string, updates: { name?: string; content?: string }): Template {
      stmts.update.run({
        id,
        name: updates.name ?? null,
        content: updates.content ?? null,
      });
      const row = stmts.fetchById.get(id) as TemplateRow;
      return rowToNode(row);
    },

    softDelete(id: string): void {
      stmts.softDelete.run(id);
    },

    restore(id: string): void {
      stmts.restore.run(id);
    },

    permanentDelete(id: string): void {
      stmts.permanentDelete.run(id);
    },
  };
}

export type TemplateRepository = ReturnType<typeof createTemplateRepository>;
