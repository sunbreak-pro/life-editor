import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseAttachmentsService } from "../src/services/SupabaseAttachmentsService";
import {
  collectAttachmentPaths,
  selectOrphans,
  ORPHAN_GRACE_MS,
  type StoredAttachment,
} from "../src/services/attachmentOrphans";

/*
 * #1438 — the sweep that deletes attachments nothing references.
 *
 * These tests exist for ONE failure mode: deleting a file a note is still
 * using. Every case below is a shape a real document can take (a nested list,
 * a trashed note, a legacy plain-text body) asked the same question — "is this
 * path still referenced?" — because the cost of answering "no" wrongly is an
 * image gone from a note the user has not opened in a month.
 */

const UID = "11111111-2222-3333-4444-555555555555";
const OLD = "2026-01-01T00:00:00.000Z";

/** A document body as `content_json` hands it over (already-parsed jsonb). */
function docWith(...paths: string[]): unknown {
  return {
    type: "doc",
    content: paths.map((path) => ({
      type: "attachment",
      attrs: { path, name: "x.png", mime: "image/png", size: 1 },
    })),
  };
}

describe("collectAttachmentPaths (#1438)", () => {
  it("reads paths out of a parsed document", () => {
    const paths = collectAttachmentPaths(
      docWith(`${UID}/a.png`, `${UID}/b.pdf`),
    );
    expect(paths.sort()).toEqual([`${UID}/a.png`, `${UID}/b.pdf`]);
  });

  it("reads the same paths out of the stringified form", () => {
    const json = JSON.stringify(docWith(`${UID}/a.png`));
    expect(collectAttachmentPaths(json)).toEqual([`${UID}/a.png`]);
  });

  it("finds a node nested anywhere, not only in the top-level content array", () => {
    const deep = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "blockquote",
                  content: [
                    { type: "attachment", attrs: { path: `${UID}/deep.png` } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(collectAttachmentPaths(deep)).toEqual([`${UID}/deep.png`]);
  });

  it("ignores bodies that cannot carry a node at all", () => {
    // A legacy plain-text daily, an empty body, a null column, a number.
    const bodies: unknown[] = [
      "just some text",
      "",
      null,
      undefined,
      42,
      "{not json",
    ];
    for (const body of bodies) {
      expect(collectAttachmentPaths(body)).toEqual([]);
    }
  });

  it("only counts the attachment node, and only a usable path", () => {
    const mixed = {
      type: "doc",
      content: [
        // Another node that happens to carry a `path` attribute.
        { type: "itemLink", attrs: { path: `${UID}/not-an-attachment.png` } },
        // An attachment whose path never got written.
        { type: "attachment", attrs: { path: "" } },
        { type: "attachment", attrs: {} },
        { type: "attachment", attrs: { path: `${UID}/real.png` } },
      ],
    };
    expect(collectAttachmentPaths(mixed)).toEqual([`${UID}/real.png`]);
  });
});

describe("selectOrphans (#1438)", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");
  const object = (
    path: string,
    uploadedAt: string | null,
  ): StoredAttachment => ({ path, size: 10, uploadedAt });

  it("keeps what is referenced, returns what is not, and counts both", () => {
    const scan = selectOrphans(
      [object(`${UID}/kept.png`, OLD), object(`${UID}/gone.png`, OLD)],
      new Set([`${UID}/kept.png`]),
      now,
    );
    expect(scan.orphans.map((o) => o.path)).toEqual([`${UID}/gone.png`]);
    expect(scan).toMatchObject({ scanned: 2, referenced: 1, recent: 0 });
  });

  it("leaves a just-uploaded object alone even when nothing references it", () => {
    // The note that will reference it may not have autosaved yet.
    const fresh = new Date(now - ORPHAN_GRACE_MS + 1000).toISOString();
    const stale = new Date(now - ORPHAN_GRACE_MS - 1000).toISOString();
    const scan = selectOrphans(
      [object(`${UID}/fresh.png`, fresh), object(`${UID}/stale.png`, stale)],
      new Set(),
      now,
    );
    expect(scan.orphans.map((o) => o.path)).toEqual([`${UID}/stale.png`]);
    expect(scan.recent).toBe(1);
  });

  it("treats an unreadable timestamp as too new to judge", () => {
    const scan = selectOrphans(
      [object(`${UID}/no-date.png`, null), object(`${UID}/bad.png`, "nope")],
      new Set(),
      now,
    );
    expect(scan.orphans).toEqual([]);
    expect(scan.recent).toBe(2);
  });

  it("accounts for every object it looked at", () => {
    const scan = selectOrphans(
      [
        object(`${UID}/a.png`, OLD),
        object(`${UID}/b.png`, OLD),
        object(`${UID}/c.png`, new Date(now).toISOString()),
      ],
      new Set([`${UID}/a.png`]),
      now,
    );
    expect(scan.orphans.length + scan.referenced + scan.recent).toBe(
      scan.scanned,
    );
  });
});

/** What the stub bucket and the stub payload tables should answer with. */
interface StubOptions {
  objects?: { name: string; id?: string | null; created_at?: string | null }[];
  notes?: unknown[];
  dailies?: unknown[];
  listError?: { message: string };
  tableError?: { message: string };
}

function makeClient(options: StubOptions = {}) {
  const objects = options.objects ?? [];
  const list = vi.fn(async () =>
    options.listError
      ? { data: null, error: options.listError }
      : {
          data: objects.map((o) => ({
            name: o.name,
            id: o.id === undefined ? "obj-id" : o.id,
            created_at: o.created_at === undefined ? OLD : o.created_at,
            updated_at: OLD,
            metadata: { size: 10 },
          })),
          error: null,
        },
  );
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        range: vi.fn(async () =>
          options.tableError
            ? { data: null, error: options.tableError }
            : {
                data: (table === "notes_payload"
                  ? (options.notes ?? [])
                  : (options.dailies ?? [])
                ).map((content_json) => ({ content_json })),
                error: null,
              },
        ),
      })),
    })),
  }));
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: UID } }, error: null }),
    },
    from,
    storage: { from: vi.fn(() => ({ list })) },
  } as unknown as SupabaseClient;
  return { client, list, from };
}

describe("SupabaseAttachmentsService.findOrphanAttachments (#1438)", () => {
  it("lists the caller's own prefix, which is what the bucket policy allows", async () => {
    const { client, list } = makeClient({ objects: [{ name: "a.png" }] });
    await new SupabaseAttachmentsService(client).findOrphanAttachments();
    expect(list).toHaveBeenCalledWith(
      UID,
      expect.objectContaining({ offset: 0 }),
    );
  });

  it("spares an object a TRASHED note still references", async () => {
    // The payload row of a soft-deleted note is still in the table, and the
    // scan reads the table without an is_deleted filter for exactly this
    // reason: restoring the note has to bring its picture back.
    const { client } = makeClient({
      objects: [{ name: "trashed.png" }, { name: "loose.png" }],
      notes: [docWith(`${UID}/trashed.png`)],
    });
    const scan = await new SupabaseAttachmentsService(
      client,
    ).findOrphanAttachments();
    expect(scan.orphans.map((o) => o.path)).toEqual([`${UID}/loose.png`]);
  });

  it("scans dailies as well as notes", async () => {
    const { client, from } = makeClient({
      objects: [{ name: "pasted.png" }],
      dailies: [docWith(`${UID}/pasted.png`)],
    });
    const scan = await new SupabaseAttachmentsService(
      client,
    ).findOrphanAttachments();
    expect(from).toHaveBeenCalledWith("notes_payload");
    expect(from).toHaveBeenCalledWith("dailies_payload");
    expect(scan.orphans).toEqual([]);
    expect(scan.referenced).toBe(1);
  });

  it("skips the folder rows and the hidden placeholder Storage lists", async () => {
    const { client } = makeClient({
      objects: [
        { name: ".emptyFolderPlaceholder", id: null },
        { name: "nested", id: null },
        { name: "real.png" },
      ],
    });
    const scan = await new SupabaseAttachmentsService(
      client,
    ).findOrphanAttachments();
    expect(scan.scanned).toBe(1);
    expect(scan.orphans.map((o) => o.path)).toEqual([`${UID}/real.png`]);
  });

  it("refuses to guess when a read fails", async () => {
    // A partial answer here would delete files whose references live in the
    // rows that did not come back, so both halves throw rather than degrade.
    const listBroken = makeClient({ listError: { message: "storage down" } });
    await expect(
      new SupabaseAttachmentsService(listBroken.client).findOrphanAttachments(),
    ).rejects.toThrow(/storage down/);

    const tableBroken = makeClient({
      objects: [{ name: "a.png" }],
      tableError: { message: "payload down" },
    });
    await expect(
      new SupabaseAttachmentsService(
        tableBroken.client,
      ).findOrphanAttachments(),
    ).rejects.toThrow(/payload down/);
  });
});
