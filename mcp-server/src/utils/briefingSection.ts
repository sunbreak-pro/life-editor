/*
 * Briefing section writer — the write half of the briefing convention.
 *
 * Contract (briefing-loop plan Step 2; read half =
 * shared/src/components/briefing/extractBriefing.ts):
 *
 *   heading whose text is "Briefing" / "朝刊"
 *     paragraph #1  → the focus line (今日のフォーカス)
 *     paragraph #2+ → the AI comment body
 *   ...the next heading (any text) ends the section.
 *
 * `upsertBriefingSection` merges that section into an existing DailyNode
 * TipTap document non-destructively: an existing briefing section is
 * replaced in place; otherwise the section is prepended (the morning
 * paper sits on top of the day). Everything outside the section —
 * including the 夕刊 section — is preserved verbatim.
 *
 * Pure module (no Supabase, no MCP) — unit-tested in
 * tests/briefingSection.test.ts, including a round-trip against the
 * shared extractBriefing parser.
 */

export interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  [key: string]: unknown;
}

/** Same marker as extractBriefing (case-insensitive, trimmed). */
const BRIEFING_HEADING_RE = /^(briefing|朝刊)$/i;

function textOf(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textOf).join("");
}

function paragraph(text: string): TipTapNode {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

/**
 * Build the briefing section nodes: heading "朝刊" + focus paragraph +
 * one paragraph per comment line. Empty/whitespace-only paragraphs are
 * dropped (extractBriefing ignores them anyway).
 */
export function buildBriefingSectionNodes(
  focus: string,
  paragraphs: string[],
): TipTapNode[] {
  const trimmedFocus = focus.trim();
  if (trimmedFocus === "") {
    throw new Error("write_briefing: focus must be a non-empty string");
  }
  const body = paragraphs.map((p) => p.trim()).filter((p) => p !== "");
  return [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "朝刊" }],
    },
    paragraph(trimmedFocus),
    ...body.map(paragraph),
  ];
}

function parseDoc(contentJson: string | null | undefined): TipTapNode {
  if (
    contentJson === null ||
    contentJson === undefined ||
    contentJson.trim() === ""
  ) {
    return { type: "doc", content: [] };
  }
  let doc: unknown;
  try {
    doc = JSON.parse(contentJson);
  } catch {
    throw new Error(
      "write_briefing: existing daily content is not valid TipTap JSON — refusing to overwrite it",
    );
  }
  const node = doc as TipTapNode;
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    throw new Error(
      "write_briefing: existing daily content is not a TipTap document — refusing to overwrite it",
    );
  }
  if (!Array.isArray(node.content)) node.content = [];
  return node;
}

/**
 * Locate an existing briefing section among top-level nodes. Returns the
 * [start, end) index range (start = the briefing heading, end = the next
 * heading or document end), or null when the document has no briefing
 * section.
 */
function findBriefingRange(
  body: TipTapNode[],
): { start: number; end: number } | null {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node.type !== "heading") continue;
    if (!BRIEFING_HEADING_RE.test(textOf(node).trim())) continue;
    let end = body.length;
    for (let j = i + 1; j < body.length; j++) {
      if (body[j].type === "heading") {
        end = j;
        break;
      }
    }
    return { start: i, end };
  }
  return null;
}

/** True when the document already contains a briefing section heading. */
export function hasBriefingSection(
  contentJson: string | null | undefined,
): boolean {
  try {
    return findBriefingRange(parseDoc(contentJson).content ?? []) !== null;
  } catch {
    return false;
  }
}

/**
 * Upsert the briefing section into a DailyNode content string and return
 * the new content string. Replaces an existing section in place, else
 * prepends. Throws (rather than clobbering user data) when the existing
 * content is unparseable.
 */
export function upsertBriefingSection(
  contentJson: string | null | undefined,
  focus: string,
  paragraphs: string[],
): string {
  const doc = parseDoc(contentJson);
  const body = doc.content ?? [];
  const section = buildBriefingSectionNodes(focus, paragraphs);
  const range = findBriefingRange(body);
  if (range) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    body.unshift(...section);
  }
  doc.content = body;
  if (doc.type === undefined) doc.type = "doc";
  return JSON.stringify(doc);
}
