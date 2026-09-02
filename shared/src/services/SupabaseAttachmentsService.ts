import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachmentRef, AttachmentsDataService } from "./DataService";
import {
  ATTACHMENTS_BUCKET,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_URL_TTL_SECONDS,
} from "../constants/attachments";
import {
  collectAttachmentPaths,
  selectOrphans,
  type AttachmentOrphanScan,
  type StoredAttachment,
} from "./attachmentOrphans";
import { getAuthedUserId } from "./supabaseServiceHelpers";

/*
 * Editor attachments over Supabase Storage (#1404).
 *
 * The only domain in this package whose I/O is Storage rather than PostgREST,
 * so it owns no table and no mapper. What it does own is the object NAMING
 * rule, and that rule is load-bearing: every object is written under
 * `<uid>/<uuid>.<ext>`, because the bucket's policies (migration 0027) authorise
 * a row only when the FIRST PATH SEGMENT equals `auth.uid()`. Change the shape
 * here and every upload starts failing with a policy error.
 *
 * WHY A UUID AND NOT THE FILENAME. Two reasons, and only the second is about
 * safety. A user picks `IMG_0001.png` from a phone roll ten times a week, and
 * per-user paths would collide on all of them; a uuid cannot. And a filename
 * is user input on its way into a URL path — `../`, control characters, a
 * 300-character name — so not putting it there at all beats sanitising it.
 * The real name is kept in the document node's attrs, which is where it is
 * actually needed (the download chip's label).
 *
 * PRIVATE BUCKET, SIGNED READS. `sounds` (W3-C) is public because its objects
 * are five ambient loops shipped to everyone. These are the user's own notes:
 * a screenshot pasted into a private journal must not be readable by URL
 * alone. So reads go through `createSignedUrl`, and the DOCUMENT stores the
 * path — never the URL, which expires (see ATTACHMENT_URL_TTL_SECONDS).
 */

/** Extension for the stored object, dot included, or "" when there is none. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  // No dot, a leading dot (".gitignore" is all name), or a trailing one.
  if (dot <= 0 || dot === fileName.length - 1) return "";
  const ext = fileName.slice(dot + 1);
  // Anything that is not a plain alphanumeric run is not worth carrying into
  // an object key; the MIME type is what actually types the file downstream.
  if (!/^[A-Za-z0-9]{1,10}$/.test(ext)) return "";
  return `.${ext.toLowerCase()}`;
}

export class SupabaseAttachmentsService implements AttachmentsDataService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Upload one file and return what the document needs to reference it.
   *
   * Rejects an oversized file BEFORE the request rather than letting the
   * bucket's own `file_size_limit` do it: the bucket answers after the bytes
   * have been sent, which on a phone is the whole upload spent to be told no.
   */
  async uploadAttachment(file: File): Promise<AttachmentRef> {
    if (file.size > ATTACHMENT_MAX_BYTES) {
      throw new Error(
        `uploadAttachment failed: file is ${file.size} bytes, over the ${ATTACHMENT_MAX_BYTES} limit`,
      );
    }
    const uid = await getAuthedUserId(this.client);
    // `contentType` is what a later signed GET replays in its response header,
    // and it is what decides whether the browser shows a PNG or downloads it.
    // An empty `file.type` (some OSes hand one over for unknown extensions)
    // becomes the generic binary type rather than being left for Storage to
    // guess from a key that no longer carries the original name.
    const mimeType = file.type || "application/octet-stream";
    const path = `${uid}/${crypto.randomUUID()}${extensionOf(file.name)}`;
    const { error } = await this.client.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: mimeType, upsert: false });
    if (error) {
      throw new Error(`uploadAttachment failed: ${error.message}`);
    }
    return { path, name: file.name, mimeType, size: file.size };
  }

  /**
   * A time-limited read URL for a stored object.
   *
   * Unlike `getSoundAssetUrl` next door this is a real round trip — a signature
   * comes from the server — so callers resolve it once per render of the node
   * that shows it, not once per repaint.
   */
  async getAttachmentUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(path, ATTACHMENT_URL_TTL_SECONDS);
    if (error) {
      throw new Error(`getAttachmentUrl failed: ${error.message}`);
    }
    return data.signedUrl;
  }

  /**
   * Delete a stored object.
   *
   * Nothing calls this on a note edit: removing an image from the document
   * leaves the object behind, because an undo would otherwise resurrect a node
   * pointing at bytes that no longer exist. It is here for the deliberate
   * cleanup path, and for tests that must not leave objects in the bucket.
   */
  async deleteAttachment(path: string): Promise<void> {
    const { error } = await this.client.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([path]);
    if (error) {
      throw new Error(`deleteAttachment failed: ${error.message}`);
    }
  }
  /**
   * Dry run for the cleanup sweep: the objects no stored document mentions
   * (#1438). Reads only — deleting is the caller's second, confirmed step,
   * one `deleteAttachment` per row.
   *
   * THE ORDER OF THE TWO READS IS THE SAFETY ARGUMENT, so it is not free to
   * change. Listing the bucket FIRST and reading the documents SECOND means
   * an upload that happens mid-scan is safe either way: land it before the
   * listing and the document read that follows still sees the note that
   * references it; land it after, and the object is simply not in the listing
   * to be judged. Reading the documents first would invert exactly that —
   * a file attached between the two reads would look like an orphan, and the
   * "orphan" would be an image the user is looking at.
   */
  async findOrphanAttachments(): Promise<AttachmentOrphanScan> {
    const uid = await getAuthedUserId(this.client);
    const objects = await this.listOwnObjects(uid);
    const referenced = await this.collectReferencedPaths();
    return selectOrphans(objects, referenced, Date.now());
  }

  /**
   * Every object under the caller's own prefix.
   *
   * Listing `<uid>` rather than the bucket root is not an optimisation: the
   * bucket policies (migration 0027) authorise a row only when the first path
   * segment is the caller's uid, so the root listing of a shared bucket is
   * empty anyway. Paging is by `offset` because that is what Storage offers;
   * a page shorter than the limit is the end.
   */
  private async listOwnObjects(uid: string): Promise<StoredAttachment[]> {
    const found: StoredAttachment[] = [];
    for (let offset = 0; ; offset += STORAGE_PAGE) {
      const { data, error } = await this.client.storage
        .from(ATTACHMENTS_BUCKET)
        .list(uid, {
          limit: STORAGE_PAGE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
      if (error) {
        throw new Error(`findOrphanAttachments failed: ${error.message}`);
      }
      const rows = (data ?? []) as StorageListRow[];
      for (const row of rows) {
        // Storage lists a nested prefix as a row with a null id, and writes a
        // hidden `.emptyFolderPlaceholder` object to keep an empty one alive.
        // Neither is a file the user attached, and the placeholder is the one
        // object in here whose deletion would actually break something.
        if (!row.name || row.id == null || row.name.startsWith(".")) continue;
        found.push({
          path: `${uid}/${row.name}`,
          size: Number(row.metadata?.size ?? 0) || 0,
          uploadedAt: row.created_at ?? row.updated_at ?? null,
        });
      }
      if (rows.length < STORAGE_PAGE) return found;
    }
  }

  /**
   * The set of paths every stored document body mentions.
   *
   * Reads the ONE column that matters straight off the payload tables instead
   * of going through the note reads next door, for two reasons: the note list
   * query deliberately omits `content_json` (it is the heavy column), and the
   * per-id read would be one round trip per note. This also picks up the rows
   * those lists filter out on purpose — trashed notes, templates, legacy
   * folder rows — which is the correct behaviour here: a restorable note's
   * images are not garbage.
   */
  private async collectReferencedPaths(): Promise<Set<string>> {
    const referenced = new Set<string>();
    for (const table of ATTACHMENT_BODY_TABLES) {
      for (let offset = 0; ; offset += PAYLOAD_PAGE) {
        const { data, error } = await this.client
          .from(table)
          .select("content_json")
          // Ordered because it is PAGED. PostgREST gives no stable row order
          // of its own, so an unordered second page can repeat rows from the
          // first and skip others — and a skipped row is a note whose images
          // this sweep would then call unreferenced.
          .order("item_id", { ascending: true })
          .range(offset, offset + PAYLOAD_PAGE - 1);
        if (error) {
          throw new Error(
            `findOrphanAttachments failed: ${table} read failed: ${error.message}`,
          );
        }
        const rows = (data ?? []) as { content_json: unknown }[];
        for (const row of rows) {
          for (const path of collectAttachmentPaths(row.content_json)) {
            referenced.add(path);
          }
        }
        if (rows.length < PAYLOAD_PAGE) break;
      }
    }
    return referenced;
  }
}

/**
 * The payload tables whose `content_json` can hold an attachment node.
 *
 * Notes are where the slash entries are wired (#1404); dailies are here
 * because the node is registered on every editor surface, so a paste can
 * carry one into a day's body. Scanning a table that turns out to hold none
 * costs one query and cannot delete anything; MISSING one deletes files a
 * document is using, so the list errs long rather than short.
 */
const ATTACHMENT_BODY_TABLES = ["notes_payload", "dailies_payload"] as const;

/** Rows per Storage listing page. */
const STORAGE_PAGE = 100;

/** Rows per payload page — PostgREST's own default ceiling for one request. */
const PAYLOAD_PAGE = 1000;

/** The fields this file reads off a Storage listing row. */
interface StorageListRow {
  name: string;
  /** Null for a nested prefix ("folder") rather than a stored object. */
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
}

export const PHASE2_ATTACHMENT_METHOD_NAMES = [
  "uploadAttachment",
  "getAttachmentUrl",
  "deleteAttachment",
  "findOrphanAttachments",
] as const;

export type AttachmentMethodName =
  (typeof PHASE2_ATTACHMENT_METHOD_NAMES)[number];

export const PHASE2_ATTACHMENT_METHODS: ReadonlySet<string> = new Set(
  PHASE2_ATTACHMENT_METHOD_NAMES,
);
