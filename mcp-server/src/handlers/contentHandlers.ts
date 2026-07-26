import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { contentJsonToString } from "../utils/content.js";
import { insertItem, requireMeta, updatePayload } from "../utils/items.js";
import { assertDateKey, localToday } from "../utils/localDate.js";
import { findDailyPayload, upsertDailyContent } from "./dailyHandlers.js";
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

/*
 * Content handlers — Supabase edition (#360).
 *
 * generate_content / format_content write structured TipTap documents into
 * note and daily bodies (`content_json`, jsonb). The legacy "schedule"
 * target is retired: the unified schema gave events no content column
 * (0008 — see the scheduleItemMapper header), so there is nowhere to put a
 * document. `update_schedule_item`'s `memo` is the remaining text field.
 */

const SCHEDULE_TARGET_RETIRED =
  'the "schedule" target is retired: events carry no content column in the ' +
  "unified schema (0008). Use update_schedule_item's `memo` field for event text.";

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

type ContentTarget = "note" | "daily";

/** Reject the retired "schedule" target with an actionable message. */
function assertTarget(target: string, tool: string): ContentTarget {
  if (target === "note" || target === "daily") return target;
  if (target === "schedule")
    throw new Error(`${tool}: ${SCHEDULE_TARGET_RETIRED}`);
  throw new Error(`${tool}: unknown target "${target}" (expected note|daily)`);
}

/* ===== generate_content ===== */

interface GenerateContentArgs {
  target: string;
  target_id?: string;
  target_date?: string;
  title?: string;
  structure: ContentBlock[];
}

export async function generateContent(args: GenerateContentArgs) {
  const target = assertTarget(args.target, "generate_content");
  const tiptapDoc = buildDoc(args.structure);

  if (target === "note") {
    if (args.target_id) {
      await requireMeta(args.target_id, "note", "Note");
      await updatePayload(
        "notes_payload",
        args.target_id,
        "note",
        { content_json: tiptapDoc },
        args.title ? { title: args.title } : {},
      );
      return { id: args.target_id, target, content: tiptapDoc };
    }

    const id = `note-${randomUUID()}`;
    await insertItem({
      id,
      role: "note",
      title: args.title ?? "Untitled",
      payloadTable: "notes_payload",
      payload: {
        parent_item_id: null,
        note_type: "note",
        content_json: tiptapDoc,
        sort_order: 0,
        is_pinned: false,
        is_edit_locked: false,
      },
    });
    return { id, target, content: tiptapDoc };
  }

  const date = assertDateKey(args.target_date ?? localToday());
  const daily = await upsertDailyContent(date, tiptapDoc);
  return { id: daily.id, date, target, content: tiptapDoc };
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
  target: string;
  target_id?: string;
  target_date?: string;
  operations: FormatOperation[];
}

export async function formatContent(args: FormatContentArgs) {
  const target = assertTarget(args.target, "format_content");
  const { client } = await getSupabase();

  // Read the existing document.
  let existingJson: unknown;
  let entityId: string;
  let date: string | undefined;

  if (target === "note") {
    if (!args.target_id) throw new Error("target_id required for note");
    await requireMeta(args.target_id, "note", "Note");
    const { data, error } = await client
      .from("notes_payload")
      .select("item_id, content_json")
      .eq("item_id", args.target_id)
      .maybeSingle();
    if (error) throw new Error(`get notes_payload: ${error.message}`);
    if (!data) throw new Error(`Note not found: ${args.target_id}`);
    const row = data as { item_id: string; content_json: unknown };
    existingJson = row.content_json;
    entityId = row.item_id;
  } else {
    date = assertDateKey(args.target_date ?? localToday());
    const row = await findDailyPayload(date);
    if (!row) throw new Error(`Daily not found for date: ${date}`);
    existingJson = row.content_json;
    entityId = row.item_id;
  }

  let tiptapDoc: TipTapDoc;
  const contentString = contentJsonToString(existingJson);
  try {
    tiptapDoc = JSON.parse(contentString) as TipTapDoc;
  } catch {
    tiptapDoc = doc(paragraph(contentString));
  }
  if (!tiptapDoc || !Array.isArray(tiptapDoc.content)) {
    tiptapDoc = doc(paragraph(contentString));
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

  if (target === "note") {
    await updatePayload("notes_payload", entityId, "note", {
      content_json: tiptapDoc,
    });
  } else {
    await upsertDailyContent(date as string, tiptapDoc);
  }

  return { id: entityId, target, content: tiptapDoc };
}
