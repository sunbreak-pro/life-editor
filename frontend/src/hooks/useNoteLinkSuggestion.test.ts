import { describe, it, expect } from "vitest";
import { parseNoteLinkRaw } from "./useNoteLinkSuggestion";

describe("parseNoteLinkRaw", () => {
  it("parses a plain note name", () => {
    expect(parseNoteLinkRaw("My Note")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: null,
      alias: null,
    });
  });

  it("parses alias after pipe", () => {
    expect(parseNoteLinkRaw("My Note|see here")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: null,
      alias: "see here",
    });
  });

  it("parses heading after #", () => {
    expect(parseNoteLinkRaw("My Note#Intro")).toEqual({
      noteQuery: "My Note",
      heading: "Intro",
      blockId: null,
      alias: null,
    });
  });

  it("parses block-id after #^", () => {
    expect(parseNoteLinkRaw("My Note#^abc123")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: "abc123",
      alias: null,
    });
  });

  it("parses heading + alias", () => {
    expect(parseNoteLinkRaw("My Note#Intro|intro ref")).toEqual({
      noteQuery: "My Note",
      heading: "Intro",
      blockId: null,
      alias: "intro ref",
    });
  });

  it("parses block-id + alias", () => {
    expect(parseNoteLinkRaw("My Note#^abc|ref")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: "abc",
      alias: "ref",
    });
  });

  it("treats empty heading as null", () => {
    expect(parseNoteLinkRaw("My Note#")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: null,
      alias: null,
    });
  });

  it("treats empty alias as null", () => {
    expect(parseNoteLinkRaw("My Note|")).toEqual({
      noteQuery: "My Note",
      heading: null,
      blockId: null,
      alias: null,
    });
  });
});
