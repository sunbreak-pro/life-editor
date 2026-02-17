import type Database from "better-sqlite3";
import type { RoutineTag } from "../types";

interface RoutineTagRow {
  id: number;
  name: string;
  color: string;
  order: number;
}

function rowToTag(row: RoutineTagRow): RoutineTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order,
  };
}

export function createRoutineTagRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routine_tag_definitions ORDER BY "order" ASC, id ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM routine_tag_definitions WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routine_tag_definitions (name, color, "order")
      VALUES (@name, @color, @order)
    `),
    update: db.prepare(`
      UPDATE routine_tag_definitions SET name = @name, color = @color, "order" = @order
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routine_tag_definitions WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routine_tag_definitions`,
    ),
  };

  return {
    fetchAll(): RoutineTag[] {
      return (stmts.fetchAll.all() as RoutineTagRow[]).map(rowToTag);
    },

    create(name: string, color: string): RoutineTag {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      const result = stmts.insert.run({
        name,
        color,
        order: maxOrder + 1,
      });
      const row = stmts.fetchById.get(result.lastInsertRowid) as RoutineTagRow;
      return rowToTag(row);
    },

    update(
      id: number,
      updates: Partial<Pick<RoutineTag, "name" | "color" | "order">>,
    ): RoutineTag {
      const existing = stmts.fetchById.get(id) as RoutineTagRow | undefined;
      if (!existing) throw new Error(`RoutineTag not found: ${id}`);
      const current = rowToTag(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        color: updates.color ?? current.color,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as RoutineTagRow;
      return rowToTag(row);
    },

    delete(id: number): void {
      stmts.delete.run(id);
    },
  };
}

export type RoutineTagRepository = ReturnType<
  typeof createRoutineTagRepository
>;
