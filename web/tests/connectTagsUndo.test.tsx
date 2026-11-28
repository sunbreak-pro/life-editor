import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  UndoRedoProvider,
  WikiTagsUnifiedProvider,
  resetConnectSelection,
  useUndoRedoOptional,
  type DataService,
} from "@life-editor/shared";
import { ConnectScreen } from "../src/connect/ConnectScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * #2881 — what the user does to a tag on the Connect screen comes back off with
 * the header's Undo, and goes on again with Redo.
 *
 * shared/tests/wikiTagsTagUndo.test.tsx pins the commands themselves; this is
 * the half on this side of the hook: that Connect's create, rename and delete
 * reach the global stack through the real provider, and that the screen redraws
 * from the reversal. The "header" is a probe on the same UndoRedoProvider the
 * app mounts, so a press here is the press the header makes.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  isDeleted: boolean;
}

const ASSIGNMENTS = [
  { id: "a-1", itemId: "task-1", tagId: "t-work", isDeleted: false },
  { id: "a-2", itemId: "note-1", tagId: "t-work", isDeleted: false },
];

/** An in-memory `wiki_tags` that keeps a soft-deleted row, as the table does. */
function makeDS() {
  const tags = new Map<string, TagRow>([
    [
      "t-work",
      { id: "t-work", name: "Work", color: null, icon: null, isDeleted: false },
    ],
  ]);
  const live = () => [...tags.values()].filter((t) => !t.isDeleted);
  const set = (id: string, patch: Partial<TagRow>) => {
    const row = { ...(tags.get(id) as TagRow), ...patch };
    tags.set(id, row);
    return row;
  };
  const writes = {
    createWikiTagUnified: vi.fn(
      async (id: string, name: string, color: string | null) => {
        const row = { id, name, color, icon: null, isDeleted: false };
        tags.set(id, row);
        return row;
      },
    ),
    updateWikiTagUnified: vi.fn(async (id: string, patch: Partial<TagRow>) =>
      set(id, patch),
    ),
    softDeleteWikiTagUnified: vi.fn(async (id: string) => {
      set(id, { isDeleted: true });
    }),
    restoreWikiTagUnified: vi.fn(async (id: string) =>
      set(id, { isDeleted: false }),
    ),
  };
  const ds = stubDataService({
    fetchTodoTree: vi.fn().mockResolvedValue([
      { id: "task-1", title: "Draft the PR", updatedAt: "2026-11-25T00:00:00Z" },
    ]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi.fn().mockResolvedValue([
      {
        id: "note-1",
        title: "Migration notes",
        updatedAt: "2026-11-25T00:00:00Z",
      },
    ]),
    listDailiesUnified: vi.fn().mockResolvedValue([]),
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    listNoteExcerptsUnified: vi.fn().mockResolvedValue([]),
    listAllWikiTagsUnified: vi.fn(async () => live()),
    listAllTagAssignments: vi.fn().mockResolvedValue(ASSIGNMENTS),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    ...writes,
  });
  return { ds, tags, live, writes };
}

function HistoryProbe() {
  const history = useUndoRedoOptional();
  return (
    <>
      <button onClick={() => history?.undo()}>Header undo</button>
      <button onClick={() => history?.redo()}>Header redo</button>
    </>
  );
}

async function renderScreen(ds: DataService) {
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <UndoRedoProvider>
      <SyncWrapper>
        <WikiTagsUnifiedProvider dataService={ds}>
          <HistoryProbe />
          <ConnectScreen dataService={ds} onNavigateToItem={vi.fn()} />
        </WikiTagsUnifiedProvider>
      </SyncWrapper>
    </UndoRedoProvider>,
  );
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
}

const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

beforeEach(() => {
  cleanup();
  resetConnectSelection();
});

describe("Connect tag operations on the Undo stack (#2881)", () => {
  it("a deleted tag comes back on its items with Undo, and goes again with Redo", async () => {
    const { ds, live, writes } = makeDS();
    await renderScreen(ds);

    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Work: 2 items" })).toBe(
        null,
      ),
    );

    await press("Header undo");
    expect(writes.restoreWikiTagUnified).toHaveBeenCalledWith("t-work");
    // Back with both of its items: the delete never touched the assignments.
    await screen.findByRole("button", { name: "Work: 2 items" });
    expect(live().map((t) => t.id)).toEqual(["t-work"]);

    await press("Header redo");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Work: 2 items" })).toBe(
        null,
      ),
    );
    expect(live()).toEqual([]);
  });

  it("a rename goes back with Undo and forward with Redo", async () => {
    const { ds, tags } = makeDS();
    await renderScreen(ds);
    fireEvent.click(screen.getByRole("button", { name: "Work: 2 items" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit this tag" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Work log" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Work log: 2 items" });

    await press("Header undo");
    await screen.findByRole("button", { name: "Work: 2 items" });
    expect(tags.get("t-work")?.name).toBe("Work");

    await press("Header redo");
    await screen.findByRole("button", { name: "Work log: 2 items" });
    expect(tags.get("t-work")?.name).toBe("Work log");
  });

  it("a created tag leaves the rail with Undo and returns with Redo", async () => {
    const { ds, live } = makeDS();
    await renderScreen(ds);
    fireEvent.change(screen.getByLabelText("Enter a tag name"), {
      target: { value: "Recipes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("button", { name: "Recipes: 0 items" });

    await press("Header undo");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Recipes: 0 items" })).toBe(
        null,
      ),
    );
    expect(live().map((t) => t.name)).toEqual(["Work"]);

    await press("Header redo");
    await waitFor(() =>
      expect(live().map((t) => t.name).sort()).toEqual(["Recipes", "Work"]),
    );
  });
});
