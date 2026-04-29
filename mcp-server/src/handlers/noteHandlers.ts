import { getDb } from "../db.js";
import { markdownToTiptap } from "../utils/markdownToTiptap.js";

interface NoteRow {
  id: string;
  title: string;
  content: string;
  is_pinned: number;
  is_deleted: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

function formatNote(row: NoteRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    isPinned: row.is_pinned === 1,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listNotes(args: { query?: string }) {
  const db = getDb();
  if (args.query) {
    const rows = db
      .prepare(
        `SELECT * FROM notes WHERE is_deleted = 0
         AND (title LIKE @query OR content LIKE @query)
         ORDER BY updated_at DESC`,
      )
      .all({ query: `%${args.query}%` }) as NoteRow[];
    return rows.map(formatNote);
  }
  const rows = db
    .prepare(
      "SELECT * FROM notes WHERE is_deleted = 0 ORDER BY updated_at DESC",
    )
    .all() as NoteRow[];
  return rows.map(formatNote);
}

export function createNote(args: { title: string; content?: string }) {
  const db = getDb();
  const id = `note-${Date.now()}`;

  let contentJson = "";
  if (args.content) {
    contentJson = JSON.stringify(markdownToTiptap(args.content));
  }

  db.prepare(
    `INSERT INTO notes (id, title, content, is_pinned, is_deleted, created_at, updated_at)
     VALUES (@id, @title, @content, 0, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ).run({ id, title: args.title, content: contentJson });

  const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as NoteRow;
  return formatNote(row);
}

export function updateNote(args: {
  id: string;
  title?: string;
  content?: string;
  color?: string;
}) {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM notes WHERE id = ?")
    .get(args.id) as NoteRow | undefined;
  if (!existing) throw new Error(`Note not found: ${args.id}`);

  const updates: string[] = [];
  const params: Record<string, unknown> = { id: args.id };

  if (args.title !== undefined) {
    updates.push("title = @title");
    params.title = args.title;
  }
  if (args.content !== undefined) {
    updates.push("content = @content");
    params.content = JSON.stringify(markdownToTiptap(args.content));
  }

  if (args.color !== undefined) {
    updates.push("color = @color");
    params.color = args.color;
  }

  if (updates.length === 0) return formatNote(existing);

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
  db.prepare(`UPDATE notes SET ${updates.join(", ")} WHERE id = @id`).run(
    params,
  );

  const row = db
    .prepare("SELECT * FROM notes WHERE id = ?")
    .get(args.id) as NoteRow;
  return formatNote(row);
}
