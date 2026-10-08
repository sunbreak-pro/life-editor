/*
 * Briefing section helpers — the 朝刊 heading section inside a daily body.
 * Until 0035 this was the write half of the briefing convention; now its live
 * half is the reader at the bottom (see below).
 *
 * Contract (briefing-loop plan Step 2; shared's reader =
 * shared/src/components/briefing/extractBriefing.ts):
 *
 *   heading whose text is "Briefing" / "朝刊"
 *     every paragraph → the AI comment body
 *   ...the next heading (any text) ends the section.
 *
 * The focus line is NOT part of this section any more (#1048 / #1097): the
 * reader treats all paragraphs as AI comment, so the focus moved to the
 * reserved focus note (focusSection.ts) and this writer takes only the
 * comment paragraphs.
 *
 * `upsertBriefingSection` merges that section into an existing DailyNode
 * TipTap document non-destructively: an existing briefing section is
 * replaced in place; otherwise the section is prepended (the morning
 * paper sits on top of the day). Everything outside the section —
 * including the 夕刊 section — is preserved verbatim.
 *
 * Since 0035 (D-20261007-briefing-1) write_briefing writes the comment to
 * `dailies_payload.morning_comment` instead. `upsertBriefingSection`,
 * `hasBriefingSection` and `buildBriefingSectionNodes` have no production
 * caller any more (`parseDoc` still has one, focusSection.ts), and are kept
 * on purpose: they are the exact writer that produced the 朝刊 sections old
 * days still carry, and their suite round-trips that output through shared's
 * `extractBriefing` — the app's fallback reader for those days. Deleting them
 * would leave that reader checked against hand-written fixtures only.
 *
 * The live half of this module is the READ side — `readMorningComment` asks
 * the column first and falls back to the 朝刊 section of an older body, with
 * the same rules as shared's `readMorningRecord` (dailyMorning.ts).
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

export function textOf(node: TipTapNode): string {
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
 * Build the briefing section nodes: heading "朝刊" + one paragraph per
 * comment line. Empty/whitespace-only paragraphs are dropped
 * (extractBriefing ignores them anyway); when nothing remains this throws,
 * because a heading-only section is invisible to the reader — callers skip
 * the daily write instead of producing one.
 */
export function buildBriefingSectionNodes(paragraphs: string[]): TipTapNode[] {
  const body = paragraphs.map((p) => p.trim()).filter((p) => p !== "");
  if (body.length === 0) {
    throw new Error(
      "write_briefing: paragraphs must contain at least one non-empty string",
    );
  }
  return [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "朝刊" }],
    },
    ...body.map(paragraph),
  ];
}

/**
 * Legacy plain-text body → paragraph-per-line doc (F-1 rule).
 *
 * A copy of shared's `plainTextToTipTapDoc`
 * (shared/src/components/materials/dailyContent.ts), duplicated rather than
 * imported: mcp-server has no runtime dependency on shared, and the only
 * link between the packages is the TEST-ONLY import in
 * tests/briefingSection.test.ts — which round-trips this copy through
 * shared's own parser and is what keeps the two honest.
 */
function plainTextToTipTapDoc(text: string): TipTapNode {
  return {
    type: "doc",
    // \r?\n: Windows-era plain bodies would otherwise leave a trailing \r
    // on every paragraph.
    content: text.split(/\r?\n/).map((line): TipTapNode => {
      // TipTap forbids empty text nodes — an empty line is a bare paragraph.
      if (line === "") return { type: "paragraph" };
      return { type: "paragraph", content: [{ type: "text", text: line }] };
    }),
  };
}

/**
 * A stored daily / note body → a TipTap doc for section surgery. Same
 * acceptance rule as shared's `parseDailyDoc`
 * (shared/src/components/briefing/dailySections.ts): empty → empty doc, a
 * TipTap doc JSON → parsed as-is, anything else → the body read as legacy
 * plain text, one paragraph per line.
 *
 * This used to THROW on the last case (#1592), on the rule that an MCP write
 * must not clobber a body it cannot read. The rule stands; the throw was the
 * wrong tool for it. What it protected against is DISCARDING text, and
 * paragraphing discards nothing — every line survives verbatim, which is
 * exactly what the editor already does when the user opens that daily
 * (`dailyContentToEditorContent`). Meanwhile the throw had a cost measured on
 * live data: `daily-2026-05-24` is a plain-text body the screen renders fine
 * and `write_briefing` refused to touch, so the morning paper simply could
 * not be written for that day.
 *
 * `contentJson` reaches here from `contentJsonToString`, so a jsonb string
 * column (how a legacy plain body is actually stored) arrives as its raw
 * text and lands on the plain-text branch.
 */
export function parseDoc(contentJson: string | null | undefined): TipTapNode {
  if (
    contentJson === null ||
    contentJson === undefined ||
    contentJson.trim() === ""
  ) {
    return { type: "doc", content: [] };
  }
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as TipTapNode).type === "doc" &&
      Array.isArray((parsed as TipTapNode).content)
    ) {
      return parsed as TipTapNode;
    }
  } catch {
    // fall through — legacy plain text
  }
  // Anything that is not a doc is read as text, the same answer shared
  // gives, rather than being lost.
  return plainTextToTipTapDoc(contentJson);
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

/**
 * The 朝刊 section's paragraphs, or null when there is none with text — the
 * same rule as shared's `extractBriefing` (copied, not imported; the
 * round-trip in tests/briefingSection.test.ts keeps the two in step): the
 * body must parse as JSON, the section starts at the FIRST 朝刊 / Briefing
 * heading and ends at the next heading, and each top-level block in it is
 * one trimmed paragraph, blanks dropped. A legacy plain-text body has no
 * headings, so it answers null here exactly as it does in shared.
 */
export function extractBriefingParagraphs(
  contentJson: string | null | undefined,
): string[] | null {
  if (contentJson === null || contentJson === undefined || contentJson === "")
    return null;
  let doc: TipTapNode;
  try {
    doc = JSON.parse(contentJson) as TipTapNode;
  } catch {
    return null;
  }
  const body = doc?.content;
  if (!Array.isArray(body)) return null;

  const texts: string[] = [];
  let inSection = false;
  for (const node of body) {
    if (node.type === "heading") {
      if (inSection) break;
      if (BRIEFING_HEADING_RE.test(textOf(node).trim())) inSection = true;
      continue;
    }
    if (inSection) {
      const t = textOf(node).trim();
      if (t !== "") texts.push(t);
    }
  }
  return inSection && texts.length > 0 ? texts : null;
}

/**
 * A `morning_comment` column value (0035) → its paragraphs, or null. The DB
 * only CHECKs "null or an array", so non-string and blank elements are
 * dropped and an array with nothing left is null — the rule shared's
 * dailiesUnifiedMapper applies on the app's side.
 */
export function morningCommentOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const paragraphs: string[] = [];
  for (const p of value) {
    if (typeof p !== "string") continue;
    const text = p.trim();
    if (text !== "") paragraphs.push(text);
  }
  return paragraphs.length === 0 ? null : paragraphs;
}

/**
 * Claude's morning comment for a day: the column when it holds a paragraph,
 * else the 朝刊 section of the body (an older day, never rewritten), else
 * null. The caller passes `null` content for a body it may not read.
 */
export function readMorningComment(
  column: unknown,
  contentJson: string | null | undefined,
): string[] | null {
  return morningCommentOf(column) ?? extractBriefingParagraphs(contentJson);
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
 * prepends. A legacy plain-text body is read as paragraphs first (parseDoc),
 * so the write converts the body to a doc without losing a line.
 *
 * No caller since 0035 (write_briefing writes `morning_comment`) — see the
 * header for why it stays.
 */
export function upsertBriefingSection(
  contentJson: string | null | undefined,
  paragraphs: string[],
): string {
  const doc = parseDoc(contentJson);
  const body = doc.content ?? [];
  const section = buildBriefingSectionNodes(paragraphs);
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
