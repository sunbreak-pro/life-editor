import { describe, it, expect, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { WikiTagsUnifiedProvider } from "../src/context/WikiTagsUnifiedContext";
import { useWikiTagsUnifiedContext } from "../src/hooks/useWikiTagsUnifiedContext";
import { UndoRedoProvider } from "../src/context/UndoRedoContext";
import { useUndoRedoOptional } from "../src/hooks/useUndoRedoContext";
import {
  UndoRedoManager,
  type UndoOutcome,
} from "../src/utils/undoRedo/UndoRedoManager";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2881 — the tag itself (create, rename, colour, icon, delete) goes on the
 * global Undo stack, one command per operation.
 *
 * The real hook runs against an in-memory `wiki_tags` table that keeps a
 * soft-deleted row around the way the database does, and an assignment table
 * the tag delete never touches — the same as the service, where nothing
 * cascades `wiki_tags.is_deleted` into `wiki_tag_assignments`. "Undo" below is
 * a real UndoRedoManager's pop-and-run, the same one the header button drives.
 */

const { wrapper } = createBumpableSync();

function tagRow(
  id: string,
  name: string,
  over: Partial<WikiTag> = {},
): WikiTag {
  return {
    id,
    name,
    color: null,
    icon: null,
    createdAt: "2026-11-25T00:00:00.000Z",
    updatedAt: "2026-11-25T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
    ...over,
  };
}

const ASSIGNMENT: WikiTagAssignment = {
  id: "a-1",
  itemId: "note-1",
  tagId: "t-work",
  createdAt: "2026-11-25T00:00:00.000Z",
  updatedAt: "2026-11-25T00:00:00.000Z",
  isDisplayColor: false,
  isDeleted: false,
  deletedAt: null,
};

function makeDS(seed: WikiTag[] = [tagRow("t-work", "Work")]) {
  const tags = new Map(seed.map((t) => [t.id, t]));
  const live = () => [...tags.values()].filter((t) => !t.isDeleted);
  const createWikiTagUnified = vi.fn(
    async (id: string, name: string, color: string | null) => {
      const row = tagRow(id, name, { color });
      tags.set(id, row);
      return row;
    },
  );
  const updateWikiTagUnified = vi.fn(
    async (id: string, updates: Partial<WikiTag>) => {
      const row = tags.get(id);
      if (!row) throw new Error("no row");
      const next = { ...row, ...updates };
      tags.set(id, next);
      return next;
    },
  );
  const softDeleteWikiTagUnified = vi.fn(async (id: string) => {
    const row = tags.get(id);
    if (row) tags.set(id, { ...row, isDeleted: true, deletedAt: "now" });
  });
  const restoreWikiTagUnified = vi.fn(async (id: string) => {
    const row = tags.get(id);
    if (!row) throw new Error("no row");
    const next = { ...row, isDeleted: false, deletedAt: null };
    tags.set(id, next);
    return next;
  });
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => live(),
    listAllTagAssignments: async () => [ASSIGNMENT],
    listAllTagConnections: async () => [],
    createWikiTagUnified,
    updateWikiTagUnified,
    softDeleteWikiTagUnified,
    restoreWikiTagUnified,
  });
  return {
    ds,
    tags,
    live,
    createWikiTagUnified,
    updateWikiTagUnified,
    softDeleteWikiTagUnified,
    restoreWikiTagUnified,
  };
}

function makeHistory() {
  const manager = new UndoRedoManager();
  const undoRedo: UndoRedoLike = {
    push: (_domain, command) => manager.push(command),
    undo: () => void manager.undo(),
    redo: () => void manager.redo(),
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    clear: () => manager.clear(),
  };
  return { manager, undoRedo };
}

async function mount(seed?: WikiTag[]) {
  const fake = makeDS(seed);
  const history = makeHistory();
  const hook = renderHook(
    () =>
      useWikiTagsUnifiedAPI({
        dataService: fake.ds,
        undoRedo: history.undoRedo,
      }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.hasLoaded).toBe(true));
  const names = () => hook.result.current.allTags.map((t) => t.name);
  const run = async (
    direction: "undo" | "redo",
  ): Promise<UndoOutcome | null> => {
    let outcome: UndoOutcome | null = null;
    await act(async () => {
      outcome = await history.manager[direction]();
    });
    return outcome;
  };
  return { ...fake, ...history, hook, names, run };
}

describe("tag create undo (#2881)", () => {
  it("create → Undo takes the tag off the list → Redo brings the same id back", async () => {
    const { hook, manager, live, names, run } = await mount();

    let created: WikiTag | undefined;
    await act(async () => {
      created = await hook.result.current.createTag("Recipes");
    });
    expect(names()).toEqual(["Recipes", "Work"]);
    expect(manager.canUndo()).toBe(true);

    expect((await run("undo"))?.ok).toBe(true);
    expect(names()).toEqual(["Work"]);
    expect(live().map((t) => t.id)).toEqual(["t-work"]);

    expect((await run("redo"))?.ok).toBe(true);
    expect(names()).toEqual(["Recipes", "Work"]);
    // The same row, so anything assigned to it before the undo still points
    // at a live tag.
    expect(live().map((t) => t.id)).toContain(created?.id);
  });

  it("records nothing when the create fails", async () => {
    const { hook, manager, createWikiTagUnified } = await mount();
    createWikiTagUnified.mockRejectedValueOnce(new Error("duplicate"));

    await act(async () => {
      await expect(hook.result.current.createTag("Work")).rejects.toThrow(
        "duplicate",
      );
    });
    expect(manager.canUndo()).toBe(false);
  });
});

describe("tag rename / colour / icon undo (#2881)", () => {
  it.each([
    ["name", "setTagName", "Office"],
    ["color", "setTagColor", "#e11d48"],
    ["icon", "setTagIcon", "Star"],
  ] as const)(
    "%s: change → Undo writes the old value back → Redo writes the new one",
    async (field, method, value) => {
      const { hook, manager, tags, updateWikiTagUnified, run } = await mount([
        tagRow("t-work", "Work", { color: "#22c55e", icon: "Tag" }),
      ]);
      const before = tags.get("t-work")?.[field];

      await act(async () => {
        await hook.result.current[method]("t-work", value);
      });
      expect(tags.get("t-work")?.[field]).toBe(value);
      expect(manager.canUndo()).toBe(true);

      expect((await run("undo"))?.ok).toBe(true);
      expect(tags.get("t-work")?.[field]).toBe(before);
      expect(hook.result.current.allTags[0][field]).toBe(before);
      // One field per write: the undo must not drag a sibling field along.
      expect(updateWikiTagUnified).toHaveBeenLastCalledWith("t-work", {
        [field]: before,
      });

      expect((await run("redo"))?.ok).toBe(true);
      expect(tags.get("t-work")?.[field]).toBe(value);
      expect(hook.result.current.allTags[0][field]).toBe(value);
    },
  );

  it("does not record a change to the value the tag already has", async () => {
    const { hook, manager, updateWikiTagUnified } = await mount([
      tagRow("t-work", "Work", { color: "#22c55e" }),
    ]);

    await act(async () => {
      await hook.result.current.setTagName("t-work", "Work");
      await hook.result.current.setTagColor("t-work", "#22c55e");
      await hook.result.current.setTagIcon("t-work", null);
    });

    // Still written — the caller asked — but nothing to undo.
    expect(updateWikiTagUnified).toHaveBeenCalledTimes(3);
    expect(manager.canUndo()).toBe(false);
  });

  it("keeps each field its own command when one save changes two", async () => {
    const { hook, tags, run } = await mount();

    await act(async () => {
      await Promise.all([
        hook.result.current.setTagName("t-work", "Office"),
        hook.result.current.setTagColor("t-work", "#e11d48"),
      ]);
    });

    await run("undo");
    expect(tags.get("t-work")).toMatchObject({
      name: "Office",
      color: null,
    });
    await run("undo");
    expect(tags.get("t-work")).toMatchObject({ name: "Work", color: null });
  });

  it("keeps a failed undo on the undo stack and off redo (#1668)", async () => {
    const { hook, manager, tags, updateWikiTagUnified, run } = await mount();
    await act(async () => {
      await hook.result.current.setTagName("t-work", "Office");
    });
    updateWikiTagUnified.mockRejectedValueOnce(new Error("offline"));

    const outcome = await run("undo");

    expect(outcome?.ok).toBe(false);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    expect(tags.get("t-work")?.name).toBe("Office");

    // The retry goes through once the write does.
    expect((await run("undo"))?.ok).toBe(true);
    expect(tags.get("t-work")?.name).toBe("Work");
  });
});

describe("tag delete undo (#2881)", () => {
  it("delete → Undo puts the tag back on the list and on its items → Redo deletes again", async () => {
    const { hook, manager, live, restoreWikiTagUnified, names, run } =
      await mount();
    const itemTags = () =>
      hook.result.current
        .getTagsForItem("note-1")
        .filter((a) =>
          hook.result.current.allTags.some((t) => t.id === a.tagId),
        )
        .map((a) => a.tagId);
    expect(itemTags()).toEqual(["t-work"]);

    await act(async () => {
      await hook.result.current.deleteTag("t-work");
    });
    expect(names()).toEqual([]);
    expect(itemTags()).toEqual([]);
    expect(manager.canUndo()).toBe(true);

    expect((await run("undo"))?.ok).toBe(true);
    expect(restoreWikiTagUnified).toHaveBeenCalledWith("t-work");
    expect(names()).toEqual(["Work"]);
    expect(live().map((t) => t.id)).toEqual(["t-work"]);
    // The assignment row was never touched, so the item wears the tag again.
    expect(itemTags()).toEqual(["t-work"]);

    expect((await run("redo"))?.ok).toBe(true);
    expect(names()).toEqual([]);
    expect(live()).toEqual([]);
  });

  it("does not record deleting a tag the list does not hold", async () => {
    const { hook, manager } = await mount();
    await act(async () => {
      await hook.result.current.deleteTag("t-unknown");
    });
    expect(manager.canUndo()).toBe(false);
  });

  it("keeps a refused restore on the undo stack and off redo", async () => {
    const { hook, manager, restoreWikiTagUnified, names, run } = await mount();
    await act(async () => {
      await hook.result.current.deleteTag("t-work");
    });
    // A live tag took the same name meanwhile (uq_wiki_tags_name).
    restoreWikiTagUnified.mockRejectedValueOnce(new Error("duplicate key"));

    const outcome = await run("undo");

    expect(outcome?.ok).toBe(false);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    expect(names()).toEqual([]);
  });
});

/*
 * #1727 — the commands name the tag by id, so walking to another section
 * (the provider unmounts and a fresh one mounts) leaves them standing.
 */
function Probe() {
  const { deleteTag, allTags } = useWikiTagsUnifiedContext();
  const history = useUndoRedoOptional();
  return (
    <>
      <button onClick={() => void deleteTag("t-work")}>delete</button>
      <button onClick={() => history?.undo()}>undo</button>
      <span data-testid="tags">{allTags.map((t) => t.name).join(",")}</span>
      <span data-testid="can-undo">{String(history?.canUndo())}</span>
    </>
  );
}

const sync = createBumpableSync();
const Sync = sync.wrapper;

function Harness({
  mounted,
  children,
}: {
  mounted: boolean;
  children: ReactNode;
}) {
  return (
    <UndoRedoProvider>
      <Sync>{mounted ? children : null}</Sync>
    </UndoRedoProvider>
  );
}

describe("tag commands outlive the provider (#1727)", () => {
  it("undoes a delete made before the section was left and re-entered", async () => {
    const fake = makeDS();
    const tree = (
      <WikiTagsUnifiedProvider dataService={fake.ds}>
        <Probe />
      </WikiTagsUnifiedProvider>
    );
    const { rerender } = render(<Harness mounted>{tree}</Harness>);
    await waitFor(() =>
      expect(screen.getByTestId("tags").textContent).toBe("Work"),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("delete"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("tags").textContent).toBe(""),
    );

    rerender(<Harness mounted={false}>{tree}</Harness>);
    rerender(<Harness mounted>{tree}</Harness>);
    await waitFor(() =>
      expect(screen.getByTestId("can-undo").textContent).toBe("true"),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("undo"));
    });
    await waitFor(() =>
      expect(fake.restoreWikiTagUnified).toHaveBeenCalledWith("t-work"),
    );
    expect(fake.live().map((t) => t.id)).toEqual(["t-work"]);
    // The fresh provider reads the restored row on the next tags round, as it
    // would from the Realtime echo in the app.
    act(() => sync.sync.bump("tags"));
    await waitFor(() =>
      expect(screen.getByTestId("tags").textContent).toBe("Work"),
    );
  });
});
