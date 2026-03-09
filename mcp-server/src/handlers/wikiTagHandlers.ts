import { getDb } from "../db.js";

interface WikiTagRow {
  id: string;
  name: string;
  color: string;
  text_color: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  tag_id: string;
  entity_id: string;
  entity_type: string;
  source: string;
  created_at: string;
}

function formatTag(row: WikiTagRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    textColor: row.text_color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWikiTags(args: { query?: string }) {
  const db = getDb();
  let rows: WikiTagRow[];
  if (args.query) {
    rows = db
      .prepare(
        `SELECT * FROM wiki_tags WHERE name LIKE '%' || ? || '%' ORDER BY name ASC`,
      )
      .all(args.query) as WikiTagRow[];
  } else {
    rows = db
      .prepare(`SELECT * FROM wiki_tags ORDER BY name ASC`)
      .all() as WikiTagRow[];
  }

  // Include assignment counts
  const countStmt = db.prepare(
    `SELECT COUNT(*) as count FROM wiki_tag_assignments WHERE tag_id = ?`,
  );

  return rows.map((row) => ({
    ...formatTag(row),
    usageCount: (countStmt.get(row.id) as { count: number }).count,
  }));
}

export function tagEntity(args: {
  tag_name: string;
  entity_id: string;
  entity_type: string;
}) {
  const db = getDb();
  const now = new Date().toISOString();

  // Find or create tag
  let tag = db
    .prepare(`SELECT * FROM wiki_tags WHERE name = ?`)
    .get(args.tag_name) as WikiTagRow | undefined;

  if (!tag) {
    const id = `tag-${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO wiki_tags (id, name, color, created_at, updated_at) VALUES (?, ?, '#808080', ?, ?)`,
    ).run(id, args.tag_name, now, now);
    tag = db
      .prepare(`SELECT * FROM wiki_tags WHERE id = ?`)
      .get(id) as WikiTagRow;
  }

  // Create assignment
  db.prepare(
    `INSERT OR IGNORE INTO wiki_tag_assignments (tag_id, entity_id, entity_type, source, created_at) VALUES (?, ?, ?, 'manual', ?)`,
  ).run(tag.id, args.entity_id, args.entity_type, now);

  return {
    tag: formatTag(tag),
    entityId: args.entity_id,
    entityType: args.entity_type,
  };
}

export function searchByTag(args: { tag_name: string; entity_type?: string }) {
  const db = getDb();

  // Find the tag
  const tag = db
    .prepare(`SELECT * FROM wiki_tags WHERE name = ?`)
    .get(args.tag_name) as WikiTagRow | undefined;

  if (!tag) {
    return { tag: null, results: [] };
  }

  // Get assignments
  let assignments: AssignmentRow[];
  if (args.entity_type) {
    assignments = db
      .prepare(
        `SELECT * FROM wiki_tag_assignments WHERE tag_id = ? AND entity_type = ?`,
      )
      .all(tag.id, args.entity_type) as AssignmentRow[];
  } else {
    assignments = db
      .prepare(`SELECT * FROM wiki_tag_assignments WHERE tag_id = ?`)
      .all(tag.id) as AssignmentRow[];
  }

  // Resolve entities
  const results = assignments.map((a) => {
    let entity: Record<string, unknown> | null = null;

    if (a.entity_type === "task") {
      const row = db
        .prepare(
          `SELECT id, title, status, scheduled_at FROM tasks WHERE id = ? AND is_deleted = 0`,
        )
        .get(a.entity_id) as Record<string, unknown> | undefined;
      entity = row ?? null;
    } else if (a.entity_type === "note") {
      const row = db
        .prepare(
          `SELECT id, title, created_at FROM notes WHERE id = ? AND is_deleted = 0`,
        )
        .get(a.entity_id) as Record<string, unknown> | undefined;
      entity = row ?? null;
    } else if (a.entity_type === "memo") {
      const row = db
        .prepare(
          `SELECT id, date, created_at FROM memos WHERE id = ? AND is_deleted = 0`,
        )
        .get(a.entity_id) as Record<string, unknown> | undefined;
      entity = row ?? null;
    }

    return {
      entityId: a.entity_id,
      entityType: a.entity_type,
      source: a.source,
      entity,
    };
  });

  return {
    tag: formatTag(tag),
    results: results.filter((r) => r.entity !== null),
  };
}
