import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRef } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  createEvent,
  within,
  renderHook,
  act,
} from "@testing-library/react";
import {
  buildTagHubModel,
  TagActionsMenu,
  TagHubView,
  useTagActionsMenu,
  useTagEditDrafts,
  type TagHubItem,
} from "../src/components";
import type { WikiTag, WikiTagAssignment } from "../src/types/wikiTagUnified";
import {
  TAG_HUB_LABELS as LABELS,
  formatCount,
  formatUnusedTags,
} from "./tagHubLabels";

/*
 * The tag action menu, lifted out of the Connect rail (#1676).
 *
 * Two halves. The rail's right-click is pinned through the real TagHubView,
 * because "the same menu as the …" is a claim about the rail and only the rail
 * can make it. The extracted parts are then rendered on their own — from the
 * components barrel, the way the Materials note sidebar (#1677) will import
 * them — so a hub-only assumption cannot hide inside them.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the pointer is a dispatched
 * `contextmenu` with client coordinates, never a position on screen.
 */

const tag = (id: string, name: string): WikiTag => ({
  id,
  name,
  color: null,
  icon: null,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const assign = (itemId: string, tagId: string): WikiTagAssignment => ({
  id: `a-${itemId}-${tagId}`,
  itemId,
  tagId,
  createdAt: "2026-08-01T00:00:00Z",
  isDisplayColor: false,
  updatedAt: "2026-08-01T00:00:00Z",
  isDeleted: false,
  deletedAt: null,
});

const ITEMS: TagHubItem[] = [
  { id: "task-1", role: "task", title: "Draft the PR" },
  { id: "note-loose", role: "note", title: "Loose thought" },
];

function renderRail(wide = true) {
  const onEditTag = vi.fn();
  const onDeleteTag = vi.fn();
  const model = buildTagHubModel({
    tags: [tag("t-work", "Work")],
    assignments: [assign("task-1", "t-work")],
    items: ITEMS,
    untaggedName: "Untagged",
  });
  render(
    <TagHubView
      model={model}
      selectedTagId={null}
      onSelectTag={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      onOpenItem={vi.fn()}
      formatCount={formatCount}
      formatUnusedTags={formatUnusedTags}
      wide={wide}
      isLoading={false}
      labels={LABELS}
      onEditTag={onEditTag}
      onDeleteTag={onDeleteTag}
      onToggleEdit={vi.fn()}
      onEditChange={vi.fn()}
    />,
  );
  return { onEditTag, onDeleteTag };
}

/** The rail row (<li>) holding the tag button with this label. */
const rowOf = (label: string) =>
  screen.getByRole("button", { name: label }).closest("li") as HTMLElement;

/** Dispatches a right-click and reports whether the default was prevented. */
function rightClick(target: HTMLElement, x = 120, y = 80) {
  const event = createEvent.contextMenu(target, {
    clientX: x,
    clientY: y,
    button: 2,
  });
  fireEvent(target, event);
  return event.defaultPrevented;
}

beforeEach(cleanup);

describe("TagHubTagRail — right-click opens the row menu (#1676)", () => {
  it("opens the same menu the … opens, and suppresses the browser's", () => {
    renderRail();
    const prevented = rightClick(rowOf("Work: 1 items"));

    expect(prevented).toBe(true);
    const menu = screen.getByRole("menu", { name: "Work: Tag actions" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Edit tag", "Delete tag"]);
  });

  it("opens at the pointer rather than under the …", () => {
    renderRail();
    rightClick(rowOf("Work: 1 items"), 140, 96);

    const menu = screen.getByRole("menu", { name: "Work: Tag actions" });
    expect(menu.className).toContain("fixed");
    expect(menu.className).not.toContain("top-full");
    expect(menu.style.left).toBe("140px");
    expect(menu.style.top).toBe("96px");
  });

  it("keeps the … opening below its trigger", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));

    const menu = screen.getByRole("menu", { name: "Work: Tag actions" });
    expect(menu.className).toContain("top-full");
    expect(menu.style.left).toBe("");
  });

  it("reports each item exactly as the … menu does", () => {
    const { onEditTag, onDeleteTag } = renderRail();

    const pick = (name: string) => {
      rightClick(rowOf("Work: 1 items"));
      fireEvent.click(screen.getByRole("menuitem", { name }));
      // Every item closes the menu before reporting.
      expect(screen.queryByRole("menu")).toBeNull();
    };
    pick("Edit tag");
    pick("Delete tag");

    expect(onEditTag.mock.calls).toEqual([["t-work"]]);
    expect(onDeleteTag.mock.calls).toEqual([["t-work"]]);
  });

  it("leaves the untagged bucket's native menu alone", () => {
    renderRail();
    const prevented = rightClick(rowOf("Untagged: 1 items"));

    expect(prevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("adds nothing on the narrow layout, where the … is always shown", () => {
    renderRail(false);
    const prevented = rightClick(rowOf("Work: 1 items"));

    expect(prevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("TagActionsMenu — usable outside the hub (#1676)", () => {
  function Host({
    onEdit,
    onDelete,
  }: {
    onEdit: () => void;
    onDelete: () => void;
  }) {
    const menu = useTagActionsMenu();
    const trigger = useRef<HTMLButtonElement | null>(null);
    return (
      <div onContextMenu={menu.openAtPointer} data-testid="surface">
        <div className="relative">
          <button ref={trigger} type="button" onClick={menu.toggleFromTrigger}>
            more
          </button>
          <TagActionsMenu
            open={menu.open}
            onClose={menu.close}
            tagName="Recipes"
            anchorRef={trigger}
            anchorPoint={menu.anchorPoint}
            onEdit={onEdit}
            onDelete={onDelete}
            labels={LABELS}
          />
        </div>
      </div>
    );
  }

  it("opens from a trigger and from a right-click, with one set of actions", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<Host onEdit={onEdit} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit tag" }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    rightClick(screen.getByTestId("surface"), 10, 20);
    expect(
      screen.getByRole("menu", { name: "Recipes: Tag actions" }).style.top,
    ).toBe("20px");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("switches a trigger-opened menu back to the trigger after a right-click", () => {
    render(<Host onEdit={vi.fn()} onDelete={vi.fn()} />);

    rightClick(screen.getByTestId("surface"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "more" }));
    expect(screen.getByRole("menu").className).toContain("top-full");
  });
});

describe("useTagEditDrafts (#1676)", () => {
  const TAG = { id: "t-work", name: "Work", color: null, icon: null };
  const writers = () => ({
    setTagName: vi.fn(async () => undefined),
    setTagIcon: vi.fn(async () => undefined),
    setTagColor: vi.fn(async () => undefined),
  });

  it("holds a draft without writing, then saves only what moved, name first", () => {
    const w = writers();
    const { result } = renderHook(() => useTagEditDrafts([TAG], w));

    act(() => result.current.edit("t-work", { color: "#e11d48" }));
    act(() => result.current.edit("t-work", { name: "Work log" }));
    expect(result.current.isDirty("t-work")).toBe(true);
    expect(w.setTagName).not.toHaveBeenCalled();

    act(() => result.current.save("t-work"));
    expect(w.setTagName.mock.calls).toEqual([["t-work", "Work log"]]);
    expect(w.setTagColor.mock.calls).toEqual([["t-work", "#e11d48"]]);
    expect(w.setTagIcon).not.toHaveBeenCalled();
  });

  it("is clean again once a field is dropped or the draft discarded", () => {
    const { result } = renderHook(() => useTagEditDrafts([TAG], writers()));

    act(() => result.current.edit("t-work", { name: "Work log" }));
    act(() => result.current.drop("t-work", "name"));
    expect(result.current.isDirty("t-work")).toBe(false);

    act(() => result.current.edit("t-work", { icon: "book" }));
    act(() => result.current.discard("t-work"));
    expect(result.current.isDirty("t-work")).toBe(false);
    expect(result.current.editsFor("t-work")).toEqual({});
  });

  it("writes nothing for a draft that matches the live tag", () => {
    const w = writers();
    const { result } = renderHook(() => useTagEditDrafts([TAG], w));

    act(() => result.current.edit("t-work", { name: "  Work " }));
    act(() => result.current.save("t-work"));
    expect(w.setTagName).not.toHaveBeenCalled();
  });
});
