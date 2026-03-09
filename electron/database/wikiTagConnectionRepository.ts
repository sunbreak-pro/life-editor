import type Database from "better-sqlite3";
import type { WikiTagConnection } from "../types";

interface WikiTagConnectionRow {
  id: string;
  source_tag_id: string;
  target_tag_id: string;
  created_at: string;
}

function rowToConnection(row: WikiTagConnectionRow): WikiTagConnection {
  return {
    id: row.id,
    sourceTagId: row.source_tag_id,
    targetTagId: row.target_tag_id,
    createdAt: row.created_at,
  };
}

export function createWikiTagConnectionRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM wiki_tag_connections ORDER BY created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM wiki_tag_connections WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO wiki_tag_connections (id, source_tag_id, target_tag_id, created_at)
      VALUES (@id, @source_tag_id, @target_tag_id, @created_at)
    `),
    delete: db.prepare(`DELETE FROM wiki_tag_connections WHERE id = ?`),
    deleteByTagPair: db.prepare(`
      DELETE FROM wiki_tag_connections
      WHERE (source_tag_id = @source AND target_tag_id = @target)
         OR (source_tag_id = @target AND target_tag_id = @source)
    `),
  };

  return {
    fetchAll(): WikiTagConnection[] {
      return (stmts.fetchAll.all() as WikiTagConnectionRow[]).map(
        rowToConnection,
      );
    },

    create(sourceTagId: string, targetTagId: string): WikiTagConnection {
      const now = new Date().toISOString();
      const id = `wtc-${crypto.randomUUID()}`;
      stmts.insert.run({
        id,
        source_tag_id: sourceTagId,
        target_tag_id: targetTagId,
        created_at: now,
      });
      const row = stmts.fetchById.get(id) as WikiTagConnectionRow;
      return rowToConnection(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    deleteByTagPair(sourceTagId: string, targetTagId: string): void {
      stmts.deleteByTagPair.run({
        source: sourceTagId,
        target: targetTagId,
      });
    },
  };
}

export type WikiTagConnectionRepository = ReturnType<
  typeof createWikiTagConnectionRepository
>;
