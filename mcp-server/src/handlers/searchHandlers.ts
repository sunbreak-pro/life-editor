import { getDb } from "../db.js";
import { getContentPreview } from "../utils/tiptapText.js";

const VALID_DOMAINS = ["tasks", "memos", "notes"] as const;
type Domain = (typeof VALID_DOMAINS)[number];

interface TaskRow {
  id: string;
  title: string;
  status: string | null;
  scheduled_at: string | null;
  content: string | null;
}

interface MemoRow {
  date: string;
  content: string;
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export function searchAll(args: {
  query: string;
  domains?: string[];
  limit?: number;
}) {
  const db = getDb();
  const limit = args.limit ?? 10;
  const domains: Domain[] = args.domains
    ? (args.domains.filter((d) =>
        VALID_DOMAINS.includes(d as Domain),
      ) as Domain[])
    : [...VALID_DOMAINS];

  const pattern = `%${args.query}%`;
  const result: Record<string, unknown[]> = {};
  let totalHits = 0;

  if (domains.includes("tasks")) {
    const rows = db
      .prepare(
        `SELECT id, title, status, scheduled_at, content FROM tasks
         WHERE is_deleted = 0 AND type = 'task'
         AND (title LIKE @query OR content LIKE @query)
         ORDER BY created_at DESC LIMIT @limit`,
      )
      .all({ query: pattern, limit }) as TaskRow[];
    result.tasks = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      scheduledAt: r.scheduled_at,
      contentPreview: getContentPreview(r.content ?? ""),
    }));
    totalHits += rows.length;
  }

  if (domains.includes("memos")) {
    const rows = db
      .prepare(
        `SELECT date, content FROM memos
         WHERE is_deleted = 0 AND content LIKE @query
         ORDER BY date DESC LIMIT @limit`,
      )
      .all({ query: pattern, limit }) as MemoRow[];
    result.memos = rows.map((r) => ({
      date: r.date,
      contentPreview: getContentPreview(r.content),
    }));
    totalHits += rows.length;
  }

  if (domains.includes("notes")) {
    const rows = db
      .prepare(
        `SELECT id, title, content, updated_at FROM notes
         WHERE is_deleted = 0
         AND (title LIKE @query OR content LIKE @query)
         ORDER BY updated_at DESC LIMIT @limit`,
      )
      .all({ query: pattern, limit }) as NoteRow[];
    result.notes = rows.map((r) => ({
      id: r.id,
      title: r.title,
      contentPreview: getContentPreview(r.content),
      updatedAt: r.updated_at,
    }));
    totalHits += rows.length;
  }

  return { ...result, totalHits };
}
