import type Database from "better-sqlite3";
import type { RoutineGroup } from "../types";

interface RoutineGroupRow {
  id: string;
  name: string;
  color: string;
  order: number;
  created_at: string;
  updated_at: string;
}

function rowToGroup(row: RoutineGroupRow): RoutineGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRoutineGroupRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routine_groups ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM routine_groups WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routine_groups (id, name, color, "order", created_at, updated_at)
      VALUES (@id, @name, @color, @order, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routine_groups SET name = @name, color = @color, "order" = @order,
      updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routine_groups WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routine_groups`,
    ),
    // Junction table statements
    fetchAllTagAssignments: db.prepare(
      `SELECT group_id, tag_id FROM routine_group_tag_assignments`,
    ),
    deleteTagsForGroup: db.prepare(
      `DELETE FROM routine_group_tag_assignments WHERE group_id = ?`,
    ),
    insertTagAssignment: db.prepare(
      `INSERT OR IGNORE INTO routine_group_tag_assignments (group_id, tag_id) VALUES (@group_id, @tag_id)`,
    ),
  };

  return {
    fetchAll(): RoutineGroup[] {
      return (stmts.fetchAll.all() as RoutineGroupRow[]).map(rowToGroup);
    },

    create(id: string, name: string, color: string): RoutineGroup {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({
        id,
        name,
        color,
        order: maxOrder + 1,
      });
      const row = stmts.fetchById.get(id) as RoutineGroupRow;
      return rowToGroup(row);
    },

    update(
      id: string,
      updates: Partial<Pick<RoutineGroup, "name" | "color" | "order">>,
    ): RoutineGroup {
      const existing = stmts.fetchById.get(id) as RoutineGroupRow | undefined;
      if (!existing) throw new Error(`RoutineGroup not found: ${id}`);
      const current = rowToGroup(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        color: updates.color ?? current.color,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as RoutineGroupRow;
      return rowToGroup(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    fetchAllTagAssignments(): Array<{ group_id: string; tag_id: number }> {
      return stmts.fetchAllTagAssignments.all() as Array<{
        group_id: string;
        tag_id: number;
      }>;
    },

    setTagsForGroup(groupId: string, tagIds: number[]): void {
      const setTags = db.transaction(() => {
        stmts.deleteTagsForGroup.run(groupId);
        for (const tagId of tagIds) {
          stmts.insertTagAssignment.run({
            group_id: groupId,
            tag_id: tagId,
          });
        }
      });
      setTags();
    },
  };
}

export type RoutineGroupRepository = ReturnType<
  typeof createRoutineGroupRepository
>;
