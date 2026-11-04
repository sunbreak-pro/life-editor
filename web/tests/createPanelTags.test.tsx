import { describe, it, expect, vi } from "vitest";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  ItemCreatePanel,
  UndoRedoProvider,
  WikiTagsUnifiedProvider,
  useUndoRedoContext,
  type DataService,
  type ItemCreatePanelLabels,
  type ItemCreateSlot,
  type ItemCreateTagPool,
  type WikiTagAssignmentUnified,
} from "@life-editor/shared";
import { createBumpableSync, stubDataService } from "./helpers";
import { useScheduleCreateFlow } from "../src/schedule/useScheduleCreateFlow";
import { useCreatePanelNotes } from "../src/schedule/useCreatePanelNotes";
import { useCreatePanelTags } from "../src/schedule/useCreatePanelTags";

/*
 * #2220 — the create panel's tag field, left of 「ノートを添付」.
 *
 * Three halves, pinned apart: the PANEL stages tags (seeded from a picked
 * todo, started over when what the submit acts on changes, absent for a host
 * that passes no pool); the FLOW takes the staged set at the press and applies
 * it once the row exists; the HOOK writes the difference against what the item
 * already carries, so a tag taken off a picked todo really comes off.
 */

/** Every label echoed as its own key — the words are not under test here. */
const LABELS = new Proxy(
  {},
  { get: (_t, key) => String(key) },
) as ItemCreatePanelLabels;

const TAGS = [
  { id: "tag-work", name: "Work", color: "#1e3a8a" },
  { id: "tag-home", name: "Home", color: null },
];

function makePool(
  over: Partial<ItemCreateTagPool> = {},
): ItemCreateTagPool & { onStagedChange: ReturnType<typeof vi.fn> } {
  return {
    tags: TAGS,
    tagsOf: (id: string) => (id === "task-old" ? ["tag-home"] : []),
    labels: {
      field: "Tags",
      add: "Add a tag",
      remove: (name: string) => `Remove ${name}`,
      empty: "No tags",
    },
    ...over,
    onStagedChange: vi.fn(),
  } as ItemCreateTagPool & { onStagedChange: ReturnType<typeof vi.fn> };
}

function renderPanel(tags?: ItemCreateTagPool) {
  return render(
    <ItemCreatePanel
      initial={{ date: "2026-08-20" }}
      pools={{
        todos: [{ id: "task-old", title: "Old todo" }],
        notes: [],
        tags,
      }}
      handlers={{
        onSubmitEvent: vi.fn(),
        onSubmitEventAndOpen: vi.fn(),
        onCreateTodo: vi.fn(),
        onPlaceTodo: vi.fn(),
      }}
      labels={LABELS}
    />,
  );
}

const lastStaged = (pool: { onStagedChange: ReturnType<typeof vi.fn> }) =>
  pool.onStagedChange.mock.calls.at(-1)?.[0];

describe("ItemCreatePanel — the tag field (#2220)", () => {
  it("sits on the note trigger's line, to its left", () => {
    renderPanel(makePool());
    const field = document.querySelector(
      "[data-create-tag-field]",
    ) as HTMLElement;
    expect(field.nextElementSibling).toBe(
      screen.getByRole("button", { name: "attachNote" }),
    );
  });

  it("toggles tags from the list and takes one off with its ×", () => {
    const pool = makePool();
    renderPanel(pool);
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.click(screen.getByRole("option", { name: "Work" }));
    fireEvent.click(screen.getByRole("option", { name: "Home" }));
    expect(lastStaged(pool)).toEqual(["tag-work", "tag-home"]);
    // The list stays open, so a second press on a picked tag takes it off.
    fireEvent.click(screen.getByRole("option", { name: "Home" }));
    expect(lastStaged(pool)).toEqual(["tag-work"]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Work" }));
    expect(lastStaged(pool)).toEqual([]);
  });

  it("seeds a picked existing todo with the tags it wears", () => {
    const pool = makePool();
    renderPanel(pool);
    fireEvent.click(screen.getByRole("tab", { name: "typeTodo" }));
    fireEvent.click(screen.getByRole("radio", { name: "sourceExisting" }));
    fireEvent.click(screen.getByRole("option", { name: "Old todo" }));
    expect(lastStaged(pool)).toEqual(["tag-home"]);
    screen.getByRole("button", { name: "Remove Home" });
  });

  it("starts over when the type or the source changes", () => {
    const pool = makePool();
    renderPanel(pool);
    fireEvent.click(screen.getByRole("button", { name: "Add a tag" }));
    fireEvent.click(screen.getByRole("option", { name: "Work" }));
    expect(lastStaged(pool)).toEqual(["tag-work"]);

    fireEvent.click(screen.getByRole("tab", { name: "typeTodo" }));
    expect(lastStaged(pool)).toEqual([]);

    // The list is still open from the first pick.
    fireEvent.click(screen.getByRole("option", { name: "Work" }));
    expect(lastStaged(pool)).toEqual(["tag-work"]);
    fireEvent.click(screen.getByRole("radio", { name: "sourceExisting" }));
    expect(lastStaged(pool)).toEqual([]);
  });

  it("draws no field for a host that passes no pool, keeping the old layout", () => {
    renderPanel(undefined);
    expect(document.querySelector("[data-create-tag-field]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a tag" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "attachNote" }).className,
    ).toContain("w-full");
  });
});

describe("useScheduleCreateFlow — the staged tags (#2220)", () => {
  const SLOT: ItemCreateSlot = {
    date: "2026-08-20",
    start: "09:00",
    end: "10:00",
    isAllDay: false,
  };

  function setup(staged: string[] | null) {
    const captured: {
      alongside?: (saved: { id: string }) => Promise<unknown>;
      onSaved?: (saved: { id: string } | null) => void;
    } = {};
    const apply = vi.fn();
    const take = vi.fn(() => staged);
    const spies = {
      setCreatePanel: vi.fn(),
      setPopover: vi.fn(),
      setSelectedId: vi.fn(),
      setOverlayOpen: vi.fn(),
      addNode: vi.fn(
        (
          _type: unknown,
          _parent: unknown,
          _title: string,
          opts?: { onSaved?: (saved: { id: string } | null) => void },
        ) => {
          captured.onSaved = opts?.onSaved;
        },
      ),
      updateNode: vi.fn(),
      attachNote: vi.fn(),
      attachNoteAlongside: vi.fn(() => Promise.resolve(null)),
      onAttachError: vi.fn(),
      clearTagLens: vi.fn(),
    };
    const handleCreate = vi.fn(
      (
        _slot: unknown,
        _title: string,
        _onSaved?: unknown,
        alongside?: (saved: never) => Promise<unknown>,
      ) => {
        captured.alongside = alongside as never;
        return "evt-new";
      },
    );
    const tags = { take, apply };
    const view = renderHook(() =>
      useScheduleCreateFlow({
        createPanel: { date: "2026-08-20", start: "09:00", end: "10:00" },
        anchorDate: "2026-08-20",
        isWide: true,
        handleCreate: handleCreate as never,
        tags,
        ...spies,
        // The capturing stub keeps only the onSaved it is handed.
        addNode: spies.addNode as never,
      }),
    );
    return { view, captured, apply, take, ...spies };
  }

  it("tags the new event once its row exists", async () => {
    const h = setup(["tag-work"]);
    act(() => h.view.result.current.handleCreateSubmit("Meeting", SLOT, []));
    // Nothing is written against the optimistic id.
    expect(h.apply).not.toHaveBeenCalled();
    await act(async () => {
      await h.captured.alongside?.({ id: "evt-saved" });
    });
    expect(h.apply).toHaveBeenCalledWith("evt-saved", ["tag-work"]);
  });

  it("tags a new todo from its onSaved", () => {
    const h = setup(["tag-home"]);
    act(() =>
      h.view.result.current.handleCreateTodoSubmit("Write", SLOT, []),
    );
    act(() => h.captured.onSaved?.({ id: "task-saved" }));
    expect(h.apply).toHaveBeenCalledWith("task-saved", ["tag-home"]);
  });

  it("hands a placed todo its whole staged set, even an empty one", () => {
    const h = setup([]);
    act(() =>
      h.view.result.current.handlePlaceTodoSubmit("task-old", SLOT, []),
    );
    expect(h.apply).toHaveBeenCalledWith("task-old", []);
  });

  it("adds no companion when there is neither a note nor a tag", () => {
    const h = setup(null);
    act(() => h.view.result.current.handleCreateSubmit("Meeting", SLOT, []));
    expect(h.captured.alongside).toBeUndefined();
  });
});

describe("useCreatePanelTags — writing the difference (#2220)", () => {
  const ASSIGNMENTS: Partial<WikiTagAssignmentUnified>[] = [
    {
      id: "assign-home",
      tagId: "tag-home",
      itemId: "task-old",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
      isDisplayColor: false,
      isDeleted: false,
    },
  ];

  function setup() {
    const assignTagToItem = vi.fn(
      async (id: string, itemId: string, tagId: string) => ({
        id,
        itemId,
        tagId,
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
        isDisplayColor: false,
        isDeleted: false,
      }),
    );
    const unassignTagFromItem = vi.fn(async () => undefined);
    const ds = stubDataService({
      listAllWikiTagsUnified: vi.fn(async () =>
        TAGS.map((t) => ({ ...t, icon: null })),
      ),
      listAllTagAssignments: vi.fn(async () =>
        ASSIGNMENTS.map((a) => ({ ...a })),
      ),
      listAllTagConnections: vi.fn(async () => []),
      assignTagToItem,
      unassignTagFromItem,
    }) as DataService;
    const { wrapper: Sync } = createBumpableSync();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Sync>
        <WikiTagsUnifiedProvider dataService={ds}>
          {children}
        </WikiTagsUnifiedProvider>
      </Sync>
    );
    const hook = renderHook(() => useCreatePanelTags(), { wrapper });
    return { hook, assignTagToItem, unassignTagFromItem };
  }

  it("offers every tag and seeds a todo with the tags it wears", async () => {
    const { hook } = setup();
    await waitFor(() =>
      expect(hook.result.current.tagPool.tags.map((t) => t.id)).toEqual([
        "tag-work",
        "tag-home",
      ]),
    );
    await waitFor(() =>
      expect(hook.result.current.tagPool.tagsOf("task-old")).toEqual([
        "tag-home",
      ]),
    );
  });

  it("adds what is new and takes off what was dropped", async () => {
    const { hook, assignTagToItem, unassignTagFromItem } = setup();
    await waitFor(() =>
      expect(hook.result.current.tagPool.tagsOf("task-old")).toEqual([
        "tag-home",
      ]),
    );
    act(() => hook.result.current.applyTags("task-old", ["tag-work"]));
    await waitFor(() => expect(assignTagToItem).toHaveBeenCalledTimes(1));
    expect(assignTagToItem.mock.calls[0].slice(1)).toEqual([
      "task-old",
      "tag-work",
    ]);
    await waitFor(() =>
      expect(unassignTagFromItem).toHaveBeenCalledWith("assign-home"),
    );
  });

  it("takes the staged set once, then reports none", () => {
    const { hook } = setup();
    act(() => hook.result.current.tagPool.onStagedChange(["tag-work"]));
    expect(hook.result.current.takeStagedTags()).toEqual(["tag-work"]);
    expect(hook.result.current.takeStagedTags()).toBeNull();
  });
});

/*
 * #2402 — 新規作成 puts the staged tags on the memo note as well as the item,
 * and none of it adds a history entry: one Ctrl+Z has to take the whole press.
 */
describe("useCreatePanelNotes — the memo note's tags (#2402)", () => {
  function setup() {
    const assignTagToItem = vi.fn(
      async (id: string, itemId: string, tagId: string) => ({
        id,
        itemId,
        tagId,
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
        isDisplayColor: false,
        isDeleted: false,
      }),
    );
    const ds = stubDataService({
      listNotesUnified: vi.fn(async () => []),
      createNoteUnified: vi.fn(async () => {}),
      softDeleteNoteUnified: vi.fn(async () => {}),
      createItemLink: vi.fn(async (linkId: string) => ({
        id: linkId,
        fromItemId: "evt-1",
        toItemId: "note-1",
        origin: "manual" as const,
        createdAt: "2026-08-20T00:00:00.000Z",
      })),
      listAllWikiTagsUnified: vi.fn(async () =>
        TAGS.map((t) => ({ ...t, icon: null })),
      ),
      listAllTagAssignments: vi.fn(async () => []),
      listAllTagConnections: vi.fn(async () => []),
      assignTagToItem,
    }) as DataService;
    const { wrapper: Sync } = createBumpableSync();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Sync>
        <UndoRedoProvider>
          <WikiTagsUnifiedProvider dataService={ds}>
            {children}
          </WikiTagsUnifiedProvider>
        </UndoRedoProvider>
      </Sync>
    );
    const hook = renderHook(
      () => ({
        notes: useCreatePanelNotes({
          dataService: ds,
          active: true,
          onAttachError: vi.fn(),
        }),
        undo: useUndoRedoContext(),
      }),
      { wrapper },
    );
    return { hook, ds, assignTagToItem };
  }
  const assigned = (spy: ReturnType<typeof setup>["assignTagToItem"]) =>
    spy.mock.calls.map((c) => c.slice(1));

  it("gives the note the same tags as the item", async () => {
    const { hook, ds, assignTagToItem } = setup();
    const attached = await act(() =>
      hook.result.current.notes.attachMemoNote("evt-1", {
        title: "Memo",
        notes: [],
        noteTagIds: ["tag-work", "tag-home"],
        itemTagIds: ["tag-work", "tag-home"],
      }),
    );
    const note = vi.mocked(ds.createNoteUnified).mock.calls[0][0].id;
    expect(attached).toMatchObject({ noteId: note, ok: true });
    expect(assigned(assignTagToItem)).toEqual([
      ["evt-1", "tag-work"],
      ["evt-1", "tag-home"],
      [note, "tag-work"],
      [note, "tag-home"],
    ]);
  });

  it("adds no history entry per tag, so one undo takes the whole press", async () => {
    const { hook } = setup();
    await act(() =>
      hook.result.current.notes.attachMemoNote("evt-1", {
        title: "Memo",
        notes: [],
        noteTagIds: ["tag-work"],
        itemTagIds: ["tag-work"],
      }),
    );
    expect(hook.result.current.undo.canUndo("tags")).toBe(false);
  });

  it("leaves a picked todo's own tags alone", async () => {
    const { hook, ds, assignTagToItem } = setup();
    await act(() =>
      hook.result.current.notes.attachMemoNote("task-old", {
        title: "Memo",
        notes: [],
        noteTagIds: ["tag-home"],
        itemTagIds: [],
      }),
    );
    const note = vi.mocked(ds.createNoteUnified).mock.calls[0][0].id;
    expect(assigned(assignTagToItem)).toEqual([[note, "tag-home"]]);
  });

  it("keeps the note and says the press did not finish when a tag fails", async () => {
    const { hook, ds, assignTagToItem } = setup();
    assignTagToItem.mockRejectedValueOnce(new Error("no"));
    const attached = await act(() =>
      hook.result.current.notes.attachMemoNote("evt-1", {
        title: "Memo",
        notes: [],
        noteTagIds: ["tag-work"],
        itemTagIds: ["tag-work"],
      }),
    );
    const note = vi.mocked(ds.createNoteUnified).mock.calls[0][0].id;
    expect(attached).toMatchObject({ noteId: note, ok: false });
    expect(ds.softDeleteNoteUnified).not.toHaveBeenCalled();
  });
});
