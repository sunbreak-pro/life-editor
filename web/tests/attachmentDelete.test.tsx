import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import type { AttachmentWiring } from "../src/notes/useAttachmentUpload";

/*
 * #1606 — the file chip spans the body column and carries its own delete.
 *
 * Two halves, verified two ways. The BEHAVIOUR (a button exists, it takes out
 * exactly one node, it stays off a read-only surface) runs through the real
 * RichTextEditor, like attachmentNode / calloutNode next door. The SIZE cannot:
 * jsdom has no layout (CLAUDE.md §7.1), so `getBoundingClientRect()` is 0 for
 * everything here and the widths quoted on the issue were measured in a
 * browser. What is asserted instead is the CLASS AND CSS CONTRACT that produces
 * them — the same shape fieldFontFloorLockstep.test.ts uses to pin a floor that
 * lives in a stylesheet.
 */

const FILE = {
  path: "uid/def.pdf",
  name: "invoice.pdf",
  mime: "application/pdf",
  size: 1024,
};

function docWithAttachment(attrs: typeof FILE) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
      { type: "attachment", attrs },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  });
}

function makeWiring(): AttachmentWiring {
  return {
    attach: vi.fn(async () => null),
    resolveUrl: vi.fn(async () => "https://signed.example/def?token=1"),
  };
}

function renderEditor(options: {
  editable?: boolean;
  onUpdate?: (json: string) => void;
  attrs?: typeof FILE;
}) {
  return render(
    <RichTextEditor
      noteId="note-1"
      initialContent={docWithAttachment(options.attrs ?? FILE)}
      onUpdate={options.onUpdate ?? (() => {})}
      editable={options.editable}
      attachments={makeWiring()}
    />,
  );
}

const deleteButton = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>("button.note-attachment__delete");

describe("attachment delete button (#1606)", () => {
  it("gives the file chip a delete button named after the file", async () => {
    const { container } = renderEditor({});

    await waitFor(() => expect(deleteButton(container)).not.toBeNull());
    const button = deleteButton(container);
    // The name is IN the accessible name: a screen reader hearing five
    // "Remove attachment" buttons in a row learns nothing from any of them.
    expect(button?.getAttribute("aria-label")).toBe(
      "Remove attachment: invoice.pdf",
    );
    // A real button, so Tab reaches it and Enter / Space fire it. It is also
    // NOT inside the download anchor — a control nested in a link is invalid
    // HTML and gives the keyboard two overlapping targets.
    expect(button?.type).toBe("button");
    expect(button?.closest("a")).toBeNull();
  });

  it("takes out that node only, leaving the blocks around it", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor({ onUpdate });

      const button = deleteButton(container);
      expect(button).not.toBeNull();
      act(() => button?.click());
      act(() => void vi.advanceTimersByTime(800));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string) as {
        content: { type: string }[];
      };
      expect(saved.content.some((n) => n.type === "attachment")).toBe(false);
      // Both paragraphs survive, in order. Deleting by the node's own range is
      // what keeps a neighbouring block from being swept up with it.
      expect(JSON.stringify(saved)).toContain("before");
      expect(JSON.stringify(saved)).toContain("after");
      expect(saved.content).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows no delete on a read-only surface", async () => {
    // A briefing or template preview passes editable={false}: a delete button
    // there is a button that cannot do anything.
    const { container } = renderEditor({ editable: false });

    await waitFor(() =>
      expect(container.querySelector("a.note-attachment__file")).not.toBeNull(),
    );
    expect(deleteButton(container)).toBeNull();
  });

  it("leaves the image alone — #1606 is the file chip", async () => {
    const { container } = renderEditor({
      attrs: {
        path: "uid/abc.png",
        name: "shot.png",
        mime: "image/png",
        size: 2048,
      },
    });

    await waitFor(() =>
      expect(
        container.querySelector("img.note-attachment__image"),
      ).not.toBeNull(),
    );
    expect(deleteButton(container)).toBeNull();
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(here, "../src/index.css"), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** The declarations of one selector's block, as written. */
function block(selector: string): string {
  const at = indexCss.indexOf(selector + " {");
  if (at < 0) throw new Error("no rule for " + selector);
  return indexCss.slice(at, indexCss.indexOf("}", at));
}

describe("#1606 — the chip's width and the button's 44px live in index.css", () => {
  it("makes the chip a full-width row instead of an inline pill", () => {
    const chip = block(".note-editor .ProseMirror .note-attachment__file");
    // `inline-flex` was the bug: the chip was as wide as its file name.
    expect(chip).toContain("display: flex");
    expect(chip).not.toContain("inline-flex");
    expect(chip).toContain("width: 100%");
  });

  it("floors the delete button at 44x44 and parks it at the right edge", () => {
    const button = block(".note-editor .ProseMirror .note-attachment__delete");
    // 2.75rem = 44px, the touch floor from mobile-scope.md. Unconditional here
    // (not `max-md:`) — see the rule's own note.
    expect(button).toContain("width: 2.75rem");
    expect(button).toContain("height: 2.75rem");
    expect(button).toContain("position: absolute");
    expect(button).toContain("right: 0");
    // The chip has to be tall enough to hold it, or the button would reach into
    // the lines above and below.
    expect(
      block(".note-editor .ProseMirror .note-attachment__file"),
    ).toContain("min-height: 2.75rem");
  });

  it("colours everything it draws from lumen tokens", () => {
    const rules = [
      ".note-editor .ProseMirror .note-attachment__delete",
      ".note-editor .ProseMirror .note-attachment__delete:hover",
      ".note-editor .ProseMirror .note-attachment__delete:focus-visible",
    ].map(block);
    for (const rule of rules) {
      // No hex, rgb() or hsl() literal anywhere in the new chrome.
      expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    }
    expect(rules.join("\n")).toContain("var(--color-text-tertiary)");
    expect(rules.join("\n")).toContain("var(--color-accent)");
  });
});
