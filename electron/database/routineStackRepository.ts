import type Database from "better-sqlite3";
import type { RoutineStack, RoutineStackItem } from "../types";

interface StackRow {
  id: string;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
}

interface StackItemRow {
  id: number;
  stack_id: string;
  routine_id: string;
  position: number;
}

function rowToStack(row: StackRow): RoutineStack {
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    items: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToItem(row: StackItemRow): RoutineStackItem {
  return {
    id: row.id,
    stackId: row.stack_id,
    routineId: row.routine_id,
    position: row.position,
  };
}

export function createRoutineStackRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM routine_stacks ORDER BY "order" ASC, created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM routine_stacks WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO routine_stacks (id, name, "order", created_at, updated_at)
      VALUES (@id, @name, @order, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE routine_stacks SET name = @name, "order" = @order, updated_at = datetime('now')
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM routine_stacks WHERE id = ?`),
    maxOrder: db.prepare(
      `SELECT COALESCE(MAX("order"), -1) as max_order FROM routine_stacks`,
    ),
    // Items
    fetchItems: db.prepare(
      `SELECT * FROM routine_stack_items WHERE stack_id = ? ORDER BY position ASC`,
    ),
    fetchAllItems: db.prepare(
      `SELECT * FROM routine_stack_items ORDER BY stack_id, position ASC`,
    ),
    addItem: db.prepare(`
      INSERT OR IGNORE INTO routine_stack_items (stack_id, routine_id, position)
      VALUES (@stack_id, @routine_id, @position)
    `),
    removeItem: db.prepare(
      `DELETE FROM routine_stack_items WHERE stack_id = ? AND routine_id = ?`,
    ),
    clearItems: db.prepare(
      `DELETE FROM routine_stack_items WHERE stack_id = ?`,
    ),
    maxPosition: db.prepare(
      `SELECT COALESCE(MAX(position), -1) as max_pos FROM routine_stack_items WHERE stack_id = ?`,
    ),
  };

  return {
    fetchAll(): RoutineStack[] {
      const stacks = (stmts.fetchAll.all() as StackRow[]).map(rowToStack);
      const allItems = stmts.fetchAllItems.all() as StackItemRow[];
      const itemMap = new Map<string, RoutineStackItem[]>();
      for (const item of allItems) {
        const list = itemMap.get(item.stack_id) ?? [];
        list.push(rowToItem(item));
        itemMap.set(item.stack_id, list);
      }
      for (const stack of stacks) {
        stack.items = itemMap.get(stack.id) ?? [];
      }
      return stacks;
    },

    create(id: string, name: string): RoutineStack {
      const maxOrder = (stmts.maxOrder.get() as { max_order: number })
        .max_order;
      stmts.insert.run({ id, name, order: maxOrder + 1 });
      const row = stmts.fetchById.get(id) as StackRow;
      return rowToStack(row);
    },

    update(
      id: string,
      updates: Partial<Pick<RoutineStack, "name" | "order">>,
    ): RoutineStack {
      const existing = stmts.fetchById.get(id) as StackRow | undefined;
      if (!existing) throw new Error(`Stack not found: ${id}`);
      const current = rowToStack(existing);
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        order: updates.order ?? current.order,
      });
      const row = stmts.fetchById.get(id) as StackRow;
      const stack = rowToStack(row);
      stack.items = (stmts.fetchItems.all(id) as StackItemRow[]).map(rowToItem);
      return stack;
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    addItem(stackId: string, routineId: string): void {
      const maxPos = (stmts.maxPosition.get(stackId) as { max_pos: number })
        .max_pos;
      stmts.addItem.run({
        stack_id: stackId,
        routine_id: routineId,
        position: maxPos + 1,
      });
    },

    removeItem(stackId: string, routineId: string): void {
      stmts.removeItem.run(stackId, routineId);
    },

    reorderItems(stackId: string, routineIds: string[]): void {
      const reorder = db.transaction(() => {
        stmts.clearItems.run(stackId);
        for (let i = 0; i < routineIds.length; i++) {
          stmts.addItem.run({
            stack_id: stackId,
            routine_id: routineIds[i],
            position: i,
          });
        }
      });
      reorder();
    },
  };
}

export type RoutineStackRepository = ReturnType<
  typeof createRoutineStackRepository
>;
