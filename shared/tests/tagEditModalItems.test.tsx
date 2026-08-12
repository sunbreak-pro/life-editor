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
import { TAG_LABELS, TAG_ROLE_LABELS, selectTagRow } from "./tagEditLabels";

/*
 * #409 — the tag editor's per-tag item list. The panel is app-global, so the
 * tag being edited discloses the items carrying it and each row states its KIND
 * (task / event / note / daily) and can be detached.
 *
 * #740 moved that list out from under a count-pill disclosure and into the
 * editor column: the right side is already about one tag, so its memberships
 * are simply part of the pane instead of something to unfold. What the tests
 * pin is unchanged otherwise — the kind badges, unassign wiring, and the
 * unknown-role fallback (an assignment whose item cannot be resolved must still
 * be listed and removable).
 */

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

type ModalProps = React.ComponentProps<typeof TagEditModal>;

function baseProps(over: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    onClose: vi.fn(),
    tags: [],
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetColor: vi.fn(),
    onSetIcon: vi.fn(),
    onUnassign: vi.fn(),
    formatCount: (count: number) => `${count} items`,
    labels: TAG_LABELS,
    ...over,
  };
}

function renderModal(rows: TagEditRow[], over: Partial<ModalProps> = {}) {
  const onUnassign = vi.fn();
  const onDelete = vi.fn();
  const props = baseProps({ tags: rows, onUnassign, onDelete, ...over });
  const result = render(<TagEditModal {...props} />);
  return { ...result, props, onUnassign, onDelete };
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

const click = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("TagEditModal item list (#409, in the editor column since #740)", () => {
  it("lists the items only once their tag is being edited", () => {
    renderModal([tagRow()]);
    // The list column carries the count and nothing else, so the panel opens
    // as a scannable tag list rather than a wall of items.
    expect(screen.queryByText("Ship the panel")).not.toBeInTheDocument();

    selectTagRow("work");
    expect(screen.getByText("Ship the panel")).toBeInTheDocument();
  });

  // #586 pin, restated for the selection: the panel always reopens on the list.
  it("drops the selection when the panel is reopened", () => {
    const { rerender, props } = renderModal([tagRow()]);
    selectTagRow("work");
    expect(screen.getByText("Ship the panel")).toBeInTheDocument();

    rerender(<TagEditModal {...props} open={false} />);
    rerender(<TagEditModal {...props} open />);

    expect(screen.queryByText("Ship the panel")).not.toBeInTheDocument();
    expect(screen.getByText(TAG_LABELS.detailEmpty)).toBeInTheDocument();
  });

  it("labels each item with its kind so the four roles are distinguishable", () => {
    renderModal([tagRow()]);
    selectTagRow("work");

    for (const role of ITEM_ROLE_ORDER) {
      expect(screen.getByText(TAG_ROLE_LABELS[role])).toBeInTheDocument();
    }
  });

  it("reports the assignment id when an item's tag is removed", () => {
    const { onUnassign } = renderModal([tagRow()]);
    selectTagRow("work");

    click("Remove this tag: Standup");
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
    selectTagRow("work");

    expect(screen.getByText("Other")).toBeInTheDocument();
    click("Remove this tag: (untitled)");
    expect(onUnassign).toHaveBeenCalledExactlyOnceWith("a-9");
  });

  it("shows the empty copy for a tag that carries nothing", () => {
    renderModal([tagRow({ count: 0, items: [] })]);
    selectTagRow("work");
    expect(screen.getByText("Nothing carries this tag")).toBeInTheDocument();
  });

  it("omits the membership section entirely when items are absent", () => {
    renderModal([tagRow({ items: undefined })]);
    // The count still reads from the list row — a host that supplies no
    // `items` gets the pre-#409 count-only shape.
    expect(screen.getByRole("button", { name: "work: 4 items" })).toBeTruthy();

    selectTagRow("work");
    expect(screen.queryByText(TAG_LABELS.itemsHeading)).toBeNull();
    expect(screen.queryByText("Nothing carries this tag")).toBeNull();
  });

  it("shows one tag's items at a time", () => {
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

    selectTagRow("home");
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("Ship the panel")).not.toBeInTheDocument();
  });

  it("deletes the tag being edited from the editor footer", () => {
    const { onDelete } = renderModal([tagRow()]);
    selectTagRow("work");

    click("Delete tag");
    expect(onDelete).toHaveBeenCalledExactlyOnceWith("tag-1");
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
    expect(itemRoleLabel("task", TAG_ROLE_LABELS)).toBe("Task");
    expect(itemRoleLabel("routine", TAG_ROLE_LABELS)).toBe("Other");
    expect(itemRoleLabel(null, TAG_ROLE_LABELS)).toBe("Other");
  });

  it("sorts designed kinds in order and unknowns last", () => {
    const sorted = ["routine", "daily", "task", "note", "event"].sort(
      (a, b) => itemRoleSortKey(a) - itemRoleSortKey(b),
    );
    expect(sorted).toEqual(["task", "event", "note", "daily", "routine"]);
  });
});
