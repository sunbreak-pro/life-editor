import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  ITEM_LINK_KINDS,
  ITEM_LINK_VISUAL,
  UNKNOWN_ITEM_LINK_VISUAL,
  extractItemLinkTargets,
} from "@life-editor/shared";
import { createItemLinkNode } from "../src/notes/itemLinkNode";

/*
 * #2394 — the `[[…]]` chip is rendering only. Adding an icon to the node's DOM
 * must not reach what is stored, what is synced, or what a copy carries, and
 * the first thing that could go wrong is the parse path: parseHTML falls back
 * to the element's textContent, and the element now has children.
 *
 * The chip's click and icon contract lives in itemLinkClick.test.tsx. The
 * stylesheet half is pinned off the source text at the bottom of this file:
 * jsdom has no layout, so the line-height itself stays with the real browser.
 */

const STORED_DOC: JSONContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "see " },
        {
          type: "itemLink",
          attrs: { targetId: "note-2", label: "Other note", role: "note" },
        },
        { type: "text", text: " and " },
        {
          type: "itemLink",
          attrs: { targetId: null, label: "Nothing yet", role: null },
        },
      ],
    },
  ],
};

const editors: Editor[] = [];

function makeEditor(content: JSONContent | string): Editor {
  const editor = new Editor({
    extensions: [StarterKit, createItemLinkNode()],
    content,
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  while (editors.length > 0) editors.pop()?.destroy();
});

describe("the itemLink chip stays rendering only", () => {
  it("hands back the stored JSON untouched", () => {
    expect(makeEditor(STORED_DOC).getJSON()).toEqual(STORED_DOC);
  });

  it("yields the same inline link targets as the stored document", () => {
    const after = makeEditor(STORED_DOC).getJSON();

    expect(extractItemLinkTargets(JSON.stringify(after))).toEqual(
      extractItemLinkTargets(JSON.stringify(STORED_DOC)),
    );
    expect(extractItemLinkTargets(JSON.stringify(after))).toEqual(["note-2"]);
  });

  it("still writes [[label]] as its plain text", () => {
    expect(makeEditor(STORED_DOC).getText()).toBe(
      "see [[Other note]] and [[Nothing yet]]",
    );
  });

  it("survives its own rendered HTML, icon included", () => {
    const html = makeEditor(STORED_DOC).getHTML();
    expect(html).toContain("<svg");

    expect(makeEditor(html).getJSON()).toEqual(STORED_DOC);
  });

  // Older HTML has no data-label, so the label comes from textContent. The icon
  // has no text of its own, so reading the new markup that way gives the title.
  it("reads the title alone when data-label is missing", () => {
    const html = makeEditor(STORED_DOC)
      .getHTML()
      .replace(/ data-label="[^"]*"/g, "");

    expect(makeEditor(html).getJSON()).toEqual(STORED_DOC);
  });

  it("still parses the older chip with bare text and no icon", () => {
    const editor = makeEditor(
      '<p><span data-item-link="" data-target-id="note-2" data-role="note" data-label="Other note">Other note</span></p>',
    );

    expect(editor.getJSON().content?.[0]?.content?.[0]).toEqual({
      type: "itemLink",
      attrs: { targetId: "note-2", label: "Other note", role: "note" },
    });
  });

  it("round-trips through copy and paste", () => {
    const source = makeEditor(STORED_DOC);
    source.commands.selectAll();
    const { dom, text } = source.view.serializeForClipboard(
      source.state.selection.content(),
    );
    expect(text).toContain("[[Other note]]");

    const target = makeEditor({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    // jsdom has no ClipboardEvent, which pasteHTML would build by default.
    target.view.pasteHTML(dom.innerHTML, new Event("paste") as ClipboardEvent);

    expect(target.getJSON()).toEqual(STORED_DOC);
  });
});

describe("the itemLink chip's stylesheet", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const indexCss = readFileSync(resolve(here, "../src/index.css"), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  /** The declarations of the first rule whose selector is exactly `selector`. */
  function rule(selector: string): string {
    const at = indexCss.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return indexCss.slice(at, indexCss.indexOf("}", at));
  }

  /** `text-lumen-chip-task-dot` is `--color-chip-task-dot` in the stylesheet. */
  const tokenOf = (iconClass: string) =>
    `var(--color-${iconClass.replace(/^text-lumen-/, "")})`;

  it.each([...ITEM_LINK_KINDS])(
    "tints the %s icon with the token the header's chip uses",
    (kind) => {
      const declarations = rule(
        `.note-editor .ProseMirror .item-link[data-role="${kind}"] .item-link__icon`,
      );

      expect(declarations).toContain(
        `color: ${tokenOf(ITEM_LINK_VISUAL[kind].iconClass)};`,
      );
    },
  );

  it("tints a kind outside the four with the neutral token", () => {
    expect(rule(".note-editor .ProseMirror .item-link__icon")).toContain(
      `color: ${tokenOf(UNKNOWN_ITEM_LINK_VISUAL.iconClass)};`,
    );
  });

  // A kind's rule would otherwise beat the plain unresolved one on specificity.
  it("keeps an unresolved chip tertiary and dashed whatever its role", () => {
    const icon = rule(
      ".note-editor .ProseMirror .item-link.item-link--unresolved .item-link__icon",
    );
    expect(icon).toContain("color: var(--color-text-tertiary);");
    const chip = rule(".note-editor .ProseMirror .item-link--unresolved");
    expect(chip).toContain("border-style: dashed;");
    expect(chip).toContain("cursor: text;");
  });

  it("sets the chip into the line without touching the paragraph's height", () => {
    const chip = rule(".note-editor .ProseMirror .item-link");
    const body = rule(".note-editor .ProseMirror");

    expect(chip).toContain("display: inline-flex;");
    expect(chip).toContain("vertical-align: text-bottom;");
    expect(chip).toContain("box-sizing: border-box;");

    const height = /(?:^|\s)height: ([\d.]+)em;/.exec(chip);
    const lineHeight = /line-height: ([\d.]+);/.exec(body);
    expect(height).not.toBeNull();
    expect(lineHeight?.[1]).toBe("1.6");
    expect(Number(height?.[1])).toBeLessThan(Number(lineHeight?.[1]));
  });

  it("lets no underline survive from the old text link", () => {
    expect(rule(".note-editor .ProseMirror .item-link")).not.toContain(
      "text-decoration",
    );
  });
});
