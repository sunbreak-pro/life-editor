import type { DailyNode } from "../types/daily";
import { readDailyText } from "../components/briefing/dailyText";
import { DAILY_HEAD_BLOCKS } from "../services/dailiesUnifiedMapper";

/*
 * The Daily list's light read, laid over what the list already holds (#2325).
 *
 * The list read carries no bodies (`bodyLoaded: false`), so a re-read must
 * not throw away a body this client already fetched or wrote:
 *
 *   - a day whose `updatedAt` did not move keeps its body;
 *   - the OPEN day keeps its body even when `updatedAt` moved, and is
 *     reported in `stale` so the caller fetches it again. Blanking it would
 *     unmount the editor mid-sentence — and the move is usually this client's
 *     own save coming back, whose stamp is the server's, not the optimistic
 *     one the list holds;
 *   - any other day whose `updatedAt` moved goes back to light: nothing shows
 *     its body, and it is fetched again when it is opened.
 *
 * The same three rules hold for a row the read filled with its body
 * (fillDailyBodies): for the open day, what this client holds can be newer
 * than what the read saw.
 *
 * Pure (no React, no DataService), so the three cases are testable alone.
 */
export function mergeDailySummaries(
  prev: readonly DailyNode[],
  rows: readonly DailyNode[],
  openDate: string | null,
): { list: DailyNode[]; stale: string[] } {
  const prevByDate = new Map(prev.map((d) => [d.date, d]));
  const stale: string[] = [];
  const list = rows.map((row) => {
    const old = prevByDate.get(row.date);
    if (!old || old.bodyLoaded === false) return row;
    if (old.updatedAt === row.updatedAt) {
      return { ...row, content: old.content, bodyLoaded: true };
    }
    if (row.date === openDate) {
      stale.push(row.date);
      return { ...row, content: old.content, bodyLoaded: true };
    }
    return row;
  });
  return { list, stale };
}

/**
 * Fill the light rows whose head could not be read (`headContent`
 * undefined) with the bodies fetched for them, so their excerpt is the same
 * as before (#2325). Those rows count as loaded from then on.
 */
export function fillDailyBodies(
  rows: readonly DailyNode[],
  bodies: Readonly<Record<string, string>>,
): DailyNode[] {
  return rows.map((row) => {
    const body = bodies[row.id];
    if (row.bodyLoaded !== false || body === undefined) return row;
    return { ...row, content: body, bodyLoaded: true };
  });
}

/**
 * The light rows that need their whole body for an excerpt: no readable head
 * (a legacy plain-text body, or none), or a head that is all 朝刊 / 宣言 —
 * cut at DAILY_HEAD_BLOCKS before the day's own text begins, so the head
 * alone would show no excerpt where the whole body shows one.
 */
export function rowsWithoutHead(rows: readonly DailyNode[]): string[] {
  return rows
    .filter((row) => {
      if (row.bodyLoaded !== false) return false;
      if (row.headContent === undefined) return true;
      return (
        headBlockCount(row.headContent) >= DAILY_HEAD_BLOCKS &&
        readDailyText(row.headContent) === null
      );
    })
    .map((row) => row.id);
}

function headBlockCount(headContent: string): number {
  try {
    const doc = JSON.parse(headContent) as { content?: unknown };
    return Array.isArray(doc.content) ? doc.content.length : 0;
  } catch {
    return 0;
  }
}
