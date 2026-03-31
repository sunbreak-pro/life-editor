import type Database from "better-sqlite3";
import type { CalendarTag } from "../types";

interface CalendarTagRow {
  id: number;
  name: string;
  color: string;
  text_color: string | null;
  order: number;
}

function rowToTag(row: CalendarTagRow): CalendarTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    textColor: row.text_color ?? undefined,
    order: row.order,
  };
}

export function createCalendarTagRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM calendar_tag_definitions ORDER BY "order" ASC, id ASC`,
    ),
    fetchById: db.prepare(
      `SELECT * FROM calendar_tag_definitions WHERE id = ?`,
    ),
    insert: db.prepare(`
      INSERT INTO calendar_tag_definitions (name, color, "order")
      VALUES (@name, @color, @order)
    `),
    update: db.prepare(`
      UPDATE calendar_tag_definitions SET name = @name, color = @color, text_color = @text_color, "order" = @order
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM calendar_tag_definitions WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM calendar_tag_definitions`,
    ),
    fetchTagsForScheduleItem: db.prepare(`
      SELECT ctd.* FROM calendar_tag_definitions ctd
      INNER JOIN calendar_tag_assignments cta ON ctd.id = cta.tag_id
      WHERE cta.schedule_item_id = ?
      ORDER BY ctd."order" ASC, ctd.id ASC
    `),
    deleteAssignmentsForScheduleItem: db.prepare(
      `DELETE FROM calendar_tag_assignments WHERE schedule_item_id = ?`,
    ),
    insertAssignment: db.prepare(
      `INSERT OR IGNORE INTO calendar_tag_assignments (schedule_item_id, tag_id) VALUES (@schedule_item_id, @tag_id)`,
    ),
    fetchAllAssignments: db.prepare(
      `SELECT schedule_item_id, tag_id FROM calendar_tag_assignments`,
    ),
  };

  return {
    fetchAll(): CalendarTag[] {
      return (stmts.fetchAll.all() as CalendarTagRow[]).map(rowToTag);
    },

    create(name: string, color: string): CalendarTag {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      const result = stmts.insert.run({
        name,
        color,
        order: maxOrder + 1,
      });
      const row = stmts.fetchById.get(result.lastInsertRowid) as CalendarTagRow;
      return rowToTag(row);
    },

    update(
      id: number,
      updates: Partial<
        Pick<CalendarTag, "name" | "color" | "textColor" | "order">
      >,
    ): CalendarTag {
      const existing = stmts.fetchById.get(id) as CalendarTagRow | undefined;
      if (!existing) throw new Error(`CalendarTag not found: ${id}`);
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
      const row = stmts.fetchById.get(id) as CalendarTagRow;
      return rowToTag(row);
    },

    delete(id: number): void {
      stmts.delete.run(id);
    },

    fetchTagsForScheduleItem(scheduleItemId: string): CalendarTag[] {
      return (
        stmts.fetchTagsForScheduleItem.all(scheduleItemId) as CalendarTagRow[]
      ).map(rowToTag);
    },

    setTagsForScheduleItem(scheduleItemId: string, tagIds: number[]): void {
      const setTags = db.transaction(() => {
        stmts.deleteAssignmentsForScheduleItem.run(scheduleItemId);
        for (const tagId of tagIds) {
          stmts.insertAssignment.run({
            schedule_item_id: scheduleItemId,
            tag_id: tagId,
          });
        }
      });
      setTags();
    },

    fetchAllAssignments(): Array<{
      schedule_item_id: string;
      tag_id: number;
    }> {
      return stmts.fetchAllAssignments.all() as Array<{
        schedule_item_id: string;
        tag_id: number;
      }>;
    },
  };
}

export type CalendarTagRepository = ReturnType<
  typeof createCalendarTagRepository
>;
