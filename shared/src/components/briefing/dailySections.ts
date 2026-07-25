/*
 * Daily section primitives — the shared substrate of the three heading-
 * section conventions that live inside a DailyNode's content (DDL zero,
 * briefing-loop decisions 1/6 + Step 4):
 *
 *   朝刊 / Briefing   → extractBriefing.ts (read) + MCP briefingSection.ts (write)
 *   宣言 / Intention  → intentionSection.ts (the user's morning declaration)
 *   夕刊 / Evening    → eveningSection.ts (the closing page)
 *
 * A "section" is always [heading matching the marker RE, next heading or
 * document end). Keeping the heading REs here is what guarantees the three
 * conventions can never claim each other's headings out of sync.
 *
 * Pure module (no React, no DataService).
 */

import { plainTextToTipTapDoc } from "../materials/dailyContent";

export interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  [key: string]: unknown;
}

/** 朝刊 section heading marker (case-insensitive, trimmed). */
export const BRIEFING_HEADING_RE = /^(briefing|朝刊)$/i;

/** 宣言 section heading marker (case-insensitive, trimmed). */
export const INTENTION_HEADING_RE = /^(宣言|intentions?)$/i;

/** 夕刊 section heading marker (case-insensitive, trimmed). */
export const EVENING_HEADING_RE = /^(夕刊|evening)$/i;

/** Flatten a TipTap node subtree to plain text. */
export function textOf(node: TipTapNode): string {
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  return node.content.map(textOf).join("");
}

/**
 * Parse a stored daily body into a TipTap doc for section surgery. Empty →
 * empty doc; a plain-text legacy body → paragraph-per-line doc (F-1 rule);
 * a TipTap doc JSON → parsed as-is.
 */
export function parseDailyDoc(
  contentJson: string | null | undefined,
): TipTapNode {
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
 * Locate a heading section among top-level nodes: [start, end) where start
 * is the first heading matching `headingRe` and end is the next heading
 * (any text) or the document end.
 */
export function findSectionRange(
  body: TipTapNode[],
  headingRe: RegExp,
): { start: number; end: number } | null {
  for (let i = 0; i < body.length; i++) {
    const node = body[i];
    if (node === undefined || node.type !== "heading") continue;
    if (!headingRe.test(textOf(node).trim())) continue;
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
