import type Database from "better-sqlite3";
import type { WikiTag, WikiTagAssignment } from "../types";

interface WikiTagRow {
  id: string;
  name: string;
  color: string;
  text_color: string | null;
  created_at: string;
  updated_at: string;
}

interface WikiTagAssignmentRow {
  tag_id: string;
  entity_id: string;
  entity_type: string;
  source: string;
  created_at: string;
}

function rowToTag(row: WikiTagRow): WikiTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    textColor: row.text_color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAssignment(row: WikiTagAssignmentRow): WikiTagAssignment {
  return {
    tagId: row.tag_id,
    entityId: row.entity_id,
    entityType: row.entity_type as WikiTagAssignment["entityType"],
    source: row.source as WikiTagAssignment["source"],
    createdAt: row.created_at,
  };
}

export function createWikiTagRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(`SELECT * FROM wiki_tags ORDER BY name ASC`),
    fetchById: db.prepare(`SELECT * FROM wiki_tags WHERE id = ?`),
    fetchByName: db.prepare(`SELECT * FROM wiki_tags WHERE name = ?`),
    search: db.prepare(
      `SELECT * FROM wiki_tags WHERE name LIKE '%' || ? || '%' ORDER BY name ASC`,
    ),
    insert: db.prepare(`
      INSERT INTO wiki_tags (id, name, color, created_at, updated_at)
      VALUES (@id, @name, @color, @created_at, @updated_at)
    `),
    insertOrReplace: db.prepare(`
      INSERT OR REPLACE INTO wiki_tags (id, name, color, created_at, updated_at)
      VALUES (@id, @name, @color, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE wiki_tags SET name = @name, color = @color, text_color = @text_color, updated_at = @updated_at
      WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM wiki_tags WHERE id = ?`),
    // Assignment statements
    fetchTagsForEntity: db.prepare(`
      SELECT wt.* FROM wiki_tags wt
      INNER JOIN wiki_tag_assignments wta ON wt.id = wta.tag_id
      WHERE wta.entity_id = ?
      ORDER BY wt.name ASC
    `),
    fetchAssignmentsForEntity: db.prepare(`
      SELECT * FROM wiki_tag_assignments WHERE entity_id = ?
    `),
    deleteAssignmentsForEntity: db.prepare(
      `DELETE FROM wiki_tag_assignments WHERE entity_id = ?`,
    ),
    deleteInlineAssignmentsForEntity: db.prepare(
      `DELETE FROM wiki_tag_assignments WHERE entity_id = ? AND source = 'inline'`,
    ),
    insertAssignment: db.prepare(`
      INSERT OR IGNORE INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at)
      VALUES (@tag_id, @entity_id, @entity_type, @source, @created_at)
    `),
    fetchAllAssignments: db.prepare(`SELECT * FROM wiki_tag_assignments`),
    // For merge
    updateAssignmentTagId: db.prepare(`
      UPDATE OR IGNORE wiki_tag_assignments SET tag_id = @new_tag_id WHERE tag_id = @old_tag_id
    `),
    deleteAssignmentsByTag: db.prepare(
      `DELETE FROM wiki_tag_assignments WHERE tag_id = ?`,
    ),
  };

  return {
    fetchAll(): WikiTag[] {
      return (stmts.fetchAll.all() as WikiTagRow[]).map(rowToTag);
    },

    search(query: string): WikiTag[] {
      return (stmts.search.all(query) as WikiTagRow[]).map(rowToTag);
    },

    createWithId(id: string, name: string, color: string): WikiTag {
      const now = new Date().toISOString();
      stmts.insertOrReplace.run({
        id,
        name,
        color,
        created_at: now,
        updated_at: now,
      });
      const row = stmts.fetchById.get(id) as WikiTagRow;
      return rowToTag(row);
    },

    create(name: string, color: string): WikiTag {
      const now = new Date().toISOString();
      const id = `tag-${crypto.randomUUID()}`;
      stmts.insert.run({
        id,
        name,
        color,
        created_at: now,
        updated_at: now,
      });
      const row = stmts.fetchById.get(id) as WikiTagRow;
      return rowToTag(row);
    },

    update(
      id: string,
      updates: Partial<Pick<WikiTag, "name" | "color" | "textColor">>,
    ): WikiTag {
      const existing = stmts.fetchById.get(id) as WikiTagRow | undefined;
      if (!existing) throw new Error(`WikiTag not found: ${id}`);
      const now = new Date().toISOString();
      stmts.update.run({
        id,
        name: updates.name ?? existing.name,
        color: updates.color ?? existing.color,
        text_color:
          "textColor" in updates
            ? (updates.textColor ?? null)
            : existing.text_color,
        updated_at: now,
      });
      const row = stmts.fetchById.get(id) as WikiTagRow;
      return rowToTag(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    merge(sourceId: string, targetId: string): WikiTag {
      const target = stmts.fetchById.get(targetId) as WikiTagRow | undefined;
      if (!target) throw new Error(`Target WikiTag not found: ${targetId}`);

      const doMerge = db.transaction(() => {
        // Move assignments from source to target (ignore duplicates)
        stmts.updateAssignmentTagId.run({
          new_tag_id: targetId,
          old_tag_id: sourceId,
        });
        // Clean up any remaining source assignments (duplicates that couldn't be moved)
        stmts.deleteAssignmentsByTag.run(sourceId);
        // Delete the source tag
        stmts.delete.run(sourceId);
      });
      doMerge();

      return rowToTag(stmts.fetchById.get(targetId) as WikiTagRow);
    },

    fetchTagsForEntity(entityId: string): WikiTag[] {
      return (stmts.fetchTagsForEntity.all(entityId) as WikiTagRow[]).map(
        rowToTag,
      );
    },

    setTagsForEntity(
      entityId: string,
      entityType: string,
      tagIds: string[],
    ): void {
      const setTags = db.transaction(() => {
        stmts.deleteAssignmentsForEntity.run(entityId);
        const now = new Date().toISOString();
        for (const tagId of tagIds) {
          stmts.insertAssignment.run({
            tag_id: tagId,
            entity_id: entityId,
            entity_type: entityType,
            source: "manual",
            created_at: now,
          });
        }
      });
      setTags();
    },

    syncInlineTags(
      entityId: string,
      entityType: string,
      tagNames: string[],
    ): void {
      const sync = db.transaction(() => {
        // Remove old inline assignments for this entity
        stmts.deleteInlineAssignmentsForEntity.run(entityId);

        const now = new Date().toISOString();
        for (const name of tagNames) {
          // Find or create the tag
          let tag = stmts.fetchByName.get(name) as WikiTagRow | undefined;
          if (!tag) {
            const id = `tag-${crypto.randomUUID()}`;
            stmts.insert.run({
              id,
              name,
              color: "#808080",
              created_at: now,
              updated_at: now,
            });
            tag = stmts.fetchById.get(id) as WikiTagRow;
          }
          // Create inline assignment
          stmts.insertAssignment.run({
            tag_id: tag.id,
            entity_id: entityId,
            entity_type: entityType,
            source: "inline",
            created_at: now,
          });
        }
      });
      sync();
    },

    fetchAllAssignments(): WikiTagAssignment[] {
      return (stmts.fetchAllAssignments.all() as WikiTagAssignmentRow[]).map(
        rowToAssignment,
      );
    },

    restoreAssignment(
      tagId: string,
      entityId: string,
      entityType: string,
      source: string,
    ): void {
      const now = new Date().toISOString();
      stmts.insertAssignment.run({
        tag_id: tagId,
        entity_id: entityId,
        entity_type: entityType,
        source,
        created_at: now,
      });
    },
  };
}

export type WikiTagRepository = ReturnType<typeof createWikiTagRepository>;
