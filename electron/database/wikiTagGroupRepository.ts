import type Database from "better-sqlite3";
import type { WikiTagGroup, WikiTagGroupMember } from "../types";

interface WikiTagGroupRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface WikiTagGroupMemberRow {
  group_id: string;
  tag_id: string;
}

function rowToGroup(row: WikiTagGroupRow): WikiTagGroup {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: WikiTagGroupMemberRow): WikiTagGroupMember {
  return {
    groupId: row.group_id,
    tagId: row.tag_id,
  };
}

export function createWikiTagGroupRepository(db: Database.Database) {
  const stmts = {
    fetchAll: db.prepare(
      `SELECT * FROM wiki_tag_groups ORDER BY created_at ASC`,
    ),
    fetchById: db.prepare(`SELECT * FROM wiki_tag_groups WHERE id = ?`),
    insert: db.prepare(`
      INSERT INTO wiki_tag_groups (id, name, created_at, updated_at)
      VALUES (@id, @name, @created_at, @updated_at)
    `),
    update: db.prepare(`
      UPDATE wiki_tag_groups SET name = @name, updated_at = @updated_at WHERE id = @id
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
      INSERT OR IGNORE INTO wiki_tag_group_members (group_id, tag_id)
      VALUES (@group_id, @tag_id)
    `),
    deleteMember: db.prepare(`
      DELETE FROM wiki_tag_group_members WHERE group_id = @group_id AND tag_id = @tag_id
    `),
  };

  const setMembersTransaction = db.transaction(
    (groupId: string, tagIds: string[]) => {
      stmts.deleteMembers.run(groupId);
      for (const tagId of tagIds) {
        stmts.insertMember.run({ group_id: groupId, tag_id: tagId });
      }
    },
  );

  const createTransaction = db.transaction(
    (name: string, tagIds: string[]): WikiTagGroup => {
      const now = new Date().toISOString();
      const id = `wtg-${crypto.randomUUID()}`;
      stmts.insert.run({ id, name, created_at: now, updated_at: now });
      for (const tagId of tagIds) {
        stmts.insertMember.run({ group_id: id, tag_id: tagId });
      }
      const row = stmts.fetchById.get(id) as WikiTagGroupRow;
      return rowToGroup(row);
    },
  );

  return {
    fetchAll(): WikiTagGroup[] {
      return (stmts.fetchAll.all() as WikiTagGroupRow[]).map(rowToGroup);
    },

    create(name: string, tagIds: string[]): WikiTagGroup {
      return createTransaction(name, tagIds);
    },

    update(id: string, updates: { name: string }): WikiTagGroup {
      const now = new Date().toISOString();
      stmts.update.run({ id, name: updates.name, updated_at: now });
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

    setMembers(groupId: string, tagIds: string[]): void {
      setMembersTransaction(groupId, tagIds);
    },

    addMember(groupId: string, tagId: string): void {
      stmts.insertMember.run({ group_id: groupId, tag_id: tagId });
    },

    removeMember(groupId: string, tagId: string): void {
      stmts.deleteMember.run({ group_id: groupId, tag_id: tagId });
    },
  };
}

export type WikiTagGroupRepository = ReturnType<
  typeof createWikiTagGroupRepository
>;
