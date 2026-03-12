import type Database from "better-sqlite3";
import type { NoteConnection } from "../types";

interface NoteConnectionRow {
  id: string;
  source_note_id: string;
  target_note_id: string;
  created_at: string;
}

function rowToConnection(row: NoteConnectionRow): NoteConnection {
  return {
    id: row.id,
    sourceNoteId: row.source_note_id,
    targetNoteId: row.target_note_id,
    createdAt: row.created_at,
  };
}

export function createNoteConnectionRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM note_connections ORDER BY created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM note_connections WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO note_connections (id, source_note_id, target_note_id, created_at)
      VALUES (@id, @source_note_id, @target_note_id, @created_at)
    `),
    delete: db.prepare(`DELETE FROM note_connections WHERE id = ?`),
    deleteByNotePair: db.prepare(`
      DELETE FROM note_connections
      WHERE (source_note_id = @source AND target_note_id = @target)
         OR (source_note_id = @target AND target_note_id = @source)
    `),
  };

  return {
    fetchAll(): NoteConnection[] {
      return (stmts.fetchAll.all() as NoteConnectionRow[]).map(rowToConnection);
    },

    create(sourceNoteId: string, targetNoteId: string): NoteConnection {
      const now = new Date().toISOString();
      const id = `nc-${crypto.randomUUID()}`;
      stmts.insert.run({
        id,
        source_note_id: sourceNoteId,
        target_note_id: targetNoteId,
        created_at: now,
      });
      const row = stmts.fetchById.get(id) as NoteConnectionRow;
      return rowToConnection(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    deleteByNotePair(sourceNoteId: string, targetNoteId: string): void {
      stmts.deleteByNotePair.run({
        source: sourceNoteId,
        target: targetNoteId,
      });
    },
  };
}

export type NoteConnectionRepository = ReturnType<
  typeof createNoteConnectionRepository
>;
