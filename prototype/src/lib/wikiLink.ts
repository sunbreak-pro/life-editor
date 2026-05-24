import { getState } from "./mockStore";
import type { EntityId, ScheduleItemType } from "./types";

const LINK_RE = /\[\[([^\]]+)\]\]/g;

export type LinkTarget =
  | { kind: "note"; id: EntityId; title: string }
  | { kind: "daily"; id: EntityId; title: string }
  | { kind: ScheduleItemType; id: EntityId; title: string };

export function resolveLink(rawTitle: string): LinkTarget | null {
  const target = rawTitle.trim().toLowerCase();
  if (!target) return null;
  const s = getState();
  const notes = s.notes
    .filter((n) => !n.isDeleted && n.title.toLowerCase() === target)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (notes[0]) {
    return {
      kind: notes[0].kind === "daily" ? "daily" : "note",
      id: notes[0].id,
      title: notes[0].title,
    };
  }
  const items = s.scheduleItems
    .filter((i) => !i.isDeleted && i.title.toLowerCase() === target)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (items[0]) {
    return { kind: items[0].type, id: items[0].id, title: items[0].title };
  }
  return null;
}

export function suggestLinks(prefix: string, limit = 10): LinkTarget[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const s = getState();
  const matches: LinkTarget[] = [];
  for (const n of s.notes) {
    if (n.isDeleted) continue;
    if (n.title.toLowerCase().includes(p)) {
      matches.push({
        kind: n.kind === "daily" ? "daily" : "note",
        id: n.id,
        title: n.title,
      });
    }
  }
  for (const i of s.scheduleItems) {
    if (i.isDeleted) continue;
    if (i.title.toLowerCase().includes(p)) {
      matches.push({ kind: i.type, id: i.id, title: i.title });
    }
  }
  return matches.slice(0, limit);
}

export interface Backlink {
  fromEntityId: EntityId;
  fromTitle: string;
  fromKind: LinkTarget["kind"];
  matchedText: string;
  snippet: string;
}

const snippetAround = (body: string, idx: number, length: number): string => {
  const start = Math.max(0, idx - 30);
  const end = Math.min(body.length, idx + length + 30);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  return prefix + body.slice(start, end).replace(/\n/g, " ") + suffix;
};

export function findBacklinks(targetTitle: string): Backlink[] {
  const target = targetTitle.trim().toLowerCase();
  if (!target) return [];
  const s = getState();
  const result: Backlink[] = [];
  const scan = (
    body: string,
    fromId: EntityId,
    fromTitle: string,
    fromKind: LinkTarget["kind"],
  ) => {
    for (const m of body.matchAll(LINK_RE)) {
      if (m[1].trim().toLowerCase() === target) {
        result.push({
          fromEntityId: fromId,
          fromTitle,
          fromKind,
          matchedText: m[0],
          snippet: snippetAround(body, m.index ?? 0, m[0].length),
        });
      }
    }
  };
  for (const n of s.notes) {
    if (n.isDeleted) continue;
    scan(n.body, n.id, n.title, n.kind === "daily" ? "daily" : "note");
  }
  for (const i of s.scheduleItems) {
    if (i.isDeleted) continue;
    if (i.description) {
      scan(i.description, i.id, i.title, i.type);
    }
  }
  return result;
}
