import type Database from "better-sqlite3";
import type { RoutineTemplate, RoutineTemplateItem } from "../types";

interface TemplateRow {
  id: string;
  name: string;
  frequency_type: string;
  frequency_days: string;
  order: number;
  tag_id: number | null;
  created_at: string;
  updated_at: string;
}

interface TemplateItemRow {
  id: number;
  template_id: string;
  routine_id: string;
  position: number;
  start_time: string | null;
  end_time: string | null;
}

function rowToTemplate(row: TemplateRow): RoutineTemplate {
  return {
    id: row.id,
    name: row.name,
    frequencyType: row.frequency_type as RoutineTemplate["frequencyType"],
    frequencyDays: JSON.parse(row.frequency_days),
    order: row.order,
    tagId: row.tag_id,
    items: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToItem(row: TemplateItemRow): RoutineTemplateItem {
  return {
    id: row.id,
    templateId: row.template_id,
    routineId: row.routine_id,
    position: row.position,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export function createRoutineTemplateRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routine_templates ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM routine_templates WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routine_templates (id, name, frequency_type, frequency_days, "order", tag_id, created_at, updated_at)
      VALUES (@id, @name, @frequency_type, @frequency_days, @order, @tag_id, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routine_templates SET name = @name, frequency_type = @frequency_type,
      frequency_days = @frequency_days, "order" = @order, tag_id = @tag_id, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routine_templates WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routine_templates`,
    ),
    fetchItems: db.prepare(
      `SELECT * FROM routine_template_items WHERE template_id = ? ORDER BY position ASC`,
    ),
    fetchAllItems: db.prepare(
      `SELECT * FROM routine_template_items ORDER BY template_id, position ASC`,
    ),
    addItem: db.prepare(`
      INSERT OR IGNORE INTO routine_template_items (template_id, routine_id, position, start_time, end_time)
      VALUES (@template_id, @routine_id, @position, @start_time, @end_time)
    `),
    updateItem: db.prepare(`
      UPDATE routine_template_items SET start_time = @start_time, end_time = @end_time
      WHERE template_id = @template_id AND routine_id = @routine_id
    `),
    removeItem: db.prepare(
      `DELETE FROM routine_template_items WHERE template_id = ? AND routine_id = ?`,
    ),
    clearItems: db.prepare(
      `DELETE FROM routine_template_items WHERE template_id = ?`,
    ),
    maxPosition: db.prepare(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM routine_template_items WHERE template_id = ?`,
    ),
  };

  return {
    fetchAll(): RoutineTemplate[] {
      const templates = (stmts.fetchAll.all() as TemplateRow[]).map(
        rowToTemplate,
      );
      const allItems = stmts.fetchAllItems.all() as TemplateItemRow[];
      const itemMap = new Map<string, RoutineTemplateItem[]>();
      for (const item of allItems) {
        const list = itemMap.get(item.template_id) ?? [];
        list.push(rowToItem(item));
        itemMap.set(item.template_id, list);
      }
      for (const template of templates) {
        template.items = itemMap.get(template.id) ?? [];
      }
      return templates;
    },

    create(
      id: string,
      name: string,
      frequencyType: string = "daily",
      frequencyDays: number[] = [],
      tagId?: number | null,
    ): RoutineTemplate {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({
        id,
        name,
        frequency_type: frequencyType,
        frequency_days: JSON.stringify(frequencyDays),
        order: maxOrder + 1,
        tag_id: tagId ?? null,
      });
      const row = stmts.fetchById.get(id) as TemplateRow;
      return rowToTemplate(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<
          RoutineTemplate,
          "name" | "frequencyType" | "frequencyDays" | "order" | "tagId"
        >
      >,
    ): RoutineTemplate {
      const existing = stmts.fetchById.get(id) as TemplateRow | undefined;
      if (!existing) throw new Error(`Template not found: ${id}`);
      const current = rowToTemplate(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        frequency_type: updates.frequencyType ?? current.frequencyType,
        frequency_days: JSON.stringify(
          updates.frequencyDays ?? current.frequencyDays,
        ),
        order: updates.order ?? current.order,
        tag_id: updates.tagId !== undefined ? updates.tagId : current.tagId,
      });
      const row = stmts.fetchById.get(id) as TemplateRow;
      const template = rowToTemplate(row);
      template.items = (stmts.fetchItems.all(id) as TemplateItemRow[]).map(
        rowToItem,
      );
      return template;
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    addItem(
      templateId: string,
      routineId: string,
      startTime?: string | null,
      endTime?: string | null,
    ): void {
      const maxPos = (stmts.maxPosition.get(templateId) as { max_pos: number })
        .max_pos;
      stmts.addItem.run({
        template_id: templateId,
        routine_id: routineId,
        position: maxPos + 1,
        start_time: startTime ?? null,
        end_time: endTime ?? null,
      });
    },

    updateItem(
      templateId: string,
      routineId: string,
      updates: { startTime?: string | null; endTime?: string | null },
    ): void {
      stmts.updateItem.run({
        template_id: templateId,
        routine_id: routineId,
        start_time: updates.startTime ?? null,
        end_time: updates.endTime ?? null,
      });
    },

    removeItem(templateId: string, routineId: string): void {
      stmts.removeItem.run(templateId, routineId);
    },

    reorderItems(templateId: string, routineIds: string[]): void {
      const reorder = db.transaction(() => {
        // Preserve existing time data before clearing
        const existing = stmts.fetchItems.all(templateId) as TemplateItemRow[];
        const timeMap = new Map(
          existing.map((r) => [
            r.routine_id,
            { start_time: r.start_time, end_time: r.end_time },
          ]),
        );
        stmts.clearItems.run(templateId);
        for (let i = 0; i < routineIds.length; i++) {
          const times = timeMap.get(routineIds[i]);
          stmts.addItem.run({
            template_id: templateId,
            routine_id: routineIds[i],
            position: i,
            start_time: times?.start_time ?? null,
            end_time: times?.end_time ?? null,
          });
        }
      });
      reorder();
    },
  };
}

export type RoutineTemplateRepository = ReturnType<
  typeof createRoutineTemplateRepository
>;
