import type Database from "better-sqlite3";

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

interface DriftEntityRow {
  entity_id: string;
  entity_type: "memo" | "note";
  title: string;
}

interface DriftTagRow {
  tag_id: string;
  tag_name: string;
  entity_id: string;
  entity_type: string;
  title: string;
}

interface SettingRow {
  key: string;
  value: string;
}

interface DisplayLogRow {
  id: string;
  entity_id: string;
  entity_type: string;
  display_type: string;
  displayed_at: string;
  created_at: string;
}

function extractPreview(content: string, maxLen = 80): string {
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

export function createChaosRepository(db: Database.Database) {
  const stmts = {
    // Settings
    getSetting: db.prepare(`SELECT value FROM chaos_settings WHERE key = ?`),
    upsertSetting: db.prepare(`
      INSERT INTO chaos_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `),
    getAllSettings: db.prepare(`SELECT key, value FROM chaos_settings`),

    // Display log
    logDisplay: db.prepare(`
      INSERT INTO chaos_display_log (id, entity_id, entity_type, display_type, displayed_at, created_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `),
    recentDisplays: db.prepare(`
      SELECT entity_id FROM chaos_display_log
      WHERE display_type = 'oracle'
      ORDER BY displayed_at DESC
      LIMIT 20
    `),

    // Oracle: weighted random selection from memos + notes
    // This uses a CTE approach to compute weights in SQL
    oracleQuery: db.prepare(`
      WITH candidates AS (
        SELECT
          id AS entity_id,
          'memo' AS entity_type,
          date AS title,
          content,
          created_at,
          CAST(julianday('now') - julianday(created_at) AS REAL) AS age_days,
          LENGTH(content) AS content_len
        FROM memos
        WHERE is_deleted = 0
          AND julianday('now') - julianday(created_at) >= @min_age_days

        UNION ALL

        SELECT
          id AS entity_id,
          'note' AS entity_type,
          title,
          content,
          created_at,
          CAST(julianday('now') - julianday(created_at) AS REAL) AS age_days,
          LENGTH(content) AS content_len
        FROM notes
        WHERE is_deleted = 0
          AND julianday('now') - julianday(created_at) >= @min_age_days
      ),
      with_tags AS (
        SELECT
          c.*,
          CASE WHEN EXISTS (
            SELECT 1 FROM wiki_tag_assignments wta WHERE wta.entity_id = c.entity_id
          ) THEN 0.5 ELSE 0.0 END AS tag_bonus
        FROM candidates c
      ),
      scored AS (
        SELECT
          entity_id,
          entity_type,
          title,
          content,
          created_at,
          -- age_weight: min(daysSince / 30, 10)
          MIN(age_days / 30.0, 10.0)
          -- richness_weight: min(content_len / 200, 3.0) + tag_bonus
          * (MIN(content_len / 200.0, 3.0) + tag_bonus)
          -- freshness_penalty: recent displays reduce score
          * CASE
              WHEN entity_id IN (
                SELECT entity_id FROM chaos_display_log
                WHERE display_type = 'oracle' AND julianday('now') - julianday(displayed_at) < 7
              ) THEN 0.1
              WHEN entity_id IN (
                SELECT entity_id FROM chaos_display_log
                WHERE display_type = 'oracle' AND julianday('now') - julianday(displayed_at) < 30
              ) THEN 0.5
              ELSE 1.0
            END
          AS score
        FROM with_tags
      )
      SELECT entity_id, entity_type, title, content, created_at
      FROM scored
      WHERE score > 0
      ORDER BY score * (0.5 + ABS(RANDOM()) / CAST(9223372036854775807 AS REAL)) DESC
      LIMIT 1
    `),

    // Entity count for data insufficiency check
    entityCount: db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM memos WHERE is_deleted = 0) +
        (SELECT COUNT(*) FROM notes WHERE is_deleted = 0) AS total
    `),

    // Time capsule: find items created on this day in previous periods
    timeCapsuleQuery: db.prepare(`
      SELECT entity_id, entity_type, title, content, created_at, days_ago FROM (
        SELECT
          id AS entity_id,
          'memo' AS entity_type,
          date AS title,
          content,
          created_at,
          CAST(julianday(@today) - julianday(date) AS INTEGER) AS days_ago
        FROM memos
        WHERE is_deleted = 0
          AND strftime('%m-%d', date) = strftime('%m-%d', @today)
          AND date < @today

        UNION ALL

        SELECT
          id AS entity_id,
          'note' AS entity_type,
          title,
          content,
          created_at,
          CAST(julianday(@today) - julianday(created_at) AS INTEGER) AS days_ago
        FROM notes
        WHERE is_deleted = 0
          AND strftime('%m-%d', created_at) = strftime('%m-%d', @today)
          AND DATE(created_at) < @today
      )
      ORDER BY days_ago ASC
    `),

    // Drift: random start entity
    driftRandomEntity: db.prepare(`
      SELECT entity_id, entity_type, title FROM (
        SELECT id AS entity_id, 'memo' AS entity_type, date AS title
        FROM memos WHERE is_deleted = 0
        UNION ALL
        SELECT id AS entity_id, 'note' AS entity_type, title
        FROM notes WHERE is_deleted = 0
      )
      ORDER BY RANDOM()
      LIMIT 1
    `),

    // Drift: tags for an entity
    tagsForEntity: db.prepare(`
      SELECT wt.id AS tag_id, wt.name AS tag_name
      FROM wiki_tag_assignments wta
      JOIN wiki_tags wt ON wt.id = wta.tag_id
      WHERE wta.entity_id = ?
    `),

    // Drift: entities for a tag (excluding origin)
    entitiesForTag: db.prepare(`
      SELECT
        wta.entity_id,
        wta.entity_type,
        CASE
          WHEN wta.entity_type = 'memo' THEN (SELECT date FROM memos WHERE id = wta.entity_id)
          WHEN wta.entity_type = 'note' THEN (SELECT title FROM notes WHERE id = wta.entity_id)
        END AS title,
        wt.id AS tag_id,
        wt.name AS tag_name
      FROM wiki_tag_assignments wta
      JOIN wiki_tags wt ON wt.id = wta.tag_id
      WHERE wta.tag_id = ? AND wta.entity_id != ?
        AND wta.entity_type IN ('memo', 'note')
      ORDER BY RANDOM()
      LIMIT 5
    `),

    // Drift: 2-hop - other tags from an entity
    otherTagsForEntity: db.prepare(`
      SELECT wt.id AS tag_id, wt.name AS tag_name
      FROM wiki_tag_assignments wta
      JOIN wiki_tags wt ON wt.id = wta.tag_id
      WHERE wta.entity_id = ? AND wta.tag_id != ?
      ORDER BY RANDOM()
      LIMIT 3
    `),
  };

  function getSettings(): {
    oracle_enabled: boolean;
    timecapsule_enabled: boolean;
    drift_enabled: boolean;
    oracle_min_age_days: number;
  } {
    const defaults = {
      oracle_enabled: true,
      timecapsule_enabled: true,
      drift_enabled: true,
      oracle_min_age_days: 7,
    };
    const rows = stmts.getAllSettings.all() as SettingRow[];
    for (const row of rows) {
      if (row.key in defaults) {
        const key = row.key as keyof typeof defaults;
        if (typeof defaults[key] === "boolean") {
          (defaults as Record<string, unknown>)[key] = row.value === "true";
        } else {
          (defaults as Record<string, unknown>)[key] = Number(row.value);
        }
      }
    }
    return defaults;
  }

  return {
    getSettings,

    setSetting(key: string, value: string): void {
      stmts.upsertSetting.run(key, value);
    },

    getOracle(minAgeDays?: number): {
      entityId: string;
      entityType: "memo" | "note";
      title: string;
      preview: string;
      createdAt: string;
    } | null {
      const settings = getSettings();
      const min = minAgeDays ?? settings.oracle_min_age_days;
      const row = stmts.oracleQuery.get({ min_age_days: min }) as
        | OracleRow
        | undefined;
      if (!row) return null;

      // Log the display
      const logId = `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      stmts.logDisplay.run(logId, row.entity_id, row.entity_type, "oracle");

      return {
        entityId: row.entity_id,
        entityType: row.entity_type,
        title:
          row.entity_type === "memo"
            ? row.title // date string for memos
            : row.title,
        preview: extractPreview(row.content),
        createdAt: row.created_at,
      };
    },

    getTimeCapsules(today: string): Array<{
      entityId: string;
      entityType: "memo" | "note";
      title: string;
      preview: string;
      createdAt: string;
      label: string;
      daysAgo: number;
    }> {
      const rows = stmts.timeCapsuleQuery.all({ today }) as TimeCapsuleRow[];

      // Filter to specific intervals: 7, 30, 90, 365, 730 days
      const intervals = [7, 30, 90, 365, 730];
      const tolerance = 1; // ±1 day tolerance for non-exact matches

      const filtered = rows.filter((r) =>
        intervals.some((i) => Math.abs(r.days_ago - i) <= tolerance),
      );

      return filtered.map((row) => {
        let label: string;
        if (row.days_ago <= 8) label = "1週間前";
        else if (row.days_ago <= 31) label = "1ヶ月前";
        else if (row.days_ago <= 91) label = "3ヶ月前";
        else if (row.days_ago <= 366) label = "1年前";
        else label = "2年前";

        // Log display
        const logId = `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        stmts.logDisplay.run(
          logId,
          row.entity_id,
          row.entity_type,
          "timecapsule",
        );

        return {
          entityId: row.entity_id,
          entityType: row.entity_type,
          title: row.entity_type === "memo" ? row.title : row.title,
          preview: extractPreview(row.content),
          createdAt: row.created_at,
          label,
          daysAgo: row.days_ago,
        };
      });
    },

    getDrift(): {
      origin: { entityId: string; entityType: "memo" | "note"; title: string };
      path: Array<{ tagId: string; tagName: string }>;
      destination: {
        entityId: string;
        entityType: "memo" | "note";
        title: string;
      };
    } | null {
      // Step 1: Pick random origin entity
      const origin = stmts.driftRandomEntity.get() as
        | DriftEntityRow
        | undefined;
      if (!origin) return null;

      // Step 2: Get tags for origin
      const originTags = stmts.tagsForEntity.all(origin.entity_id) as Array<{
        tag_id: string;
        tag_name: string;
      }>;
      if (originTags.length === 0) return null;

      // Try each tag to find a 2-hop connection
      for (const tag1 of originTags) {
        // Step 3: Find 1-hop entities via tag1
        const hopEntities = stmts.entitiesForTag.all(
          tag1.tag_id,
          origin.entity_id,
        ) as DriftTagRow[];

        for (const hop of hopEntities) {
          // Step 4: Find other tags on the 1-hop entity
          const hop2Tags = stmts.otherTagsForEntity.all(
            hop.entity_id,
            tag1.tag_id,
          ) as Array<{ tag_id: string; tag_name: string }>;

          for (const tag2 of hop2Tags) {
            // Step 5: Find 2-hop entities via tag2
            const destinations = stmts.entitiesForTag.all(
              tag2.tag_id,
              hop.entity_id,
            ) as DriftTagRow[];

            // Filter out origin
            const dest = destinations.find(
              (d) => d.entity_id !== origin.entity_id,
            );
            if (dest) {
              // Log display
              const logId = `chaos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              stmts.logDisplay.run(
                logId,
                dest.entity_id,
                dest.entity_type,
                "drift",
              );

              return {
                origin: {
                  entityId: origin.entity_id,
                  entityType: origin.entity_type as "memo" | "note",
                  title: origin.title,
                },
                path: [
                  { tagId: tag1.tag_id, tagName: tag1.tag_name },
                  { tagId: tag2.tag_id, tagName: tag2.tag_name },
                ],
                destination: {
                  entityId: dest.entity_id,
                  entityType: dest.entity_type as "memo" | "note",
                  title: dest.title,
                },
              };
            }
          }
        }
      }

      return null; // No 2-hop connection found
    },

    getEntityCount(): number {
      const row = stmts.entityCount.get() as { total: number };
      return row.total;
    },

    getRecentDisplayIds(): string[] {
      return (stmts.recentDisplays.all() as DisplayLogRow[]).map(
        (r) => r.entity_id,
      );
    },
  };
}

export type ChaosRepository = ReturnType<typeof createChaosRepository>;
