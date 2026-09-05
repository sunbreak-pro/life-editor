import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAttachmentsService } from "../src/services/SupabaseAttachmentsService";
import {
  ATTACHMENT_MAX_BYTES,
  isEmbeddableImage,
  formatAttachmentSize,
} from "../src/constants/attachments";

/*
 * #1404 — editor attachments over Storage.
 *
 * The rule worth pinning here is the OBJECT NAMING one. Migration 0027
 * authorises a row only when the first path segment equals `auth.uid()`, so
 * `<uid>/<uuid>.<ext>` is not a formatting preference — get it wrong and every
 * upload fails with a policy error that says nothing about paths. These tests
 * are the half of that contract this repo can check; the other half is SQL the
 * user applies by hand.
 */

const UID = "11111111-2222-3333-4444-555555555555";

interface StubBucket {
  upload: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function makeClient(overrides: Partial<StubBucket> = {}) {
  const bucket: StubBucket = {
    upload: vi.fn(async () => ({ data: { path: "x" }, error: null })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/x?token=abc" },
      error: null,
    })),
    remove: vi.fn(async () => ({ data: [], error: null })),
    ...overrides,
  };
  const from = vi.fn(() => bucket);
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: UID } }, error: null }),
    },
    storage: { from },
  } as unknown as SupabaseClient;
  return { client, bucket, from };
}

/** A stand-in for a picked file; only the four fields the service reads. */
function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as unknown as File;
}

describe("attachment constants (#1404)", () => {
  it("embeds raster images inline but hands SVG to the file chip", () => {
    expect(isEmbeddableImage("image/png")).toBe(true);
    expect(isEmbeddableImage("image/jpeg")).toBe(true);
    expect(isEmbeddableImage("image/webp")).toBe(true);
    // An SVG is a document that can carry script and external references, so
    // it is offered as a download rather than rendered into the note.
    expect(isEmbeddableImage("image/svg+xml")).toBe(false);
    expect(isEmbeddableImage("application/pdf")).toBe(false);
    expect(isEmbeddableImage("")).toBe(false);
  });

  it("formats sizes the way a file manager does", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2 KB");
    expect(formatAttachmentSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    // Nothing to say rather than "NaN B" under the chip.
    expect(formatAttachmentSize(Number.NaN)).toBe("");
  });
});

describe("SupabaseAttachmentsService (#1404)", () => {
  it("writes under the caller's uid, which is what the bucket policy checks", async () => {
    const { client, bucket, from } = makeClient();
    const svc = new SupabaseAttachmentsService(client);

    const ref = await svc.uploadAttachment(
      makeFile("shot.PNG", "image/png", 10),
    );

    expect(from).toHaveBeenCalledWith("attachments");
    const [path, file, options] = bucket.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${UID}/[0-9a-f-]{36}\\.png$`, "i"));
    expect(file).toBeDefined();
    expect(options).toEqual({ contentType: "image/png", upsert: false });
    // The ORIGINAL name survives in the reference, not in the object key —
    // it is what the chip and the img alt need.
    expect(ref).toEqual({
      path,
      name: "shot.PNG",
      mimeType: "image/png",
      size: 10,
    });
  });

  it("keeps a hostile or missing extension out of the object key", async () => {
    const { client, bucket } = makeClient();
    const svc = new SupabaseAttachmentsService(client);

    for (const name of [
      "no-extension",
      ".gitignore", // leading dot: the whole thing is the name
      "trailing.",
      "weird.this-is-not-an-extension",
      "escape.../../etc",
    ]) {
      bucket.upload.mockClear();
      await svc.uploadAttachment(makeFile(name, "application/octet-stream", 1));
      const path = bucket.upload.mock.calls[0][0] as string;
      expect(path).toMatch(new RegExp(`^${UID}/[0-9a-f-]{36}$`, "i"));
    }
  });

  it("falls back to a generic MIME type when the OS supplied none", async () => {
    const { client, bucket } = makeClient();
    const svc = new SupabaseAttachmentsService(client);
    const ref = await svc.uploadAttachment(makeFile("thing.dat", "", 5));
    expect(bucket.upload.mock.calls[0][2]).toEqual({
      contentType: "application/octet-stream",
      upsert: false,
    });
    expect(ref.mimeType).toBe("application/octet-stream");
  });

  it("refuses an oversized file WITHOUT spending the upload", async () => {
    const { client, bucket } = makeClient();
    const svc = new SupabaseAttachmentsService(client);

    await expect(
      svc.uploadAttachment(
        makeFile(
          "huge.bin",
          "application/octet-stream",
          ATTACHMENT_MAX_BYTES + 1,
        ),
      ),
    ).rejects.toThrow(/over the/);
    // The point of checking client-side: on a phone, letting the bucket's own
    // file_size_limit answer means sending every byte to be told no.
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it("surfaces a Storage error rather than returning a broken reference", async () => {
    const { client } = makeClient({
      upload: vi.fn(async () => ({
        data: null,
        error: { message: "new row violates row-level security policy" },
      })),
    });
    const svc = new SupabaseAttachmentsService(client);
    await expect(
      svc.uploadAttachment(makeFile("a.png", "image/png", 1)),
    ).rejects.toThrow(/row-level security/);
  });

  it("signs a read URL for a stored path", async () => {
    const { client, bucket } = makeClient();
    const svc = new SupabaseAttachmentsService(client);
    const url = await svc.getAttachmentUrl(`${UID}/abc.png`);
    expect(url).toBe("https://signed.example/x?token=abc");
    // One hour — long enough for an afternoon's reading, short enough that a
    // URL pasted somewhere by accident stops working the same day.
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(`${UID}/abc.png`, 3600);
  });

  it("throws when the URL cannot be signed", async () => {
    const { client } = makeClient({
      createSignedUrl: vi.fn(async () => ({
        data: null,
        error: { message: "Object not found" },
      })),
    });
    const svc = new SupabaseAttachmentsService(client);
    await expect(svc.getAttachmentUrl("gone.png")).rejects.toThrow(
      /Object not found/,
    );
  });

  it("deletes by path", async () => {
    const { client, bucket } = makeClient();
    const svc = new SupabaseAttachmentsService(client);
    await svc.deleteAttachment(`${UID}/abc.png`);
    expect(bucket.remove).toHaveBeenCalledWith([`${UID}/abc.png`]);
  });
});
