import { describe, it, expect, vi } from "vitest";
import type { Editor, Range } from "@tiptap/core";
import {
  buildSlashItems,
  type SlashMenuLabels,
} from "../src/notes/slashCommand";
import type { AttachmentWiring } from "../src/notes/useAttachmentUpload";
import type { AttachmentRef } from "@life-editor/shared";

/*
 * #1404 — the two attach entries in the "/" menu.
 *
 * Two rules are worth a test. The first is GATING: a surface that wired no
 * uploader must not offer a picker that uploads nowhere. The second is ORDER —
 * the node is inserted only AFTER the upload lands, because a node inserted
 * first would be caught by the editor's 800ms auto-save and leave a note
 * permanently pointing at bytes that never arrived.
 */

const LABELS: SlashMenuLabels = {
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  bulletList: "Bullets",
  orderedList: "Numbers",
  taskList: "Todos",
  image: "Image",
  file: "File",
  empty: "No match",
};

const RANGE = { from: 1, to: 2 } as Range;

/**
 * A chainable stand-in for the editor. Only records; the real chain API is
 * exercised by the node-rendering suite, which mounts an actual editor.
 */
function makeEditor() {
  const deleted: Range[] = [];
  const inserted: unknown[] = [];
  const chain = () => {
    const api = {
      focus: () => api,
      deleteRange: (range: Range) => {
        deleted.push(range);
        return api;
      },
      insertContent: (content: unknown) => {
        inserted.push(content);
        return api;
      },
      run: () => true,
    };
    return api;
  };
  const editor = { chain, isDestroyed: false } as unknown as Editor;
  return { editor, deleted, inserted };
}

const REF: AttachmentRef = {
  path: "uid/abc.png",
  name: "shot.png",
  mimeType: "image/png",
  size: 4096,
};

function makeWiring(attach: AttachmentWiring["attach"]): AttachmentWiring {
  return { attach, resolveUrl: async () => "https://signed.example/x" };
}

describe("slash menu attach entries (#1404)", () => {
  it("offers nothing to attach when the host wired no uploader", () => {
    const ids = buildSlashItems(LABELS).map((i) => i.id);
    expect(ids).not.toContain("image");
    expect(ids).not.toContain("file");
    // The block entries are untouched by the gate.
    expect(ids).toEqual([
      "heading1",
      "heading2",
      "heading3",
      "bulletList",
      "orderedList",
      "taskList",
    ]);
  });

  it("adds image and file once an uploader is available", () => {
    const items = buildSlashItems(LABELS, () =>
      makeWiring(vi.fn(async () => null)),
    );
    expect(items.map((i) => i.id)).toContain("image");
    expect(items.map((i) => i.id)).toContain("file");
    expect(items.find((i) => i.id === "image")?.title).toBe("Image");
  });

  it("clears the typed query, then inserts the node only after the upload lands", async () => {
    let release!: (ref: AttachmentRef) => void;
    const pending = new Promise<AttachmentRef>((r) => {
      release = r;
    });
    const attach = vi.fn(() => pending);
    const { editor, deleted, inserted } = makeEditor();

    const image = buildSlashItems(LABELS, () => makeWiring(attach)).find(
      (i) => i.id === "image",
    );
    image?.command({ editor, range: RANGE });

    // The "/image" text is gone immediately — the wait must not leave it on
    // screen — but nothing is in the document yet.
    expect(deleted).toEqual([RANGE]);
    expect(attach).toHaveBeenCalledWith("image");
    expect(inserted).toEqual([]);

    release(REF);
    await pending;
    await Promise.resolve();

    expect(inserted).toEqual([
      {
        type: "attachment",
        attrs: {
          path: "uid/abc.png",
          name: "shot.png",
          mime: "image/png",
          size: 4096,
        },
      },
    ]);
  });

  it("opens the file picker unfiltered for the file entry", async () => {
    const attach = vi.fn(async () => null);
    const { editor } = makeEditor();
    buildSlashItems(LABELS, () => makeWiring(attach))
      .find((i) => i.id === "file")
      ?.command({ editor, range: RANGE });
    expect(attach).toHaveBeenCalledWith("file");
  });

  it("inserts nothing when the user cancels the picker", async () => {
    const attach = vi.fn(async () => null);
    const { editor, inserted, deleted } = makeEditor();
    buildSlashItems(LABELS, () => makeWiring(attach))
      .find((i) => i.id === "image")
      ?.command({ editor, range: RANGE });
    await Promise.resolve();
    await Promise.resolve();
    // The query is still cleared — cancelling should not leave "/image" typed.
    expect(deleted).toEqual([RANGE]);
    expect(inserted).toEqual([]);
  });

  it("inserts nothing when the user switched notes while the dialog was open", async () => {
    const attach = vi.fn(async () => REF);
    const { editor, inserted } = makeEditor();
    buildSlashItems(LABELS, () => makeWiring(attach))
      .find((i) => i.id === "image")
      ?.command({ editor, range: RANGE });
    // The note switch destroys the editor; insertContent on it would throw.
    (editor as unknown as { isDestroyed: boolean }).isDestroyed = true;
    await Promise.resolve();
    await Promise.resolve();
    expect(inserted).toEqual([]);
  });
});
