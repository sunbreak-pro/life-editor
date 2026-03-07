import { getDb } from "../db.js";

interface MemoRow {
  id: string;
  date: string;
  content: string;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

function formatMemo(row: MemoRow) {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getMemo(args: { date: string }) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM memos WHERE date = ? AND is_deleted = 0")
    .get(args.date) as MemoRow | undefined;

  if (!row) return { date: args.date, content: null };
  return formatMemo(row);
}

export function upsertMemo(args: { date: string; content: string }) {
  const db = getDb();
  const id = `memo-${args.date}`;

  // Convert plain text to minimal TipTap JSON
  const tiptapDoc = {
    type: "doc",
    content: args.content.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };

  db.prepare(
    `INSERT INTO memos (id, date, content, created_at, updated_at)
     VALUES (@id, @date, @content, datetime('now'), datetime('now'))
     ON CONFLICT(date) DO UPDATE SET content = @content, updated_at = datetime('now')`,
  ).run({
    id,
    date: args.date,
    content: JSON.stringify(tiptapDoc),
  });

  const row = db
    .prepare("SELECT * FROM memos WHERE date = ?")
    .get(args.date) as MemoRow;
  return formatMemo(row);
}
