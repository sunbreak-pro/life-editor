import type Database from "better-sqlite3";
import type { RoutineTag } from "../types";

interface RoutineTagRow {
  id: number;
  name: string;
  color: string;
  text_color: string | null;
  order: number;
}

function rowToTag(row: RoutineTagRow): RoutineTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    textColor: row.text_color ?? undefined,
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
      UPDATE routine_tag_definitions SET name = @name, color = @color, text_color = @text_color, "order" = @order
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routine_tag_definitions WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routine_tag_definitions`,
    ),
    // Junction table statements
    fetchTagsForRoutine: db.prepare(`
      SELECT rtd.* FROM routine_tag_definitions rtd
      INNER JOIN routine_tag_assignments rta ON rtd.id = rta.tag_id
      WHERE rta.routine_id = ?
      ORDER BY rtd."order" ASC, rtd.id ASC
    `),
    deleteAssignmentsForRoutine: db.prepare(
      `DELETE FROM routine_tag_assignments WHERE routine_id = ?`,
    ),
    insertAssignment: db.prepare(
      `INSERT OR IGNORE INTO routine_tag_assignments (routine_id, tag_id) VALUES (@routine_id, @tag_id)`,
    ),
    fetchAllAssignments: db.prepare(
      `SELECT routine_id, tag_id FROM routine_tag_assignments`,
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
      updates: Partial<
        Pick<RoutineTag, "name" | "color" | "textColor" | "order">
      >,
    ): RoutineTag {
      const existing = stmts.fetchById.get(id) as RoutineTagRow | undefined;
      if (!existing) throw new Error(`RoutineTag not found: ${id}`);
      const current = rowToTag(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        color: updates.color ?? current.color,
        text_color:
          "textColor" in updates
            ? (updates.textColor ?? null)
            : existing.text_color,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as RoutineTagRow;
      return rowToTag(row);
    },

    delete(id: number): void {
      stmts.delete.run(id);
    },

    fetchTagsForRoutine(routineId: string): RoutineTag[] {
      return (stmts.fetchTagsForRoutine.all(routineId) as RoutineTagRow[]).map(
        rowToTag,
      );
    },

    setTagsForRoutine(routineId: string, tagIds: number[]): void {
      const setTags = db.transaction(() => {
        stmts.deleteAssignmentsForRoutine.run(routineId);
        for (const tagId of tagIds) {
          stmts.insertAssignment.run({
            routine_id: routineId,
            tag_id: tagId,
          });
        }
      });
      setTags();
    },

    fetchAllAssignments(): Array<{ routine_id: string; tag_id: number }> {
      return stmts.fetchAllAssignments.all() as Array<{
        routine_id: string;
        tag_id: number;
      }>;
    },
  };
}

export type RoutineTagRepository = ReturnType<
  typeof createRoutineTagRepository
>;
