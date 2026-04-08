import type Database from "better-sqlite3";
import type { NoteNode, NoteNodeType } from "../types";
import { prepareSoftDeleteStatements } from "./repositoryHelpers";

interface NoteRow {
  id: string;
  type: string;
  title: string;
  content: string;
  parent_id: string | null;
  order_index: number;
  is_pinned: number;
  is_deleted: number;
  deleted_at: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: NoteRow): NoteNode {
  return {
    id: row.id,
    type: (row.type ?? "note") as NoteNodeType,
    title: row.title,
    content: row.content,
    parentId: row.parent_id,
    order: row.order_index,
    isPinned: row.is_pinned === 1,
    isDeleted: row.is_deleted === 1,
    deletedAt: row.deleted_at ?? undefined,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createNoteRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM notes WHERE is_deleted = 0 ORDER BY order_index ASC, updated_at DESC`,
    ),
    ...prepareSoftDeleteStatements(db, "notes"),
    fetchById: db.prepare(`SELECT * FROM notes WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO notes (id, type, title, content, parent_id, order_index, is_pinned, is_deleted, created_at, updated_at)
      VALUES (@id, @type, @title, '', @parentId, @orderIndex, 0, 0, datetime('now'), datetime('now'))
    `),
    update: db.prepare(`
      UPDATE notes SET title = @title, content = @content, is_pinned = @isPinned, color = @color,
        version = version + 1, updated_at = datetime('now')
      WHERE id = @id
    `),
    search: db.prepare(`
      SELECT * FROM notes WHERE is_deleted = 0
      AND (title LIKE @query OR content LIKE @query)
      ORDER BY updated_at DESC
    `),
    syncTree: db.prepare(`
      UPDATE notes SET parent_id = @parentId, order_index = @order
      WHERE id = @id
    `),
  };

  return {
    fetchAll(): NoteNode[] {
      return (stmts.fetchAll.all() as NoteRow[]).map(rowToNode);
    },

    fetchById(id: string): NoteNode | undefined {
      const row = stmts.fetchById.get(id) as NoteRow | undefined;
      return row ? rowToNode(row) : undefined;
    },

    fetchDeleted(): NoteNode[] {
      return (stmts.fetchDeleted.all() as NoteRow[]).map(rowToNode);
    },

    create(id: string, title: string): NoteNode {
      stmts.insert.run({
        id,
        type: "note",
        title,
        parentId: null,
        orderIndex: 0,
      });
      const row = stmts.fetchById.get(id) as NoteRow;
      return rowToNode(row);
    },

    createFolder(id: string, title: string, parentId: string | null): NoteNode {
      stmts.insert.run({ id, type: "folder", title, parentId, orderIndex: 0 });
      const row = stmts.fetchById.get(id) as NoteRow;
      return rowToNode(row);
    },

    update(
      id: string,
      updates: Partial<
        Pick<NoteNode, "title" | "content" | "isPinned" | "color">
      >,
    ): NoteNode {
      const existing = stmts.fetchById.get(id) as NoteRow | undefined;
      if (!existing) throw new Error(`Note not found: ${id}`);
      const current = rowToNode(existing);
      stmts.update.run({
        id,
        title: updates.title ?? current.title,
        content: updates.content ?? current.content,
        isPinned: (updates.isPinned ?? current.isPinned) ? 1 : 0,
        color:
          updates.color !== undefined
            ? updates.color
            : (existing.color ?? null),
      });
      const row = stmts.fetchById.get(id) as NoteRow;
      return rowToNode(row);
    },

    syncTree(
      items: Array<{ id: string; parentId: string | null; order: number }>,
    ): void {
      const syncMany = db.transaction(() => {
        for (const item of items) {
          stmts.syncTree.run({
            id: item.id,
            parentId: item.parentId,
            order: item.order,
          });
        }
      });
      syncMany();
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

    search(query: string): NoteNode[] {
      return (stmts.search.all({ query: `%${query}%` }) as NoteRow[]).map(
        rowToNode,
      );
    },
  };
}

export type NoteRepository = ReturnType<typeof createNoteRepository>;
