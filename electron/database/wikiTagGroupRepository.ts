import type Database from "better-sqlite3";
import type { WikiTagGroup, WikiTagGroupMember } from "../types";

interface WikiTagGroupRow {
  id: string;
  name: string;
  filter_tags: string;
  created_at: string;
  updated_at: string;
}

interface WikiTagGroupMemberRow {
  group_id: string;
  note_id: string;
}

function rowToGroup(row: WikiTagGroupRow): WikiTagGroup {
  return {
    id: row.id,
    name: row.name,
    filterTags: JSON.parse(row.filter_tags || "[]"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: WikiTagGroupMemberRow): WikiTagGroupMember {
  return {
    groupId: row.group_id,
    noteId: row.note_id,
  };
}

export function createWikiTagGroupRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM wiki_tag_groups ORDER BY created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM wiki_tag_groups WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO wiki_tag_groups (id, name, filter_tags, created_at, updated_at)
      VALUES (@id, @name, @filter_tags, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE wiki_tag_groups SET name = @name, filter_tags = @filter_tags, updated_at = @updated_at WHERE id = @id
    `),
    delete: db.prepare(`DELETE FROM wiki_tag_groups WHERE id = ?`),
    fetchAllMembers: db.prepare(
      `SELECT * FROM wiki_tag_group_members ORDER BY group_id`,
    ),
    fetchMembersByGroup: db.prepare(
      `SELECT * FROM wiki_tag_group_members WHERE group_id = ?`,
    ),
    deleteMembers: db.prepare(
      `DELETE FROM wiki_tag_group_members WHERE group_id = ?`,
    ),
    insertMember: db.prepare(`
      INSERT OR IGNORE INTO wiki_tag_group_members (group_id, note_id)
      VALUES (@group_id, @note_id)
    `),
    deleteMember: db.prepare(`
      DELETE FROM wiki_tag_group_members WHERE group_id = @group_id AND note_id = @note_id
    `),
  };

  const setMembersTransaction = db.transaction(
    (groupId: string, noteIds: string[]) => {
      stmts.deleteMembers.run(groupId);
      for (const noteId of noteIds) {
        stmts.insertMember.run({ group_id: groupId, note_id: noteId });
      }
    },
  );

  const createTransaction = db.transaction(
    (name: string, noteIds: string[], filterTags: string[]): WikiTagGroup => {
      const now = new Date().toISOString();
      const id = `wtg-${crypto.randomUUID()}`;
      stmts.insert.run({
        id,
        name,
        filter_tags: JSON.stringify(filterTags),
        created_at: now,
        updated_at: now,
      });
      for (const noteId of noteIds) {
        stmts.insertMember.run({ group_id: id, note_id: noteId });
      }
      const row = stmts.fetchById.get(id) as WikiTagGroupRow;
      return rowToGroup(row);
    },
  );

  return {
    fetchAll(): WikiTagGroup[] {
      return (stmts.fetchAll.all() as WikiTagGroupRow[]).map(rowToGroup);
    },

    create(
      name: string,
      noteIds: string[],
      filterTags: string[] = [],
    ): WikiTagGroup {
      return createTransaction(name, noteIds, filterTags);
    },

    update(
      id: string,
      updates: { name?: string; filterTags?: string[] },
    ): WikiTagGroup {
      const now = new Date().toISOString();
      const current = stmts.fetchById.get(id) as WikiTagGroupRow;
      stmts.update.run({
        id,
        name: updates.name ?? current.name,
        filter_tags: updates.filterTags
          ? JSON.stringify(updates.filterTags)
          : current.filter_tags,
        updated_at: now,
      });
      const row = stmts.fetchById.get(id) as WikiTagGroupRow;
      return rowToGroup(row);
    },

    delete(id: string): void {
      stmts.delete.run(id);
    },

    fetchAllMembers(): WikiTagGroupMember[] {
      return (stmts.fetchAllMembers.all() as WikiTagGroupMemberRow[]).map(
        rowToMember,
      );
    },

    setMembers(groupId: string, noteIds: string[]): void {
      setMembersTransaction(groupId, noteIds);
    },

    addMember(groupId: string, noteId: string): void {
      stmts.insertMember.run({ group_id: groupId, note_id: noteId });
    },

    removeMember(groupId: string, noteId: string): void {
      stmts.deleteMember.run({ group_id: groupId, note_id: noteId });
    },
  };
}

export type WikiTagGroupRepository = ReturnType<
  typeof createWikiTagGroupRepository
>;
