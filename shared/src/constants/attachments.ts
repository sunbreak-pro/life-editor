/*
 * Editor attachment limits and helpers (#1404).
 *
 * The bytes live in the private Supabase Storage bucket `attachments`, never
 * in the repo (CLAUDE.md §9) and never in the note row: `notes_payload`
 * carries the TipTap document, and the document carries a storage PATH. That
 * split is what keeps a 3 MB screenshot out of every `listNotesUnified` read.
 *
 * THE $0 BUDGET is the reason there is a cap here at all. The Supabase free
 * plan gives 1 GB of file storage, 5 GB of egress a month, and refuses any
 * single upload over 50 MB (supabase.com/pricing, checked 2026-09-01). The
 * per-file cap below is deliberately far under that ceiling: at 10 MB a
 * hundred files fill the whole plan, which is the point at which the author
 * should be deciding what to keep rather than discovering it from a bill.
 * The bucket carries the same number as `file_size_limit` (migration 0027) so
 * a client that skips this check still cannot spend more than the plan allows.
 */

/**
 * The document node type an embedded image / file is stored as.
 *
 * Declared here rather than only in the TipTap extension because TWO packages
 * have to agree on it and they cannot import each other: `web` builds the node
 * with this name, and `shared`'s orphan sweep (#1438) recognises a reference
 * by it. A rename that touched only the extension would leave the sweep seeing
 * every attachment as unreferenced — i.e. deleting all of them.
 */
export const ATTACHMENT_NODE_TYPE = "attachment";

/** The private Storage bucket every editor attachment is written to. */
export const ATTACHMENTS_BUCKET = "attachments";

/** Largest single upload accepted, in bytes. See the $0 note in the header. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * How long a signed read URL stays valid, in seconds.
 *
 * The bucket is PRIVATE, so every render resolves a fresh URL rather than
 * storing one in the document — a URL in the document would either expire
 * (breaking the note) or have to be permanent (making the bucket effectively
 * public). An hour is long enough that a note left open all afternoon does not
 * lose its images mid-read, and short enough that a URL pasted somewhere by
 * accident stops working the same day.
 */
export const ATTACHMENT_URL_TTL_SECONDS = 60 * 60;

/** Accept filter for the "image" slash entry's file picker. */
export const ATTACHMENT_IMAGE_ACCEPT = "image/*";

/**
 * Does this MIME type render as a picture rather than as a download chip?
 *
 * SVG is deliberately excluded. An `.svg` is a document that can carry script
 * and external references, and the one place these are displayed is an
 * editor showing the user's own notes — so it is offered as a FILE (a chip
 * that downloads) rather than as an `<img>` the page renders inline. Every
 * other `image/*` type is inert pixels.
 */
export function isEmbeddableImage(mimeType: string): boolean {
  if (!mimeType.startsWith("image/")) return false;
  return !mimeType.startsWith("image/svg");
}

/**
 * A human-readable size, for the file chip's caption.
 *
 * Binary units (1024), matching what every desktop file manager shows, and one
 * decimal place above the KB step so "1.4 MB" does not round to "1 MB".
 */
export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
