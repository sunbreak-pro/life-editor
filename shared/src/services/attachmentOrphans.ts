import { ATTACHMENT_NODE_TYPE } from "../constants/attachments";

/*
 * Orphan detection for the `attachments` bucket (#1438).
 *
 * THE PROBLEM. Deleting an image from a note removes the NODE, never the
 * object: an undo would otherwise resurrect a node pointing at bytes that no
 * longer exist (#1404 chose that trade deliberately). So the bucket only ever
 * grows, and on a 1 GB free plan it eventually has to be swept.
 *
 * THE ONLY SAFE DEFINITION of an orphan is "no stored document mentions this
 * path", and the two halves of that sentence are what this file owns: reading
 * paths OUT of a document body, and subtracting them from a listing. Both are
 * pure, because this is the part that must never be wrong — a false positive
 * here is an image silently gone from a note the user has not opened in a
 * month, which is the exact failure the whole feature exists to avoid.
 *
 * WHAT COUNTS AS A DOCUMENT: every row of `notes_payload` and
 * `dailies_payload`, with no `is_deleted` filter anywhere. A trashed note can
 * be restored, so the bytes it references are still live; a template is a
 * note the lists hide but the schema keeps. The rule is "the row exists,
 * therefore its references count" — which is also the rule that survives
 * somebody adding a sixth note-ish list next year.
 */

/** One object as the bucket listing describes it. */
export interface StoredAttachment {
  /** Full object key, `<uid>/<uuid>.<ext>` — what `deleteAttachment` wants. */
  path: string;
  /** Size in bytes, for the "you will free X" line. 0 when Storage omits it. */
  size: number;
  /** ISO timestamp of the upload, or null when the listing carried none. */
  uploadedAt: string | null;
}

/** What one dry run found. `scanned = orphans.length + referenced + recent`. */
export interface AttachmentOrphanScan {
  /** Objects nothing references and old enough to judge. Deletion candidates. */
  orphans: StoredAttachment[];
  /** Objects in the bucket at scan time. */
  scanned: number;
  /** Of those, how many a stored document still mentions. */
  referenced: number;
  /** Of those, how many were skipped for being too fresh (see the grace note). */
  recent: number;
}

/**
 * How new an object has to be to be left alone regardless of references.
 *
 * The scan reads a listing and then reads the documents, which is safe against
 * an upload that happens DURING the scan (see the ordering note in
 * SupabaseAttachmentsService). It is not safe against an upload whose note
 * never got saved at all — a tab closed in the second between the upload
 * finishing and the editor's 800ms autosave firing. An hour of grace covers
 * that gap by three orders of magnitude and costs only that a file attached
 * this morning cannot be swept until lunch.
 */
export const ORPHAN_GRACE_MS = 60 * 60 * 1000;

/**
 * Every attachment path referenced by one stored document body.
 *
 * Accepts what either side of the wire hands over: the parsed `jsonb` a
 * PostgREST read returns, or the JSON string a domain `content` field carries
 * (`contentJson.ts` converts between the two). Anything else — a legacy plain
 * text body, `null`, a string that is not JSON at all — has no attachment
 * nodes by construction and yields nothing.
 *
 * Walks EVERY value rather than only the `content` arrays a ProseMirror
 * document nests through. The walk is over a user's own note, so the cost is
 * trivial, and being exhaustive is what keeps a future node that carries
 * children somewhere else (a table cell, a nested list) from making a
 * referenced image look unreferenced.
 */
export function collectAttachmentPaths(body: unknown): string[] {
  const root = parseBody(body);
  if (root === undefined) return [];

  const found: string[] = [];
  // An explicit stack, not recursion: a deeply nested document should not be
  // able to blow the call stack of a sweep that decides what to delete.
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    const node = value as Record<string, unknown>;
    if (node.type === ATTACHMENT_NODE_TYPE) {
      const attrs = node.attrs;
      if (attrs !== null && typeof attrs === "object") {
        const path = (attrs as Record<string, unknown>).path;
        if (typeof path === "string" && path !== "") found.push(path);
      }
    }
    for (const child of Object.values(node)) stack.push(child);
  }
  return found;
}

/** JSON string, already-parsed jsonb, or nothing this function can read. */
function parseBody(body: unknown): unknown {
  if (body === null || body === undefined) return undefined;
  if (typeof body === "string") {
    // A legacy plain-text body is the common case here, and JSON.parse throws
    // on it. Cheaper and quieter than a try/catch around every note: only a
    // string that could be an object or an array is worth parsing at all.
    const trimmed = body.trim();
    if (trimmed === "" || !/^[[{]/.test(trimmed)) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }
  if (typeof body === "object") return body;
  return undefined;
}

/**
 * Split a listing into what may be deleted and the counts that explain why.
 *
 * `now` is injected rather than read from the clock so the grace window is
 * testable; callers pass `Date.now()`.
 */
export function selectOrphans(
  objects: readonly StoredAttachment[],
  referenced: ReadonlySet<string>,
  now: number,
): AttachmentOrphanScan {
  const orphans: StoredAttachment[] = [];
  let referencedCount = 0;
  let recent = 0;
  for (const object of objects) {
    if (referenced.has(object.path)) {
      referencedCount += 1;
      continue;
    }
    if (isTooFresh(object.uploadedAt, now)) {
      recent += 1;
      continue;
    }
    orphans.push(object);
  }
  return {
    orphans,
    scanned: objects.length,
    referenced: referencedCount,
    recent,
  };
}

/**
 * Inside the grace window?
 *
 * An unparseable or missing timestamp counts as FRESH. Storage always sends
 * one, so this branch means something unexpected happened — and the safe
 * reading of "I do not know how old this is" is "do not delete it".
 */
function isTooFresh(uploadedAt: string | null, now: number): boolean {
  if (uploadedAt === null) return true;
  const at = Date.parse(uploadedAt);
  if (Number.isNaN(at)) return true;
  return now - at < ORPHAN_GRACE_MS;
}
