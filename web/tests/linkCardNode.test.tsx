import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { RichTextEditor } from "../src/notes/RichTextEditor";
import {
  describeUrl,
  isStandaloneUrl,
  safeHref,
} from "../src/notes/linkCardNode";

/*
 * #1607 — a URL alone in a paragraph becomes a block, and that block survives
 * being saved and reopened.
 *
 * The round trip is the whole point of the issue, and it is what a node like
 * this gets wrong: a document holding a node the schema does not know is
 * rejected WHOLE by `enableContentCheck: true`, RichTextEditor only logs that,
 * and the autosave 800ms later writes the resulting blank over the real body
 * (#1521, the same bug for callouts). So the node is registered unconditionally
 * and these tests open a stored card on a surface wired with nothing.
 *
 * Driven through the real RichTextEditor like attachmentNode / calloutNode next
 * door — the schema check, the paste handler and getJSON() are plain
 * ProseMirror work with no coordinate pipeline in them, so jsdom's missing
 * layout (#475) is not in the way. The WIDTHS are the exception and are pinned
 * off the stylesheet at the bottom of this file, the way
 * fieldFontFloorLockstep.test.ts pins a floor it cannot measure.
 */

const URL_IN_DOC = "https://example.com/docs/guide?page=2";

function docWithCard(href = URL_IN_DOC) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
      { type: "linkCard", attrs: { href } },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  });
}

/** An empty paragraph, which is what a paste has to land in to convert. */
const EMPTY_DOC = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function renderEditor(
  content: string,
  onUpdate: (json: string) => void = () => {},
  editable?: boolean,
) {
  return render(
    <RichTextEditor
      noteId="note-1"
      initialContent={content}
      onUpdate={onUpdate}
      editable={editable}
    />,
  );
}

/** A real document change: ProseMirror's own splitBlock through its keymap. */
function edit(container: HTMLElement) {
  const dom = container.querySelector<HTMLElement>(".tiptap");
  if (!dom) throw new Error("editor did not mount");
  act(() => {
    dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/**
 * A paste of plain text. jsdom has no ClipboardEvent, so the event carries a
 * hand-built `clipboardData` — which is all prosemirror-view reads from it.
 */
function paste(container: HTMLElement, text: string) {
  const dom = container.querySelector<HTMLElement>(".tiptap");
  if (!dom) throw new Error("editor did not mount");
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      types: ["text/plain"],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  });
  act(() => {
    dom.dispatchEvent(event);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("link card round trip (#1607)", () => {
  it("opens a stored card and draws the host and the path", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderEditor(docWithCard());

    await waitFor(() =>
      expect(container.querySelector(".note-link-card")).not.toBeNull(),
    );
    expect(container.querySelector(".note-link-card__host")?.textContent).toBe(
      "example.com",
    );
    expect(container.querySelector(".note-link-card__path")?.textContent).toBe(
      "/docs/guide?page=2",
    );
    // The paragraphs around it survive — a schema rejection takes the whole
    // document, not just the node it choked on.
    expect(container.textContent).toContain("before");
    expect(container.textContent).toContain("after");
    expect(warn).not.toHaveBeenCalledWith(
      "[web RichTextEditor] TipTap content schema error",
      expect.anything(),
      expect.anything(),
    );
  });

  it("keeps the card and its href through a save", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor(docWithCard(), onUpdate);

      edit(container);
      act(() => void vi.advanceTimersByTime(800));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string) as {
        content: { type: string; attrs?: { href?: string } }[];
      };
      const card = saved.content.find((n) => n.type === "linkCard");
      expect(card).toBeDefined();
      // The URL is stored EXACTLY as written — the card derives host and path
      // at draw time rather than keeping a second, staleable copy of them.
      expect(card?.attrs?.href).toBe(URL_IN_DOC);
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens on a surface wired with nothing at all", async () => {
    // The reason the node is registered unconditionally: the briefing preview
    // and the Kanban todo body pass no props, and a note authored in the Notes
    // editor still has to open there.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderEditor(docWithCard(), () => {}, false);

    await waitFor(() =>
      expect(container.querySelector(".note-link-card")).not.toBeNull(),
    );
    expect(container.textContent).toContain("before");
    expect(warn).not.toHaveBeenCalledWith(
      "[web RichTextEditor] TipTap content schema error",
      expect.anything(),
      expect.anything(),
    );
    // Read-only, so no delete button — the same rule the attachment chip keeps.
    expect(container.querySelector(".note-link-card__delete")).toBeNull();
  });
});

describe("what becomes a card (#1607)", () => {
  it("turns a URL pasted into an empty paragraph into one", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor(EMPTY_DOC, onUpdate);

      paste(container, "https://example.org/a/b");
      act(() => void vi.advanceTimersByTime(800));

      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string) as {
        content: { type: string; attrs?: { href?: string } }[];
      };
      const card = saved.content.find((n) => n.type === "linkCard");
      expect(card?.attrs?.href).toBe("https://example.org/a/b");
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves a URL pasted into a sentence as ordinary text", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor(
        JSON.stringify({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "see " }] },
          ],
        }),
        onUpdate,
      );

      paste(container, "https://example.org/a/b");
      act(() => void vi.advanceTimersByTime(800));

      // Either nothing was reported, or what was reported still has no card:
      // turning a URL inside a sentence into a block would tear the sentence in
      // half.
      const json = (onUpdate.mock.calls[0]?.[0] as string | undefined) ?? "{}";
      expect(json).not.toContain("linkCard");
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks nothing of the network", async () => {
    // The DoD's own line. A title or a favicon would each be a request to a
    // third party, telling them what the user is reading — and a title needs a
    // proxy, which needs money the project does not spend.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = renderEditor(EMPTY_DOC);
    paste(container, "https://example.org/a/b");
    await waitFor(() =>
      expect(container.querySelector(".note-link-card")).not.toBeNull(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("recognises a standalone URL and nothing else", () => {
    expect(isStandaloneUrl("https://a.example/x")).toBe(true);
    expect(isStandaloneUrl("http://a.example")).toBe(true);
    expect(isStandaloneUrl("see https://a.example")).toBe(false);
    expect(isStandaloneUrl("https://a.example and more")).toBe(false);
    // Not a scheme a browser should be handed from a note body.
    expect(isStandaloneUrl("javascript:alert(1)")).toBe(false);
    expect(isStandaloneUrl("mailto:a@example.com")).toBe(false);
  });

  it("reads the two lines off the URL, and keeps an unparseable one", () => {
    expect(describeUrl("https://www.example.com/a?b=1#c")).toEqual({
      host: "example.com",
      path: "/a?b=1#c",
    });
    // A bare host has no path worth a second line.
    expect(describeUrl("https://example.com/")).toEqual({
      host: "example.com",
      path: "",
    });
    // A link the URL parser dislikes is still a link the user meant to keep.
    expect(describeUrl("not a url")).toEqual({ host: "not a url", path: "" });
  });
});

describe("a card never hands the browser a scheme it should not run", () => {
  it("draws a javascript: href as text with no href at all", async () => {
    // The rules here only ever build a card from http(s), but a DOCUMENT can
    // hold anything — the MCP server writes note bodies, and a note syncs from
    // wherever it was last edited. An href goes straight to the browser on
    // click, so a javascript: one would run in the app's own origin.
    const { container } = renderEditor(docWithCard("javascript:alert(1)"));

    await waitFor(() =>
      expect(container.querySelector(".note-link-card")).not.toBeNull(),
    );
    const link = container.querySelector(".note-link-card__link");
    expect(link?.hasAttribute("href")).toBe(false);
    // Still readable: the node is not silently emptied.
    expect(link?.textContent).toContain("javascript:alert(1)");
  });

  it("keeps http(s) and refuses everything else", () => {
    expect(safeHref("https://a.example/x")).toBe("https://a.example/x");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("")).toBeNull();
  });
});

describe("the card carries its own delete (#1607)", () => {
  it("takes out that node only, leaving the blocks around it", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor(docWithCard(), onUpdate);

      const button = container.querySelector<HTMLButtonElement>(
        "button.note-link-card__delete",
      );
      expect(button).not.toBeNull();
      // The host is in the accessible name: a column of identical "Remove link"
      // buttons tells a screen-reader user nothing.
      expect(button?.getAttribute("aria-label")).toBe(
        "Remove link: example.com",
      );
      // NOT inside the anchor — a control nested in a link is invalid HTML.
      expect(button?.closest("a")).toBeNull();

      act(() => button?.click());
      act(() => void vi.advanceTimersByTime(800));

      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string) as {
        content: { type: string }[];
      };
      expect(saved.content.some((n) => n.type === "linkCard")).toBe(false);
      expect(saved.content).toHaveLength(2);
      expect(JSON.stringify(saved)).toContain("before");
      expect(JSON.stringify(saved)).toContain("after");
    } finally {
      vi.useRealTimers();
    }
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(
  resolve(here, "../src/index.css"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The declarations of one selector's block, as written. */
function block(selector: string): string {
  const at = indexCss.indexOf(selector + " {");
  if (at < 0) throw new Error("no rule for " + selector);
  return indexCss.slice(at, indexCss.indexOf("}", at));
}

describe("#1607 — the card's width and its 44px live in index.css", () => {
  it("spans the body column, like the attachment chip", () => {
    const card = block(".note-editor .ProseMirror .note-link-card__link");
    expect(card).toContain("display: flex");
    expect(card).not.toContain("inline-flex");
    expect(card).toContain("width: 100%");
    expect(card).toContain("min-height: 2.75rem");
  });

  it("floors the delete button at 44x44 and parks it at the right edge", () => {
    const button = block(".note-editor .ProseMirror .note-link-card__delete");
    // 2.75rem = 44px, the touch floor from mobile-scope.md.
    expect(button).toContain("width: 2.75rem");
    expect(button).toContain("height: 2.75rem");
    expect(button).toContain("position: absolute");
    expect(button).toContain("right: 0");
  });

  it("colours everything it draws from lumen tokens", () => {
    const rules = [
      ".note-editor .ProseMirror .note-link-card__link",
      ".note-editor .ProseMirror .note-link-card__path",
      ".note-editor .ProseMirror .note-link-card__delete",
      ".note-editor .ProseMirror .note-link-card__delete:hover",
      ".note-editor .ProseMirror .note-link-card__delete:focus-visible",
    ].map(block);
    for (const rule of rules) {
      expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    }
    expect(rules.join("\n")).toContain("var(--color-border)");
    expect(rules.join("\n")).toContain("var(--color-accent)");
  });
});
