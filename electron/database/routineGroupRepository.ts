import type Database from "better-sqlite3";
import type { RoutineGroup, FrequencyType } from "../types";

interface RoutineGroupRow {
  id: string;
  name: string;
  color: string;
  is_visible: number;
  order: number;
  frequency_type: string;
  frequency_days: string;
  frequency_interval: number | null;
  frequency_start_date: string | null;
  created_at: string;
  updated_at: string;
}

function rowToGroup(row: RoutineGroupRow): RoutineGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isVisible: row.is_visible === 1,
    order: row.order,
    frequencyType: (row.frequency_type as FrequencyType) ?? "daily",
    frequencyDays: JSON.parse(row.frequency_days || "[]") as number[],
    frequencyInterval: row.frequency_interval,
    frequencyStartDate: row.frequency_start_date,
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
      INSERT INTO routine_groups (id, name, color, is_visible, "order",
        frequency_type, frequency_days, frequency_interval, frequency_start_date,
        created_at, updated_at)
      VALUES (@id, @name, @color, 1, @order,
        @frequency_type, @frequency_days, @frequency_interval, @frequency_start_date,
        datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routine_groups SET name = @name, color = @color, is_visible = @is_visible, "order" = @order,
      frequency_type = @frequency_type, frequency_days = @frequency_days,
      frequency_interval = @frequency_interval, frequency_start_date = @frequency_start_date,
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

    create(
      id: string,
      name: string,
      color: string,
      frequencyType?: FrequencyType,
      frequencyDays?: number[],
      frequencyInterval?: number | null,
      frequencyStartDate?: string | null,
    ): RoutineGroup {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({
        id,
        name,
        color,
        order: maxOrder + 1,
        frequency_type: frequencyType ?? "daily",
        frequency_days: JSON.stringify(frequencyDays ?? []),
        frequency_interval: frequencyInterval ?? null,
        frequency_start_date: frequencyStartDate ?? null,
      });
      const row = stmts.fetchById.get(id) as RoutineGroupRow;
      return rowToGroup(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<
          RoutineGroup,
          | "name"
          | "color"
          | "isVisible"
          | "order"
          | "frequencyType"
          | "frequencyDays"
          | "frequencyInterval"
          | "frequencyStartDate"
        >
      >,
    ): RoutineGroup {
      const existing = stmts.fetchById.get(id) as RoutineGroupRow | undefined;
      if (!existing) throw new Error(`RoutineGroup not found: ${id}`);
      const current = rowToGroup(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        color: updates.color ?? current.color,
        is_visible: (updates.isVisible ?? current.isVisible) ? 1 : 0,
        order: updates.order ?? current.order,
        frequency_type: updates.frequencyType ?? current.frequencyType,
        frequency_days: JSON.stringify(
          updates.frequencyDays ?? current.frequencyDays,
        ),
        frequency_interval:
          updates.frequencyInterval !== undefined
            ? updates.frequencyInterval
            : current.frequencyInterval,
        frequency_start_date:
          updates.frequencyStartDate !== undefined
            ? updates.frequencyStartDate
            : current.frequencyStartDate,
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
