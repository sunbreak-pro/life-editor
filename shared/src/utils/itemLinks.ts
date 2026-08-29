/*
 * Item↔item link helpers over the unified `wiki_tag_connections` model.
 *
 * These two moved here from `components/Connect/graph/buildGraphModel.ts` when
 * the Connect section and its force-directed graph were retired (#1152). They
 * never depended on the graph — only on `WikiTagConnection` — so the graph
 * going away is no reason for them to go with it. The DATA (tags, item links,
 * search) was explicitly kept alive by that retirement; this is the part of
 * the reading side that was worth keeping.
 *
 * Note for whoever needs backlinks next: `web/src/wikitag/LinkPanel.tsx` does
 * NOT use these. It reads both directions out of the WikiTagsUnifiedProvider's
 * bulk cache (`getLinksForItem`), which is one query per table for a whole
 * list instead of two per row. Reach for these when you have the raw
 * `connections` array in hand already and want a derivation off it, not when
 * you are inside a component that can just consume the context.
 */
import type { WikiTagConnection } from "../types/wikiTagUnified";

/**
 * Client-side backlinks: every item that links TO `itemId`. Derived from an
 * already-fetched `connections` array so no per-selection fetch is needed (the
 * caller may alternatively call `listLinksToItem(itemId)`; this matches that
 * shape).
 */
export function backlinkSourceIds(
  itemId: string,
  connections: WikiTagConnection[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of connections) {
    if (c.isDeleted) continue;
    if (c.toItemId !== itemId) continue;
    if (seen.has(c.fromItemId)) continue;
    seen.add(c.fromItemId);
    out.push(c.fromItemId);
  }
  return out;
}

/**
 * Resolve the id of the active (non-deleted) directed link `fromId → toId`,
 * or `null` when no such link exists. Direction matters: the reverse pair
 * `(toId, fromId)` is a different link and yields `null` here — which is what
 * makes this usable to map a rendered neighbour row back to the
 * `wiki_tag_connections.id` that `deleteItemLink` expects.
 */
export function resolveLinkId(
  fromId: string,
  toId: string,
  connections: WikiTagConnection[],
): string | null {
  for (const c of connections) {
    if (c.isDeleted) continue;
    if (c.fromItemId === fromId && c.toItemId === toId) return c.id;
  }
  return null;
}
