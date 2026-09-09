import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { RichTextEditor } from "../src/notes/RichTextEditor";

/*
 * #1579 — a note the MCP server wrote with a table must OPEN, and must survive
 * being saved.
 *
 * Same failure as #1521's callout, on the sibling node type: `enableContentCheck:
 * true` rejects a document containing a node the schema does not know,
 * RichTextEditor only logs that, the editor comes up empty, and the 800ms
 * autosave writes the empty document back over the real body. Opening the note
 * once was enough to lose it. Both halves are asserted here: the cells are on
 * screen, and a later edit round-trips a document that still HAS the table —
 * its header row still a header row, its span attributes intact — plus
 * everything that sat around it.
 *
 * Driven through the real RichTextEditor like calloutNode / attachmentNode: the
 * schema check and the getJSON() round-trip are plain ProseMirror work with no
 * coordinate pipeline in them, so jsdom's missing layout (#475) is not in the
 * way.
 */

/** The exact shape mcp-server/src/utils/tiptapJsonBuilder.ts::table() emits. */
function docWithTable(
  headers: string[] = ["Day", "Focus"],
  rows: string[][] = [
    ["Mon", "Sync"],
    ["Tue", "Write"],
  ],
) {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: headers.map((h) => ({
              type: "tableHeader",
              content: [
                { type: "paragraph", content: [{ type: "text", text: h }] },
              ],
            })),
          },
          ...rows.map((row) => ({
            type: "tableRow",
            content: row.map((cell) => ({
              type: "tableCell",
              content: [
                { type: "paragraph", content: [{ type: "text", text: cell }] },
              ],
            })),
          })),
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  });
}

function renderEditor(content: string, onUpdate: (json: string) => void) {
  return render(
    <RichTextEditor
      noteId="note-1"
      initialContent={content}
      onUpdate={onUpdate}
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

/** Every node of a type, anywhere in the saved document. */
function nodesOfType(
  node: { type?: string; content?: unknown[] },
  type: string,
): { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }[] {
  const here = node.type === type ? [node] : [];
  const children = (node.content ?? []) as {
    type?: string;
    content?: unknown[];
  }[];
  return [...here, ...children.flatMap((c) => nodesOfType(c, type))];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("table nodes (#1579)", () => {
  it("opens a table note with its cells instead of discarding the document", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderEditor(docWithTable(), () => {});

    await waitFor(() =>
      expect(container.querySelector(".tiptap")).toBeTruthy(),
    );

    // The cells AND the paragraphs around them — a schema rejection takes the
    // whole document, not just the node it choked on.
    expect(container.textContent).toContain("Day");
    expect(container.textContent).toContain("Sync");
    expect(container.textContent).toContain("before");
    expect(container.textContent).toContain("after");

    // onContentError is the exact channel the bug reported itself on.
    expect(warn).not.toHaveBeenCalledWith(
      "[web RichTextEditor] TipTap content schema error",
      expect.anything(),
      expect.anything(),
    );
  });

  it("draws a real table, header cells as <th>, inside the scroll wrapper", async () => {
    const { container } = renderEditor(docWithTable(), () => {});

    await waitFor(() => expect(container.querySelector("table")).toBeTruthy());

    // The wrapper is what web/src/index.css puts overflow-x on; without it a
    // wide MCP table stretches the note pane instead of scrolling itself.
    expect(container.querySelector(".tableWrapper table")).toBeTruthy();
    // Header row as <th>, data rows as <td> — the distinction the MCP builder
    // encodes with tableHeader vs tableCell.
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("td")).toHaveLength(4);
    expect(container.querySelector("th")?.textContent).toContain("Day");
  });

  it("keeps the table, its header row and its text through a save", () => {
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const { container } = renderEditor(docWithTable(), onUpdate);

      edit(container);
      act(() => void vi.advanceTimersByTime(800));

      expect(onUpdate).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string);
      const table = saved.content.find(
        (n: { type: string }) => n.type === "table",
      );
      expect(table).toBeDefined();
      expect(nodesOfType(table, "tableRow")).toHaveLength(3);
      // A header that came back as a plain cell would lose the writer's intent
      // on the next MCP read, and the round-trip would not be lossless.
      expect(nodesOfType(table, "tableHeader")).toHaveLength(2);
      expect(nodesOfType(table, "tableCell")).toHaveLength(4);
      expect(JSON.stringify(table)).toContain("Sync");
      // The paragraphs around it are still there too.
      expect(JSON.stringify(saved)).toContain("after");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps colspan / rowspan on a merged cell through a save", () => {
    // ProseMirror drops attributes the schema does not declare — silently, on
    // the save after the note is opened. A merged cell that came back
    // un-merged would quietly reshape the table, which is a smaller version of
    // the bug this file exists to fix.
    vi.useFakeTimers();
    try {
      const onUpdate = vi.fn();
      const doc = JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "before" }] },
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableHeader",
                    attrs: { colspan: 2, rowspan: 1, colwidth: null },
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Week" }],
                      },
                    ],
                  },
                ],
              },
              {
                type: "tableRow",
                content: [
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Mon" }],
                      },
                    ],
                  },
                  {
                    type: "tableCell",
                    content: [
                      {
                        type: "paragraph",
                        content: [{ type: "text", text: "Sync" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
      const { container } = render(
        <RichTextEditor
          noteId="note-1"
          initialContent={doc}
          onUpdate={onUpdate}
        />,
      );

      edit(container);
      act(() => void vi.advanceTimersByTime(800));

      const saved = JSON.parse(onUpdate.mock.calls[0][0] as string);
      const header = nodesOfType(saved, "tableHeader")[0];
      expect(header?.attrs).toMatchObject({ colspan: 2, rowspan: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a table whose cells hold more than one paragraph", async () => {
    // `generate_content` puts one paragraph per cell, but `format_content` and
    // a user typing Enter inside a cell both produce more. A cell that only
    // accepted a single block would fail the schema check on those.
    const doc = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "first" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "second" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <RichTextEditor
        noteId="note-1"
        initialContent={doc}
        onUpdate={() => {}}
      />,
    );

    await waitFor(() => expect(container.querySelector("td")).toBeTruthy());
    expect(container.textContent).toContain("first");
    expect(container.textContent).toContain("second");
    expect(warn).not.toHaveBeenCalledWith(
      "[web RichTextEditor] TipTap content schema error",
      expect.anything(),
      expect.anything(),
    );
  });
});
