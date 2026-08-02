import type { WikiTagConnection } from "../types/wikiTagUnified";

/*
 * Inline "[[ ]]" link delete-sync helpers (#372).
 *
 * A resolved "[[ ]]" link in a document body is mirrored into the
 * wiki_tag_connections graph with origin "inline" at insert time. These pure
 * helpers close the other half of the loop: given the body a save just
 * persisted, find the inline-origin edges whose link is no longer in the text
 * so the caller can soft-delete exactly those — manual edges (LinkPanel /
 * Connect) are never touched.
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
