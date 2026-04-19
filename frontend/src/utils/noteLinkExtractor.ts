import type { NoteLinkPayload } from "../types/noteLink";

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

/**
 * Walk a TipTap JSON document and return all noteLink nodes as NoteLinkPayloads.
 * Only nodes with a resolvable `targetNoteId` attr are emitted.
 */
export function extractNoteLinksFromTiptapJson(
  doc: unknown,
): NoteLinkPayload[] {
  const out: NoteLinkPayload[] = [];
  walk(doc as JsonNode | null | undefined, out);
  return out;
}

function walk(node: JsonNode | null | undefined, out: NoteLinkPayload[]) {
  if (!node || typeof node !== "object") return;
  if (node.type === "noteLink") {
    const attrs = node.attrs ?? {};
    const targetNoteId = attrs.targetNoteId;
    if (typeof targetNoteId === "string" && targetNoteId.length > 0) {
      out.push({
        targetNoteId,
        targetHeading:
          typeof attrs.heading === "string" && attrs.heading.length > 0
            ? attrs.heading
            : null,
        targetBlockId:
          typeof attrs.blockId === "string" && attrs.blockId.length > 0
            ? attrs.blockId
            : null,
        alias:
          typeof attrs.alias === "string" && attrs.alias.length > 0
            ? attrs.alias
            : null,
        linkType: attrs.embed === true ? "embed" : "inline",
      });
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, out);
  }
}
