import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import type { WikiTagConnection } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1690 — "[[" link → Ctrl+Z → save → Ctrl+Shift+Z → save leaves ONE edge.
 *
 * The sync used to run one way only. A save whose body had lost a link
 * deleted the edge; a save whose body had GAINED one did nothing, because the
 * only thing that ever created an edge was the picker (`onResolvedInserted`).
 * So the redo put the link back in the text and the LinkPanel row stayed
 * gone — for good, since no later save would notice.
 *
 * Driven through the hook rather than the pure helpers because the bug was in
 * the wiring between them: both halves have to run off the same body, and the
 * manual edge has to survive both.
 */

const { wrapper } = createBumpableSync();

const doc = (targetIds: readonly string[]): string =>
  JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: targetIds.map((targetId) => ({
          type: "itemLink",
          attrs: { targetId, label: targetId, role: "note" },
        })),
      },
    ],
  });

function conn(
  over: Partial<WikiTagConnection> & { id: string },
): WikiTagConnection {
  return {
    fromItemId: "note-1",
    toItemId: "note-2",
    origin: "inline",
    updatedAt: "2026-09-19T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
    ...over,
  };
}

function setup(initial: WikiTagConnection[]) {
  const log: string[] = [];
  const ds = stubDataService({
    listAllWikiTagsUnified: vi.fn().mockResolvedValue([]),
    listAllTagAssignments: vi.fn().mockResolvedValue([]),
    listAllTagConnections: vi.fn().mockResolvedValue(initial),
    deleteItemLink: vi.fn(async (id: string) => {
      log.push(`delete ${id}`);
    }),
    createItemLink: vi.fn(
      async (
        id: string,
        fromItemId: string,
        toItemId: string,
        origin: string,
      ) => {
        log.push(`create ${fromItemId}→${toItemId} (${origin})`);
        return conn({ id, fromItemId, toItemId, origin: "inline" });
      },
    ),
  });
  const hook = renderHook(() => useWikiTagsUnifiedAPI({ dataService: ds }), {
    wrapper,
  });
  return { hook, log, ds };
}

describe("syncInlineLinks is two-way (#1690)", () => {
  it("restores the edge a redo put back, and keeps it to one", async () => {
    const { hook, log } = setup([conn({ id: "l-1", toItemId: "note-2" })]);
    await waitFor(() =>
      expect(hook.result.current.allConnections).toHaveLength(1),
    );

    // Ctrl+Z took the link out of the body; this save is the delete half.
    await act(async () => {
      await hook.result.current.syncInlineLinks("note-1", doc([]));
    });
    expect(log).toEqual(["delete l-1"]);

    // Ctrl+Shift+Z put it back. Before #1690 this save did nothing.
    await act(async () => {
      await hook.result.current.syncInlineLinks("note-1", doc(["note-2"]));
    });
    expect(log).toEqual(["delete l-1", "create note-1→note-2 (inline)"]);

    const live = hook.result.current.allConnections.filter((l) => !l.isDeleted);
    expect(live.map((l) => l.toItemId)).toEqual(["note-2"]);

    // A save with the body unchanged must not add a second one.
    await act(async () => {
      await hook.result.current.syncInlineLinks("note-1", doc(["note-2"]));
    });
    expect(log).toHaveLength(2);
  });

  it("leaves a hand-made edge alone and never duplicates it", async () => {
    const { hook, log } = setup([
      conn({ id: "l-manual", toItemId: "note-2", origin: "manual" }),
    ]);
    await waitFor(() =>
      expect(hook.result.current.allConnections).toHaveLength(1),
    );

    // The body carries the same pair: present, so nothing to create.
    await act(async () => {
      await hook.result.current.syncInlineLinks("note-1", doc(["note-2"]));
    });
    // And a body with no links at all: manual edges are not delete candidates.
    await act(async () => {
      await hook.result.current.syncInlineLinks("note-1", doc([]));
    });

    expect(log).toEqual([]);
    expect(hook.result.current.allConnections.map((l) => l.id)).toEqual([
      "l-manual",
    ]);
  });
});
