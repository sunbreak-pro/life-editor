import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

/*
 * #776 — the one copy of the "[[" → item_links wiring, after Notes / Tasks /
 * Daily stopped each carrying their own.
 *
 * The guards below are not stylistic: each one is the difference between a
 * correct graph and a wrong one, and having three copies meant three places any
 * of them could quietly drift. They are pinned HERE, once, and each surface's
 * own test then only has to show it reaches this hook.
 *
 * The console tag is pinned too, because it is what the copies got wrong: the
 * task hook reported `[KanbanView]` from inside a file called useTaskLinking,
 * so an error in the Notes editor could be read as coming from the board.
 */

const createItemLink = vi.fn(() => Promise.resolve());
const syncInlineLinks = vi.fn(() => Promise.resolve());
let outgoing: { toItemId: string; isDeleted?: boolean }[] = [];

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useWikiTagsUnifiedContext: () => ({
    createItemLink,
    syncInlineLinks,
    getLinksForItem: () => ({ incoming: [], outgoing }),
  }),
}));

const { useInlineItemLinks } = await import("../src/hooks/useInlineItemLinks");

const BODY = '{"type":"doc","content":[]}';

function mirror(fromId: string, targetId: string, hostTag = "TestHost") {
  const { result } = renderHook(() => useInlineItemLinks(hostTag));
  result.current.mirrorInlineLink(fromId, targetId);
}

beforeEach(() => {
  createItemLink.mockClear();
  syncInlineLinks.mockClear();
  outgoing = [];
});

describe("useInlineItemLinks — the edge write", () => {
  it("writes an inline-origin edge to the resolved target", () => {
    mirror("note-1", "task-9");
    expect(createItemLink).toHaveBeenCalledExactlyOnceWith(
      "note-1",
      "task-9",
      "inline",
    );
  });

  it("skips a pair that already has a live edge", () => {
    // Writing again would be harmless for an inline edge but not for a MANUAL
    // one: re-minting it as "inline" would hand it to the delete-sync, and a
    // link the user made by hand would vanish on the next save.
    outgoing = [{ toItemId: "task-9" }];
    mirror("note-1", "task-9");
    expect(createItemLink).not.toHaveBeenCalled();
  });

  it("writes again when the existing edge is soft-deleted", () => {
    outgoing = [{ toItemId: "task-9", isDeleted: true }];
    mirror("note-1", "task-9");
    expect(createItemLink).toHaveBeenCalledExactlyOnceWith(
      "note-1",
      "task-9",
      "inline",
    );
  });

  it("skips a self-link", () => {
    mirror("note-1", "note-1");
    expect(createItemLink).not.toHaveBeenCalled();
  });

  it("skips a source row that has no id yet", () => {
    mirror("", "task-9");
    expect(createItemLink).not.toHaveBeenCalled();
  });
});

describe("useInlineItemLinks — the save-time delete-sync", () => {
  it("hands the saved body over so stale inline edges fold", () => {
    const { result } = renderHook(() => useInlineItemLinks("TestHost"));
    result.current.syncSavedBody("note-1", BODY);
    expect(syncInlineLinks).toHaveBeenCalledExactlyOnceWith("note-1", BODY);
  });
});

describe("useInlineItemLinks — whose console it is", () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errors.mockRestore();
  });

  it("reports a failed edge write under the calling host's name", async () => {
    createItemLink.mockRejectedValueOnce(new Error("offline"));
    mirror("note-1", "task-9", "DailyView");

    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "[DailyView] item link upsert failed",
        expect.anything(),
      ),
    );
  });

  it("reports a failed delete-sync under the calling host's name", async () => {
    syncInlineLinks.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useInlineItemLinks("KanbanView"));
    result.current.syncSavedBody("task-1", BODY);

    await vi.waitFor(() =>
      expect(errors).toHaveBeenCalledWith(
        "[KanbanView] inline link delete-sync failed",
        expect.anything(),
      ),
    );
  });
});
