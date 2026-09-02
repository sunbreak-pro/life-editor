import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttachmentRef, AttachmentsDataService } from "./DataService";
import {
  ATTACHMENTS_BUCKET,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_URL_TTL_SECONDS,
} from "../constants/attachments";
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
}

export const PHASE2_ATTACHMENT_METHOD_NAMES = [
  "uploadAttachment",
  "getAttachmentUrl",
  "deleteAttachment",
] as const;

export type AttachmentMethodName =
  (typeof PHASE2_ATTACHMENT_METHOD_NAMES)[number];

export const PHASE2_ATTACHMENT_METHODS: ReadonlySet<string> = new Set(
  PHASE2_ATTACHMENT_METHOD_NAMES,
);
