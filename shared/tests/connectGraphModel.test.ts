import { describe, it, expect } from "vitest";
import type { NoteNode } from "../src/types/note";
import type { DailyNode } from "../src/types/daily";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../src/types/wikiTagUnified";
import {
  backlinkSourceIds,
  buildGraphModel,
  resolveLinkId,
} from "../src/components/Connect/graph/buildGraphModel";
import { tagNodeId } from "../src/components/Connect/graph/graph-types";

function note(over: Partial<NoteNode> & { id: string }): NoteNode {
  return {
    type: "note",
    title: over.id,
    content: "",
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...over,
  };
}

function daily(date: string, isDeleted = false): DailyNode {
  return {
    id: `daily-${date}`,
    date,
    content: "",
    isDeleted,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

function tag(id: string, isDeleted = false): WikiTag {
  return {
    id,
    name: id,
    color: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    version: 1,
    isDeleted,
    deletedAt: null,
  };
}

function assignment(itemId: string, tagId: string): WikiTagAssignment {
  return {
    id: `asn-${itemId}-${tagId}`,
    itemId,
    tagId,
    updatedAt: "2026-01-01",
    isDeleted: false,
    deletedAt: null,
  };
}

function connection(
  fromItemId: string,
  toItemId: string,
  isDeleted = false,
): WikiTagConnection {
  return {
    id: `lnk-${fromItemId}-${toItemId}`,
    fromItemId,
    toItemId,
    updatedAt: "2026-01-01",
    isDeleted,
    deletedAt: null,
  };
}

describe("buildGraphModel", () => {
  it("maps folder notes to project and notes to note nodes", () => {
    const out = buildGraphModel({
      notes: [
        note({ id: "note-1", type: "folder" }),
        note({ id: "note-2", type: "note", parentId: "note-1" }),
      ],
      tags: [],
      assignments: [],
      connections: [],
    });
    expect(out.nodes.find((n) => n.id === "note-1")?.type).toBe("project");
    expect(out.nodes.find((n) => n.id === "note-2")?.type).toBe("note");
    // hierarchy edge folder -> child
    expect(
      out.links.some((l) => l.kind === "hierarchy" && l.target === "note-2"),
    ).toBe(true);
  });

  it("builds item-link (manual) edges from unified connections", () => {
    const out = buildGraphModel({
      notes: [note({ id: "note-1" }), note({ id: "note-2" })],
      tags: [],
      assignments: [],
      connections: [connection("note-1", "note-2")],
    });
    expect(
      out.links.some(
        (l) =>
          l.kind === "manual" && l.source === "note-1" && l.target === "note-2",
      ),
    ).toBe(true);
  });

  it("builds tag nodes + assignment edges, skipping deleted tags", () => {
    const out = buildGraphModel({
      notes: [note({ id: "note-1" })],
      tags: [tag("t1"), tag("t2", true)],
      assignments: [assignment("note-1", "t1")],
      connections: [],
    });
    expect(out.nodes.some((n) => n.id === tagNodeId("t1"))).toBe(true);
    expect(out.nodes.some((n) => n.id === tagNodeId("t2"))).toBe(false);
    expect(
      out.links.some(
        (l) =>
          l.kind === "tag" &&
          l.source === "note-1" &&
          l.target === tagNodeId("t1"),
      ),
    ).toBe(true);
  });

  it("chains consecutive dailies temporally and skips deleted ones", () => {
    const out = buildGraphModel({
      notes: [],
      dailies: [daily("2026-01-02"), daily("2026-01-01"), daily("2026-01-03")],
      tags: [],
      assignments: [],
      connections: [],
    });
    const temporal = out.links.filter((l) => l.kind === "temporal");
    expect(temporal).toHaveLength(2);
  });

  it("drops edges that reference missing/deleted nodes", () => {
    const out = buildGraphModel({
      notes: [note({ id: "note-1" }), note({ id: "note-2", isDeleted: true })],
      tags: [],
      assignments: [],
      connections: [connection("note-1", "note-2")],
    });
    expect(out.nodes.some((n) => n.id === "note-2")).toBe(false);
    expect(out.links).toHaveLength(0);
  });
});

describe("backlinkSourceIds", () => {
  it("returns distinct sources that link to the target", () => {
    const ids = backlinkSourceIds("note-3", [
      connection("note-1", "note-3"),
      connection("note-2", "note-3"),
      connection("note-1", "note-3"), // dup
      connection("note-1", "note-9"), // other target
      connection("note-4", "note-3", true), // deleted
    ]);
    expect(ids.sort()).toEqual(["note-1", "note-2"]);
  });
});

describe("resolveLinkId", () => {
  const conns = [
    connection("note-1", "note-2"),
    connection("note-2", "note-3"),
    connection("note-4", "note-5", true), // soft-deleted
  ];

  it("returns the id of the matching active directed link", () => {
    expect(resolveLinkId("note-1", "note-2", conns)).toBe("lnk-note-1-note-2");
  });

  it("returns null for the reversed direction", () => {
    expect(resolveLinkId("note-2", "note-1", conns)).toBeNull();
  });

  it("returns null for a soft-deleted link", () => {
    expect(resolveLinkId("note-4", "note-5", conns)).toBeNull();
  });

  it("returns null when no link matches", () => {
    expect(resolveLinkId("note-1", "note-9", conns)).toBeNull();
  });
});
