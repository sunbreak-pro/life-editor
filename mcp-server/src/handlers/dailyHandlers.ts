import { getDb } from "../db.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";

interface DailyRow {
  id: string;
  date: string;
  content: string;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

function formatDaily(row: DailyRow) {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDaily(args: { date: string }) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM dailies WHERE date = ? AND is_deleted = 0")
    .get(args.date) as DailyRow | undefined;

  if (!row) return { date: args.date, content: null };
  return formatDaily(row);
}

export function upsertDaily(args: { date: string; content: string }) {
  const db = getDb();
  const id = `daily-${args.date}`;

  const contentJson = JSON.stringify(markdownToTiptap(args.content));

  db.prepare(
    `INSERT INTO dailies (id, date, content, created_at, updated_at)
     VALUES (@id, @date, @content, datetime('now'), datetime('now'))
     ON CONFLICT(date) DO UPDATE SET content = @content, updated_at = datetime('now')`,
  ).run({
    id,
    date: args.date,
    content: contentJson,
  });

  const row = db
    .prepare("SELECT * FROM dailies WHERE date = ?")
    .get(args.date) as DailyRow;
  return formatDaily(row);
}
