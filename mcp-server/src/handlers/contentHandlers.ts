import { getDb } from "../db.js";
import {
  doc,
  heading,
  paragraph,
  bulletList,
  orderedList,
  taskList,
  toggleList,
  callout,
  codeBlock,
  blockquote,
  horizontalRule,
  table,
  type TipTapNode,
  type TipTapDoc,
} from "../utils/tiptapJsonBuilder.js";

/* ===== ContentBlock schema ===== */

interface ContentBlock {
  type:
    | "heading"
    | "paragraph"
    | "bulletList"
    | "orderedList"
    | "taskList"
    | "toggleList"
    | "callout"
    | "codeBlock"
    | "blockquote"
    | "horizontalRule"
    | "table";
  level?: 1 | 2 | 3;
  fontSize?: string;
  text?: string;
  items?: string[];
  tasks?: Array<{ text: string; checked: boolean }>;
  summary?: string;
  content?: ContentBlock[];
  code?: string;
  language?: string;
  color?: string;
  iconName?: string;
  headers?: string[];
  rows?: string[][];
}

function buildNode(block: ContentBlock): TipTapNode {
  switch (block.type) {
    case "heading":
      return heading(
        (block.level as 1 | 2 | 3) ?? 1,
        block.text ?? "",
        block.fontSize,
      );
    case "paragraph":
      return paragraph(block.text);
    case "bulletList":
      return bulletList(...(block.items ?? []));
    case "orderedList":
      return orderedList(...(block.items ?? []));
    case "taskList":
      return taskList(...(block.tasks ?? []));
    case "toggleList": {
      const children = (block.content ?? []).map(buildNode);
      return toggleList(block.summary ?? "", ...children);
    }
    case "callout": {
      const children =
        block.content && block.content.length > 0
          ? block.content.map(buildNode)
          : [paragraph(block.text)];
      return callout(children, {
        iconName: block.iconName,
        color: block.color,
      });
    }
    case "codeBlock":
      return codeBlock(block.code ?? "", block.language);
    case "blockquote": {
      const children =
        block.content && block.content.length > 0
          ? block.content.map(buildNode)
          : [paragraph(block.text)];
      return blockquote(...children);
    }
    case "horizontalRule":
      return horizontalRule();
    case "table":
      return table(block.headers ?? [], block.rows ?? []);
    default:
      return paragraph(block.text);
  }
}

function buildDoc(structure: ContentBlock[]): TipTapDoc {
  const nodes = structure.map(buildNode);
  return doc(...nodes);
}

/* ===== generate_content ===== */

interface GenerateContentArgs {
  target: "note" | "daily" | "schedule";
  target_id?: string;
  target_date?: string;
  title?: string;
  structure: ContentBlock[];
}

export function generateContent(args: GenerateContentArgs) {
  const db = getDb();
  const tiptapDoc = buildDoc(args.structure);
  const contentJson = JSON.stringify(tiptapDoc);

  if (args.target === "note") {
    if (args.target_id) {
      // Update existing note
      const existing = db
        .prepare("SELECT id FROM notes WHERE id = ? AND is_deleted = 0")
        .get(args.target_id) as { id: string } | undefined;
      if (!existing) throw new Error(`Note not found: ${args.target_id}`);

      const updates: string[] = [
        "content = @content",
        "updated_at = datetime('now')",
      ];
      const params: Record<string, unknown> = {
        id: args.target_id,
        content: contentJson,
      };
      if (args.title) {
        updates.push("title = @title");
        params.title = args.title;
      }
      db.prepare(`UPDATE notes SET ${updates.join(", ")} WHERE id = @id`).run(
        params,
      );
      return { id: args.target_id, target: "note", content: tiptapDoc };
    } else {
      // Create new note
      const id = `note-${Date.now()}`;
      db.prepare(
        `INSERT INTO notes (id, title, content, is_pinned, is_deleted, created_at, updated_at)
         VALUES (@id, @title, @content, 0, 0, datetime('now'), datetime('now'))`,
      ).run({ id, title: args.title ?? "Untitled", content: contentJson });
      return { id, target: "note", content: tiptapDoc };
    }
  } else if (args.target === "schedule") {
    // schedule item content
    if (!args.target_id)
      throw new Error("target_id required for schedule target");
    const existing = db
      .prepare("SELECT id FROM schedule_items WHERE id = ?")
      .get(args.target_id) as { id: string } | undefined;
    if (!existing)
      throw new Error(`Schedule item not found: ${args.target_id}`);

    db.prepare(
      `UPDATE schedule_items SET content = @content, version = version + 1, updated_at = datetime('now') WHERE id = @id`,
    ).run({ id: args.target_id, content: contentJson });
    return { id: args.target_id, target: "schedule", content: tiptapDoc };
  } else {
    // daily
    const date = args.target_date ?? new Date().toISOString().slice(0, 10);
    const id = args.target_id ?? `daily-${date}`;
    db.prepare(
      `INSERT INTO dailies (id, date, content, created_at, updated_at)
       VALUES (@id, @date, @content, datetime('now'), datetime('now'))
       ON CONFLICT(date) DO UPDATE SET content = @content, updated_at = datetime('now')`,
    ).run({ id, date, content: contentJson });
    return { id, date, target: "daily", content: tiptapDoc };
  }
}

/* ===== format_content ===== */

interface FormatOperation {
  action:
    | "wrap_callout"
    | "wrap_toggle"
    | "add_heading"
    | "insert_block"
    | "replace_all";
  // wrap_callout / wrap_toggle: wraps existing content
  iconName?: string;
  color?: string;
  summary?: string;
  // add_heading
  level?: 1 | 2 | 3;
  text?: string;
  fontSize?: string;
  position?: "start" | "end";
  // insert_block
  block?: ContentBlock;
  // replace_all
  structure?: ContentBlock[];
}

interface FormatContentArgs {
  target: "note" | "daily" | "schedule";
  target_id?: string;
  target_date?: string;
  operations: FormatOperation[];
}

export function formatContent(args: FormatContentArgs) {
  const db = getDb();

  // Read existing content
  let contentJson: string;
  let entityId: string;

  if (args.target === "note") {
    if (!args.target_id) throw new Error("target_id required for note");
    const row = db
      .prepare("SELECT id, content FROM notes WHERE id = ? AND is_deleted = 0")
      .get(args.target_id) as { id: string; content: string } | undefined;
    if (!row) throw new Error(`Note not found: ${args.target_id}`);
    contentJson = row.content;
    entityId = row.id;
  } else if (args.target === "schedule") {
    if (!args.target_id)
      throw new Error("target_id required for schedule target");
    const row = db
      .prepare("SELECT id, content FROM schedule_items WHERE id = ?")
      .get(args.target_id) as
      | { id: string; content: string | null }
      | undefined;
    if (!row) throw new Error(`Schedule item not found: ${args.target_id}`);
    contentJson = row.content ?? "";
    entityId = row.id;
  } else {
    const date = args.target_date ?? new Date().toISOString().slice(0, 10);
    const row = db
      .prepare(
        "SELECT id, content FROM dailies WHERE date = ? AND is_deleted = 0",
      )
      .get(date) as { id: string; content: string } | undefined;
    if (!row) throw new Error(`Daily not found for date: ${date}`);
    contentJson = row.content;
    entityId = row.id;
  }

  let tiptapDoc: TipTapDoc;
  try {
    tiptapDoc = JSON.parse(contentJson) as TipTapDoc;
  } catch {
    tiptapDoc = doc(paragraph(contentJson));
  }

  for (const op of args.operations) {
    switch (op.action) {
      case "wrap_callout":
        tiptapDoc = doc(
          callout(tiptapDoc.content, {
            iconName: op.iconName,
            color: op.color,
          }),
        );
        break;

      case "wrap_toggle":
        tiptapDoc = doc(
          toggleList(op.summary ?? "Details", ...tiptapDoc.content),
        );
        break;

      case "add_heading": {
        const h = heading(
          (op.level as 1 | 2 | 3) ?? 1,
          op.text ?? "",
          op.fontSize,
        );
        if (op.position === "end") {
          tiptapDoc.content.push(h);
        } else {
          tiptapDoc.content.unshift(h);
        }
        break;
      }

      case "insert_block": {
        if (op.block) {
          const node = buildNode(op.block);
          tiptapDoc.content.push(node);
        }
        break;
      }

      case "replace_all":
        if (op.structure) {
          tiptapDoc = buildDoc(op.structure);
        }
        break;
    }
  }

  const updatedJson = JSON.stringify(tiptapDoc);

  if (args.target === "note") {
    db.prepare(
      "UPDATE notes SET content = @content, updated_at = datetime('now') WHERE id = @id",
    ).run({ id: entityId, content: updatedJson });
  } else if (args.target === "schedule") {
    db.prepare(
      "UPDATE schedule_items SET content = @content, version = version + 1, updated_at = datetime('now') WHERE id = @id",
    ).run({ id: entityId, content: updatedJson });
  } else {
    db.prepare(
      "UPDATE dailies SET content = @content, updated_at = datetime('now') WHERE id = @id",
    ).run({ id: entityId, content: updatedJson });
  }

  return { id: entityId, target: args.target, content: tiptapDoc };
}
