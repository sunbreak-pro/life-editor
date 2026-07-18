/*
 * Evening-paper (夕刊) section helpers — the F-6 counterpart of the morning
 * briefing convention (#263).
 *
 * Contract (loop-friction plan §F-6; morning read half = extractBriefing.ts,
 * morning write half = mcp-server/src/utils/briefingSection.ts):
 *
 *   heading whose text is "夕刊" / "Evening"
 *     paragraph #1 (optional) → the mood line「気分: n/5」(n = 1..5)
 *     following blocks        → the user's free-form evening reflection
 *   ...the next heading (any text) ends the section.
 *
 * The evening tab is a dedicated EDITING view of this section, so unlike the
 * morning writer these helpers split a daily's content into "the evening
 * section" (what the tab's TipTap editor mounts) and "everything else" (which
 * must survive verbatim). `mergeEveningSection` is the concurrency-safe write:
 * read the WHOLE content → replace only the evening range → write back, so a
 * save from the evening tab never clobbers the 朝刊 section or anything the
 * user wrote in the Daily editor (Risks: section-merge write, not whole-doc
 * overwrite). A legacy plain-text daily is converted with the same read-time
 * rule as F-1 (plainTextToTipTapDoc) before merging.
 *
 * Pure module (no React, no DataService) — unit-tested in
 * shared/tests/eveningSection.test.ts.
 */

import { plainTextToTipTapDoc } from "../materials/dailyContent";
import { getDayStartHour } from "../../utils/dateKey";

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  [key: string]: unknown;
}

/** Section heading marker (case-insensitive, trimmed) — mirrors 朝刊's RE. */
const EVENING_HEADING_RE = /^(夕刊|evening)$/i;

/**
 * The mood-line text convention (decision 7: DDL-zero, text convention only).
 * Written as「気分: n/5」; parsing accepts a full-width colon and spacing.
 */
const MOOD_LINE_RE = /^気分[:：]\s*([1-5])\s*\/\s*5$/;

/** Serialize a mood value to its conventional line. */
export function moodLineText(mood: number): string {
  return `気分: ${mood}/5`;
}

function textOf(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textOf).join("");
}

/**
 * Parse a stored daily body into a TipTap doc for section surgery. Empty →
 * empty doc; a plain-text legacy body → paragraph-per-line doc (F-1 rule);
 * a TipTap doc JSON → parsed as-is.
 */
function parseDailyDoc(contentJson: string | null | undefined): TipTapNode {
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
  return plainTextToTipTapDoc(contentJson) as TipTapNode;
}

/**
 * Locate the evening section among top-level nodes: [start, end) where start
 * is the 夕刊 heading and end is the next heading or document end.
 */
function findEveningRange(
  body: TipTapNode[],
): { start: number; end: number } | null {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node === undefined || node.type !== "heading") continue;
    if (!EVENING_HEADING_RE.test(textOf(node).trim())) continue;
    let end = body.length;
    for (let j = i + 1; j < body.length; j++) {
      if (body[j]?.type === "heading") {
        end = j;
        break;
      }
    }
    return { start: i, end };
  }
  return null;
}

/** True when every node is a text-empty paragraph (an "empty" editor body). */
function isEmptyBody(nodes: TipTapNode[]): boolean {
  return nodes.every((n) => n.type === "paragraph" && textOf(n).trim() === "");
}

/**
 * True when a TipTap doc JSON carries no non-space text (an empty editor
 * emission) — hosts use it to normalize "cleared" bodies to null.
 */
export function isEmptyDocJson(docJson: string): boolean {
  try {
    const parsed = JSON.parse(docJson) as TipTapNode;
    return !Array.isArray(parsed.content) || isEmptyBody(parsed.content);
  } catch {
    return true;
  }
}

export interface ExtractedEveningSection {
  /** Mood 1–5 from the「気分: n/5」line, or null when absent. */
  mood: number | null;
  /**
   * TipTap doc JSON of the section body WITHOUT the mood line — what the
   * evening editor mounts. Null when the daily has no evening section or the
   * section body is empty.
   */
  bodyDocJson: string | null;
  /** True when the daily contains a 夕刊 heading at all. */
  hasSection: boolean;
}

/**
 * Extract the evening section from a stored daily body (TipTap JSON or legacy
 * plain text — the latter never contains headings, so it yields "no section").
 */
export function extractEveningSection(
  contentJson: string | null | undefined,
): ExtractedEveningSection {
  const body = parseDailyDoc(contentJson).content ?? [];
  const range = findEveningRange(body);
  if (range === null)
    return { mood: null, bodyDocJson: null, hasSection: false };

  // Per the contract the mood line is paragraph #1 ONLY — a「気分: n/5」
  // string later in the reflection body is the user's prose and stays put
  // (also keeps the emitted-body ↔ stored-body echo comparison stable).
  let mood: number | null = null;
  let nodes = body.slice(range.start + 1, range.end);
  const first = nodes[0];
  if (first !== undefined) {
    const m = MOOD_LINE_RE.exec(textOf(first).trim());
    if (m !== null) {
      mood = Number(m[1]);
      nodes = nodes.slice(1);
    }
  }
  return {
    mood,
    bodyDocJson: isEmptyBody(nodes)
      ? null
      : JSON.stringify({ type: "doc", content: nodes }),
    hasSection: true,
  };
}

export interface EveningPatch {
  /**
   * New section body as a TipTap doc JSON (the evening editor's emitted
   * value). `null` = clear the body; `undefined` = keep what is stored.
   */
  bodyDocJson?: string | null;
  /** New mood (1–5), `null` = clear, `undefined` = keep what is stored. */
  mood?: number | null;
}

/**
 * Section-merge write: apply an evening patch to a stored daily body and
 * return the new content string. Reads the whole document, replaces only the
 * evening [heading, next heading) range (or appends it at the end — the
 * evening closes the day, unlike the morning's prepend), and leaves every
 * other block untouched. When the patched section carries nothing (no mood,
 * empty body) an existing section is removed and an absent one is not
 * created. Returns the input unchanged (===) when there is nothing to do,
 * so callers can skip the write.
 */
export function mergeEveningSection(
  contentJson: string | null | undefined,
  patch: EveningPatch,
): string {
  const original = contentJson ?? "";
  const doc = parseDailyDoc(contentJson);
  const body = doc.content ?? [];
  const range = findEveningRange(body);

  const stored = extractEveningSection(contentJson);
  const mood = patch.mood === undefined ? stored.mood : patch.mood;
  const bodyDocJson =
    patch.bodyDocJson === undefined ? stored.bodyDocJson : patch.bodyDocJson;

  let bodyNodes: TipTapNode[] = [];
  if (bodyDocJson !== null) {
    try {
      const parsed = JSON.parse(bodyDocJson) as TipTapNode;
      if (Array.isArray(parsed.content)) bodyNodes = parsed.content;
    } catch {
      // an unparseable patch body contributes nothing
    }
  }
  if (isEmptyBody(bodyNodes)) bodyNodes = [];

  if (mood === null && bodyNodes.length === 0) {
    // Nothing to keep — drop an existing section, never create one.
    if (range === null) return original;
    body.splice(range.start, range.end - range.start);
    doc.content = body;
    return JSON.stringify(doc);
  }

  const section: TipTapNode[] = [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "夕刊" }],
    },
    ...(mood !== null
      ? [
          {
            type: "paragraph",
            content: [{ type: "text", text: moodLineText(mood) }],
          } satisfies TipTapNode,
        ]
      : []),
    ...bodyNodes,
  ];

  if (range !== null) {
    body.splice(range.start, range.end - range.start, ...section);
  } else {
    body.push(...section);
  }
  doc.content = body;
  const merged = JSON.stringify(doc);
  return merged === original ? original : merged;
}

// ── Initial-tab selection ────────────────────────────────────────────────

export type BriefingTab = "morning" | "evening";

/** Local hour at which the briefing section opens on the 夕刊 tab (#263). */
export const EVENING_TAB_START_HOUR = 17;

/**
 * Time-based initial tab for the Briefing section: evening from 17:00, and
 * also during the post-midnight tail of the day when the day-start pref
 * shifts "today" (e.g. day starts at 4 → 0:00–3:59 is still last night, so
 * the evening tab). The pref guard (≤ 12) ignores nonsense values that would
 * otherwise make the whole day "evening".
 */
export function defaultBriefingTab(
  now: Date = new Date(),
  dayStartHour: number = getDayStartHour(),
): BriefingTab {
  const hour = now.getHours();
  if (hour >= EVENING_TAB_START_HOUR) return "evening";
  if (dayStartHour <= 12 && hour < dayStartHour) return "evening";
  return "morning";
}
