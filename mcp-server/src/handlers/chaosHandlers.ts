import { getDb } from "../db.js";

interface OracleRow {
  entity_id: string;
  entity_type: "memo" | "note";
  title: string;
  content: string;
  created_at: string;
}

interface TimeCapsuleRow {
  entity_id: string;
  entity_type: "memo" | "note";
  title: string;
  content: string;
  created_at: string;
  days_ago: number;
}

function extractPreview(content: string, maxLen = 120): string {
  try {
    const parsed = JSON.parse(content);
    const texts: string[] = [];
    function walk(node: unknown): void {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (typeof n.text === "string") texts.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
    }
    walk(parsed);
    const joined = texts.join(" ").trim();
    return joined.length > maxLen ? joined.slice(0, maxLen) + "…" : joined;
  } catch {
    const plain =
      typeof content === "string" ? content.replace(/<[^>]+>/g, "") : "";
    return plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
  }
}

export function getOracle(_args: Record<string, unknown>) {
  const db = getDb();

  const row = db
    .prepare(
      `
    WITH candidates AS (
      SELECT
        id AS entity_id, 'memo' AS entity_type, date AS title, content, created_at,
        CAST(julianday('now') - julianday(created_at) AS REAL) AS age_days,
        LENGTH(content) AS content_len
      FROM memos WHERE is_deleted = 0 AND julianday('now') - julianday(created_at) >= 7

      UNION ALL

      SELECT
        id AS entity_id, 'note' AS entity_type, title, content, created_at,
        CAST(julianday('now') - julianday(created_at) AS REAL) AS age_days,
        LENGTH(content) AS content_len
      FROM notes WHERE is_deleted = 0 AND julianday('now') - julianday(created_at) >= 7
    ),
    scored AS (
      SELECT entity_id, entity_type, title, content, created_at,
        MIN(age_days / 30.0, 10.0)
        * MIN(content_len / 200.0, 3.0)
        AS score
      FROM candidates
    )
    SELECT entity_id, entity_type, title, content, created_at
    FROM scored WHERE score > 0
    ORDER BY score * (0.5 + ABS(RANDOM()) / CAST(9223372036854775807 AS REAL)) DESC
    LIMIT 1
  `,
    )
    .get() as OracleRow | undefined;

  if (!row) return { message: "No data available yet" };

  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    title: row.title,
    preview: extractPreview(row.content),
    createdAt: row.created_at,
  };
}

export function getTimeCapsules(args: { date?: string }) {
  const db = getDb();
  const today = args.date ?? new Date().toISOString().split("T")[0];

  const rows = db
    .prepare(
      `
    SELECT entity_id, entity_type, title, content, created_at, days_ago FROM (
      SELECT id AS entity_id, 'memo' AS entity_type, date AS title, content, created_at,
        CAST(julianday(@today) - julianday(date) AS INTEGER) AS days_ago
      FROM memos WHERE is_deleted = 0 AND strftime('%m-%d', date) = strftime('%m-%d', @today) AND date < @today

      UNION ALL

      SELECT id AS entity_id, 'note' AS entity_type, title, content, created_at,
        CAST(julianday(@today) - julianday(created_at) AS INTEGER) AS days_ago
      FROM notes WHERE is_deleted = 0 AND strftime('%m-%d', created_at) = strftime('%m-%d', @today) AND DATE(created_at) < @today
    )
    ORDER BY days_ago ASC
  `,
    )
    .all({ today }) as TimeCapsuleRow[];

  const intervals = [7, 30, 90, 365, 730];
  const filtered = rows.filter((r) =>
    intervals.some((i) => Math.abs(r.days_ago - i) <= 1),
  );

  return filtered.map((row) => ({
    entityId: row.entity_id,
    entityType: row.entity_type,
    title: row.title,
    preview: extractPreview(row.content),
    createdAt: row.created_at,
    daysAgo: row.days_ago,
  }));
}

export function discoverConnection(_args: Record<string, unknown>) {
  const db = getDb();

  // Step 1: Random origin
  const origin = db
    .prepare(
      `
    SELECT entity_id, entity_type, title FROM (
      SELECT id AS entity_id, 'memo' AS entity_type, date AS title FROM memos WHERE is_deleted = 0
      UNION ALL
      SELECT id AS entity_id, 'note' AS entity_type, title FROM notes WHERE is_deleted = 0
    ) ORDER BY RANDOM() LIMIT 1
  `,
    )
    .get() as
    | { entity_id: string; entity_type: string; title: string }
    | undefined;

  if (!origin) return { message: "No data available" };

  // Step 2: Tags for origin
  const tags = db
    .prepare(
      `SELECT wt.id AS tag_id, wt.name AS tag_name
     FROM wiki_tag_assignments wta JOIN wiki_tags wt ON wt.id = wta.tag_id
     WHERE wta.entity_id = ?`,
    )
    .all(origin.entity_id) as Array<{ tag_id: string; tag_name: string }>;

  if (tags.length === 0) return { message: "No tags found on origin", origin };

  // Step 3: 2-hop traversal
  for (const tag1 of tags) {
    const hopEntities = db
      .prepare(
        `SELECT wta.entity_id, wta.entity_type,
          CASE WHEN wta.entity_type = 'memo' THEN (SELECT date FROM memos WHERE id = wta.entity_id)
               WHEN wta.entity_type = 'note' THEN (SELECT title FROM notes WHERE id = wta.entity_id) END AS title
        FROM wiki_tag_assignments wta
        WHERE wta.tag_id = ? AND wta.entity_id != ? AND wta.entity_type IN ('memo', 'note')
        ORDER BY RANDOM() LIMIT 5`,
      )
      .all(tag1.tag_id, origin.entity_id) as Array<{
      entity_id: string;
      entity_type: string;
      title: string;
    }>;

    for (const hop of hopEntities) {
      const tag2List = db
        .prepare(
          `SELECT wt.id AS tag_id, wt.name AS tag_name
         FROM wiki_tag_assignments wta JOIN wiki_tags wt ON wt.id = wta.tag_id
         WHERE wta.entity_id = ? AND wta.tag_id != ?
         ORDER BY RANDOM() LIMIT 3`,
        )
        .all(hop.entity_id, tag1.tag_id) as Array<{
        tag_id: string;
        tag_name: string;
      }>;

      for (const tag2 of tag2List) {
        const dest = db
          .prepare(
            `SELECT wta.entity_id, wta.entity_type,
              CASE WHEN wta.entity_type = 'memo' THEN (SELECT date FROM memos WHERE id = wta.entity_id)
                   WHEN wta.entity_type = 'note' THEN (SELECT title FROM notes WHERE id = wta.entity_id) END AS title
            FROM wiki_tag_assignments wta
            WHERE wta.tag_id = ? AND wta.entity_id != ? AND wta.entity_id != ?
              AND wta.entity_type IN ('memo', 'note')
            ORDER BY RANDOM() LIMIT 1`,
          )
          .get(tag2.tag_id, hop.entity_id, origin.entity_id) as
          | { entity_id: string; entity_type: string; title: string }
          | undefined;

        if (dest) {
          return {
            origin: {
              entityId: origin.entity_id,
              entityType: origin.entity_type,
              title: origin.title,
            },
            path: [
              { tagId: tag1.tag_id, tagName: tag1.tag_name },
              { tagId: tag2.tag_id, tagName: tag2.tag_name },
            ],
            destination: {
              entityId: dest.entity_id,
              entityType: dest.entity_type,
              title: dest.title,
            },
          };
        }
      }
    }
  }

  return { message: "No 2-hop connection found", origin };
}
