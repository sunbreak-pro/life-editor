import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TagEditModal,
  ITEM_ROLE_ORDER,
  resolveItemRole,
  itemRoleLabel,
  itemRoleSortKey,
  type TagEditItem,
  type TagEditRow,
} from "../src/components";

/*
 * #409 — the tag editor's per-tag item list. The panel is now app-global, so a
 * tag row discloses the items carrying it and each row states its KIND
 * (task / event / note / daily) and can be detached. Covers the disclosure, the
 * kind badges, unassign wiring, and the unknown-role fallback (an assignment
 * whose item cannot be resolved must still be listed and removable).
 */

const ROLES = {
  task: "Task",
  event: "Event",
  note: "Note",
  daily: "Daily",
  unknown: "Other",
};

const LABELS = {
  title: "Edit tags",
  addPlaceholder: "Enter a tag name",
  addButton: "Add",
  empty: "No tags yet",
  filterPlaceholder: "Filter tags…",
  filterLabel: "Filter tags by name",
  filterEmpty: "No tags match",
  renameLabel: "Rename tag",
  deleteLabel: "Delete tag",
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  colorLabel: "Color",
  colorClearLabel: "Default color",
  colorCustomLabel: "Custom",
  itemsToggleLabel: "Show tagged items",
  itemsEmpty: "Nothing carries this tag",
  unassignLabel: "Remove this tag",
  roles: ROLES,
};

const ITEMS: TagEditItem[] = [
  {
    assignmentId: "a-1",
    itemId: "task-1",
    role: "task",
    title: "Ship the panel",
  },
  { assignmentId: "a-2", itemId: "event-1", role: "event", title: "Standup" },
  { assignmentId: "a-3", itemId: "note-1", role: "note", title: "Scratch" },
  {
    assignmentId: "a-4",
    itemId: "daily-2026-07-27",
    role: "daily",
    title: "2026-07-27",
  },
];

function renderModal(
  rows: TagEditRow[],
  overrides?: Partial<Parameters<typeof TagEditModal>[0]>,
) {
  const onUnassign = vi.fn();
  const onDelete = vi.fn();
  render(
    <TagEditModal
      open
      onClose={vi.fn()}
      tags={rows}
      onCreate={vi.fn()}
      onRename={vi.fn()}
      onDelete={onDelete}
      onSetColor={vi.fn()}
      onSetIcon={vi.fn()}
      onUnassign={onUnassign}
      formatCount={(count) => `${count} items`}
      labels={LABELS}
      {...overrides}
    />,
  );
  return { onUnassign, onDelete };
}

const tagRow = (over?: Partial<TagEditRow>): TagEditRow => ({
  id: "tag-1",
  name: "work",
  color: null,
  icon: null,
  count: ITEMS.length,
  items: ITEMS,
  ...over,
});

describe("TagEditModal item list (#409)", () => {
  it("keeps the item list collapsed until the count pill is pressed", () => {
    renderModal([tagRow()]);
    expect(screen.queryByText("Ship the panel")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: work" }),
    );
    expect(screen.getByText("Ship the panel")).toBeInTheDocument();
  });

  it("labels each item with its kind so the four roles are distinguishable", () => {
    renderModal([tagRow()]);
    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: work" }),
    );

    for (const role of ITEM_ROLE_ORDER) {
      expect(screen.getByText(ROLES[role])).toBeInTheDocument();
    }
  });

  it("reports the assignment id when an item's tag is removed", () => {
    const { onUnassign } = renderModal([tagRow()]);
    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: work" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove this tag: Standup" }),
    );
    expect(onUnassign).toHaveBeenCalledExactlyOnceWith("a-2");
  });

  it("lists an unresolvable item under the neutral kind, still removable", () => {
    const orphan: TagEditItem = {
      assignmentId: "a-9",
      itemId: "routine-1",
      role: "",
      title: "(untitled)",
    };
    const { onUnassign } = renderModal([tagRow({ count: 1, items: [orphan] })]);
    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: work" }),
    );

    expect(screen.getByText("Other")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove this tag: (untitled)" }),
    );
    expect(onUnassign).toHaveBeenCalledExactlyOnceWith("a-9");
  });

  it("shows the empty copy for a tag that carries nothing", () => {
    renderModal([tagRow({ count: 0, items: [] })]);
    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: work" }),
    );
    expect(screen.getByText("Nothing carries this tag")).toBeInTheDocument();
  });

  it("leaves the count as static text (no disclosure) when items are absent", () => {
    renderModal([tagRow({ items: undefined })]);
    expect(
      screen.queryByRole("button", { name: "Show tagged items: work" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("4 items")).toBeInTheDocument();
  });

  it("expands rows independently", () => {
    renderModal([
      tagRow(),
      tagRow({
        id: "tag-2",
        name: "home",
        count: 1,
        items: [
          {
            assignmentId: "b-1",
            itemId: "note-2",
            role: "note",
            title: "Groceries",
          },
        ],
      }),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Show tagged items: home" }),
    );
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Ship the panel")).not.toBeInTheDocument();
  });
});

describe("item-kind display contract (#409, shared with #412)", () => {
  it("resolves only the four user-facing roles", () => {
    expect(ITEM_ROLE_ORDER).toEqual(["task", "event", "note", "daily"]);
    for (const role of ITEM_ROLE_ORDER) {
      expect(resolveItemRole(role)).toBe(role);
    }
    // Routine is an implementation detail of Event (CLAUDE.md §4 / #185) and
    // owns no tag surface, so it is deliberately outside the designed set.
    expect(resolveItemRole("routine")).toBeNull();
    expect(resolveItemRole("")).toBeNull();
    expect(resolveItemRole(undefined)).toBeNull();
  });

  it("falls back to the unknown label outside the set", () => {
    expect(itemRoleLabel("task", ROLES)).toBe("Task");
    expect(itemRoleLabel("routine", ROLES)).toBe("Other");
    expect(itemRoleLabel(null, ROLES)).toBe("Other");
  });

  it("sorts designed kinds in order and unknowns last", () => {
    const sorted = ["routine", "daily", "task", "note", "event"].sort(
      (a, b) => itemRoleSortKey(a) - itemRoleSortKey(b),
    );
    expect(sorted).toEqual(["task", "event", "note", "daily", "routine"]);
  });
});
