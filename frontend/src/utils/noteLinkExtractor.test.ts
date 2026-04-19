import { describe, it, expect } from "vitest";
import { extractNoteLinksFromTiptapJson } from "./noteLinkExtractor";

describe("extractNoteLinksFromTiptapJson", () => {
  it("returns empty for missing doc", () => {
    expect(extractNoteLinksFromTiptapJson(null)).toEqual([]);
    expect(extractNoteLinksFromTiptapJson(undefined)).toEqual([]);
  });

  it("extracts a single noteLink node", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "noteLink",
              attrs: {
                targetNoteId: "note-42",
                displayTitle: "Alpha",
                heading: null,
                blockId: null,
                alias: null,
                embed: false,
              },
            },
          ],
        },
      ],
    };
    expect(extractNoteLinksFromTiptapJson(doc)).toEqual([
      {
        targetNoteId: "note-42",
        targetHeading: null,
        targetBlockId: null,
        alias: null,
        linkType: "inline",
      },
    ]);
  });

  it("captures heading, blockId, alias, and embed flag", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "noteLink",
              attrs: {
                targetNoteId: "note-1",
                displayTitle: "A",
                heading: "Intro",
                blockId: null,
                alias: "see",
                embed: true,
              },
            },
            {
              type: "noteLink",
              attrs: {
                targetNoteId: "note-2",
                displayTitle: "B",
                heading: null,
                blockId: "abc123",
                alias: null,
                embed: false,
              },
            },
          ],
        },
      ],
    };
    const result = extractNoteLinksFromTiptapJson(doc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      targetNoteId: "note-1",
      targetHeading: "Intro",
      targetBlockId: null,
      alias: "see",
      linkType: "embed",
    });
    expect(result[1]).toEqual({
      targetNoteId: "note-2",
      targetHeading: null,
      targetBlockId: "abc123",
      alias: null,
      linkType: "inline",
    });
  });

  it("ignores nodes without a targetNoteId", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "noteLink",
              attrs: { targetNoteId: null, displayTitle: "Missing" },
            },
            { type: "wikiTag", attrs: { tagId: "t-1", tagName: "foo" } },
            { type: "text", text: "just text" },
          ],
        },
      ],
    };
    expect(extractNoteLinksFromTiptapJson(doc)).toEqual([]);
  });

  it("walks nested content structures", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "noteLink",
                  attrs: {
                    targetNoteId: "nested-note",
                    displayTitle: "nested",
                    embed: false,
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractNoteLinksFromTiptapJson(doc)).toHaveLength(1);
  });
});
