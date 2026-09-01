import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import type { AttachmentWiring } from "../src/notes/useAttachmentUpload";

/*
 * #1404 — how a stored attachment DRAWS.
 *
 * Driven through the real RichTextEditor, the same way itemLinkClick does:
 * there is no layout to fake here either, because the node view resolves a URL
 * and assigns it to an element rather than mapping coordinates.
 *
 * The invariant these are really guarding is that the DOCUMENT holds a PATH,
 * never a URL. The bucket is private, so any URL in the note would expire —
 * which means every one of these renders has to reach the resolver, and a node
 * with no resolver has to degrade to something readable instead of a broken
 * image icon.
 */

function docWithAttachment(attrs: {
  path: string;
  name: string;
  mime: string;
  size: number;
}) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
      { type: "attachment", attrs },
    ],
  });
}

function makeWiring(
  resolveUrl: AttachmentWiring["resolveUrl"],
): AttachmentWiring {
  return { attach: vi.fn(async () => null), resolveUrl };
}

function renderEditor(content: string, attachments?: AttachmentWiring) {
  return render(
    <RichTextEditor
      noteId="note-1"
      initialContent={content}
      onUpdate={() => {}}
      attachments={attachments}
    />,
  );
}

const IMAGE = {
  path: "uid/abc.png",
  name: "screenshot.png",
  mime: "image/png",
  size: 2048,
};

describe("attachment node rendering (#1404)", () => {
  it("resolves a signed URL for an image and shows it, keyed by PATH", async () => {
    const resolveUrl = vi.fn(async () => "https://signed.example/abc?token=1");
    const { container } = renderEditor(
      docWithAttachment(IMAGE),
      makeWiring(resolveUrl),
    );

    await waitFor(() => {
      const img = container.querySelector("img.note-attachment__image");
      expect(img?.getAttribute("src")).toBe(
        "https://signed.example/abc?token=1",
      );
    });
    // The path is what the resolver is asked for — a URL was never stored.
    expect(resolveUrl).toHaveBeenCalledWith("uid/abc.png");
    // The file name is the alt text: a generic "image" would tell a screen
    // reader less than nothing.
    expect(
      container
        .querySelector("img.note-attachment__image")
        ?.getAttribute("alt"),
    ).toBe("screenshot.png");
  });

  it("draws a non-image as a download chip with its name and size", async () => {
    const { container } = renderEditor(
      docWithAttachment({
        path: "uid/def.pdf",
        name: "invoice.pdf",
        mime: "application/pdf",
        size: 1.5 * 1024 * 1024,
      }),
      makeWiring(async () => "https://signed.example/def?token=2"),
    );

    await waitFor(() => {
      const link = container.querySelector<HTMLAnchorElement>(
        "a.note-attachment__file",
      );
      expect(link?.getAttribute("href")).toBe(
        "https://signed.example/def?token=2",
      );
    });
    const link = container.querySelector<HTMLAnchorElement>(
      "a.note-attachment__file",
    );
    expect(link?.textContent).toContain("invoice.pdf");
    expect(link?.textContent).toContain("1.5 MB");
    expect(link?.getAttribute("download")).toBe("invoice.pdf");
    // Never navigate the app away from itself where `download` is not honoured.
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("hands an SVG to the download chip rather than rendering it inline", async () => {
    const { container } = renderEditor(
      docWithAttachment({
        path: "uid/ghi.svg",
        name: "diagram.svg",
        mime: "image/svg+xml",
        size: 900,
      }),
      makeWiring(async () => "https://signed.example/ghi?token=3"),
    );
    await waitFor(() => {
      expect(container.querySelector("a.note-attachment__file")).not.toBeNull();
    });
    expect(container.querySelector("img.note-attachment__image")).toBeNull();
  });

  it("opens the note without a schema error where no uploader is wired", async () => {
    // The reason the node is registered unconditionally: a note authored with
    // an image must still open on a surface that passes no `attachments`.
    const { container } = renderEditor(docWithAttachment(IMAGE));

    await waitFor(() => {
      const fallback = container.querySelector(".note-attachment__fallback");
      expect(fallback?.textContent).toContain("screenshot.png");
    });
    expect(container.querySelector("img")).toBeNull();
    // The rest of the document is intact — this is a degraded node, not a
    // failed parse.
    expect(container.textContent).toContain("before");
  });

  it("falls back when the URL cannot be signed (a deleted object)", async () => {
    const { container } = renderEditor(
      docWithAttachment(IMAGE),
      makeWiring(async () => {
        throw new Error("Object not found");
      }),
    );
    await waitFor(() => {
      expect(
        container.querySelector(".note-attachment__fallback"),
      ).not.toBeNull();
    });
  });
});
