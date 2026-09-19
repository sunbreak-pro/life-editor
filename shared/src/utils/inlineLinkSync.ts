import type { WikiTagConnection } from "../types/wikiTagUnified";

/*
 * Inline "[[ ]]" link sync helpers (#372, two-way since #1690).
 *
 * A resolved "[[ ]]" link in a document body is mirrored into the
 * wiki_tag_connections graph with origin "inline". These pure helpers let a
 * save reconcile the graph against the text it just stored, in BOTH
 * directions (#1690): drop the inline-origin edges whose link has left the
 * text, and add one for a link the text carries without an edge. Manual edges
 * (LinkPanel / Connect) are never deleted and never duplicated.
 *
 * No React, no DataService — unit-tested in shared/tests/inlineLinkSync.test.ts.
 */

interface TipTapNode {
  type?: string;
  attrs?: { targetId?: string | null };
  content?: TipTapNode[];
}

/**
 * Collect the distinct resolved `itemLink` target ids present in a stored
 * body. Returns null when the string is not a TipTap doc (legacy plain text
 * cannot carry link atoms, and an unparseable body must NOT read as "no links
 * left" — callers skip the delete-sync entirely on null).
 */
export function extractItemLinkTargets(content: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as TipTapNode).type !== "doc" ||
    !Array.isArray((parsed as TipTapNode).content)
  ) {
    return null;
  }
  const targets = new Set<string>();
  const walk = (node: TipTapNode): void => {
    // Unresolved links carry targetId null — no edge exists for them.
    if (node.type === "itemLink" && node.attrs?.targetId) {
      targets.add(node.attrs.targetId);
    }
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  (parsed as TipTapNode).content?.forEach(walk);
  return [...targets];
}

/**
 * The targets present in the body that have NO live edge out of `fromItemId`
 * yet — the other half of the sync (#1690).
 *
 * Until this existed the mirror ran in one place only: the moment a candidate
 * was picked (`onResolvedInserted`). Anything that put a link into the body
 * WITHOUT going through the picker — a Ctrl+Shift+Z that brings the node back,
 * a paste, a template — left the text holding a link the link list did not
 * know about, and no later save put it right.
 *
 * Edges of ANY origin count as present, matching the duplicate guard in
 * `useInlineItemLinks.mirrorInlineLink`: a pair the user linked by hand keeps
 * its manual origin (and with it the immunity to `findStaleInlineLinks` that
 * comes with it) instead of gaining a second, inline-origin edge beside it.
 *
 * Self-links are dropped here rather than at the call site, because
 * `createItemLink` rejects them and one link to yourself would otherwise fail
 * the whole save's sync.
 */
export function findMissingInlineLinks(
  connections: readonly WikiTagConnection[],
  fromItemId: string,
  presentTargetIds: readonly string[],
): string[] {
  const linked = new Set(
    connections
      .filter((l) => l.fromItemId === fromItemId && !l.isDeleted)
      .map((l) => l.toItemId),
  );
  return presentTargetIds.filter((id) => id !== fromItemId && !linked.has(id));
}

/**
 * The live inline-origin edges out of `fromItemId` whose target no longer
 * appears in the body. Manual edges and other items' edges are never returned.
 */
export function findStaleInlineLinks(
  connections: readonly WikiTagConnection[],
  fromItemId: string,
  presentTargetIds: readonly string[],
): WikiTagConnection[] {
  const present = new Set(presentTargetIds);
  return connections.filter(
    (l) =>
      l.fromItemId === fromItemId &&
      l.origin === "inline" &&
      !l.isDeleted &&
      !present.has(l.toItemId),
  );
}
