import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagEditModal, type TagEditRow } from "../src/components";

/*
 * #368 — the tag master list's name filter. The tag editor is the app's only
 * view of every tag ever made, so it needs a way to narrow the list. Scoped to
 * filtering ONLY: no sort controls, because the host receives `allTags` already
 * name-ordered from the service query (D-20260728-main-3).
 *
 * Covers narrowing, case-insensitivity, the no-match copy, the "nothing to
 * narrow" guard, that filtering leaves the add row working, and the
 * reset-on-reopen contract.
 */

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
  roles: {
    task: "Task",
    event: "Event",
    note: "Note",
    daily: "Daily",
    unknown: "Other",
  },
};

// Name-ordered like the service query delivers them (`.order("name")`), with a
// deliberate case mix + an overlapping pair ("work" is a substring of
// "homework") so the assertions pin substring semantics, not prefix matching.
const ROWS: TagEditRow[] = [
  { id: "tag-1", name: "Home", color: null, icon: null, count: 1 },
  { id: "tag-2", name: "homework", color: null, icon: null, count: 0 },
  { id: "tag-3", name: "work", color: null, icon: null, count: 2 },
];

type ModalProps = React.ComponentProps<typeof TagEditModal>;

function props(over: Partial<ModalProps> = {}): ModalProps {
  return {
    open: true,
    onClose: vi.fn(),
    tags: ROWS,
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onSetColor: vi.fn(),
    onSetIcon: vi.fn(),
    formatCount: (count: number) => `${count} items`,
    labels: LABELS,
    ...over,
  };
}

/** The rename input of each visible row carries the tag name as its value. */
const visibleNames = () =>
  screen
    .getAllByLabelText("Rename tag")
    .map((input) => (input as HTMLInputElement).value);

const filterInput = () => screen.getByLabelText("Filter tags by name");

describe("TagEditModal name filter (#368)", () => {
  it("lists every tag until a query is typed", () => {
    render(<TagEditModal {...props()} />);
    expect(visibleNames()).toEqual(["Home", "homework", "work"]);
  });

  it("narrows the list to names containing the query", () => {
    render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "home" } });
    expect(visibleNames()).toEqual(["Home", "homework"]);
  });

  it("matches anywhere in the name, not just the start", () => {
    render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "work" } });
    expect(visibleNames()).toEqual(["homework", "work"]);
  });

  it("ignores case on both sides", () => {
    render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "HOME" } });
    expect(visibleNames()).toEqual(["Home", "homework"]);
  });

  it("ignores surrounding whitespace", () => {
    render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "  work  " } });
    expect(visibleNames()).toEqual(["homework", "work"]);
  });

  it("shows the no-match copy instead of an empty list", () => {
    render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "zzz" } });
    expect(screen.getByText("No tags match")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rename tag")).toBeNull();
    // Not the "no tags at all" copy — the tags exist, they are just hidden.
    expect(screen.queryByText("No tags yet")).toBeNull();
  });

  it("renders no filter row when there is nothing to narrow", () => {
    render(<TagEditModal {...props({ tags: [] })} />);
    expect(screen.queryByLabelText("Filter tags by name")).toBeNull();
    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("keeps the add row working while the list is filtered, and releases the query", () => {
    const onCreate = vi.fn();
    render(<TagEditModal {...props({ onCreate })} />);
    fireEvent.change(filterInput(), { target: { value: "zzz" } });
    expect(screen.getByText("No tags match")).toBeInTheDocument();

    const add = screen.getByLabelText("Add");
    fireEvent.change(add, { target: { value: "errand" } });
    fireEvent.keyDown(add, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("errand");

    // The query is dropped on create: leaving it on would hide the tag the host
    // is about to add, so the panel would look exactly as it did before — and a
    // second Add attempt would hit the unique-name constraint silently.
    expect((filterInput() as HTMLInputElement).value).toBe("");
    expect(visibleNames()).toEqual(["Home", "homework", "work"]);
  });

  it("clears the query when the panel is reopened", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    fireEvent.change(filterInput(), { target: { value: "zzz" } });
    expect(screen.getByText("No tags match")).toBeInTheDocument();

    rerender(<TagEditModal {...props({ open: false })} />);
    rerender(<TagEditModal {...props()} />);

    expect(screen.queryByText("No tags match")).toBeNull();
    expect(visibleNames()).toEqual(["Home", "homework", "work"]);
    expect((filterInput() as HTMLInputElement).value).toBe("");
  });

  // #586 pin: the add-field draft follows the same reset-on-reopen contract
  // as the filter query.
  it("clears the add draft when the panel is reopened", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    const add = () => screen.getByLabelText("Add") as HTMLInputElement;
    fireEvent.change(add(), { target: { value: "half-typed" } });

    rerender(<TagEditModal {...props({ open: false })} />);
    rerender(<TagEditModal {...props()} />);

    expect(add().value).toBe("");
  });

  // #586 pin: a rename that lands from outside (another surface / sync)
  // re-seeds the row's local editable name.
  it("adopts a tag name that changes from outside", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    expect(visibleNames()).toEqual(["Home", "homework", "work"]);

    const renamed = ROWS.map((r) =>
      r.id === "tag-3" ? { ...r, name: "chores" } : r,
    );
    rerender(<TagEditModal {...props({ tags: renamed })} />);

    expect(visibleNames()).toEqual(["Home", "homework", "chores"]);
  });
});
