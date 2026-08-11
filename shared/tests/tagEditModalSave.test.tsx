import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef, useState } from "react";
import { TagEditModal, type TagEditRow } from "../src/components";

/*
 * #715 (Epic #627 — ユーザー裁定 D-20260810-sched-1 = A): the tag editor commits
 * ONLY from a row's save button.
 *
 * Before this the name committed on blur while the icon / color pickers wrote on
 * the click, so one panel confirmed edits two different ways and merely tabbing
 * out of the field renamed a tag — a rename that does not stop at this screen,
 * because a wiki tag is referenced from every item carrying it.
 *
 * What the tests pin: blur writes nothing, the button (and Enter) writes
 * everything that moved, an IME-confirming Enter is not a save, the pending
 * draft survives the #368 filter, and the panel reports its dirty state so the
 * host can guard the close.
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
  saveLabel: "Save",
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

const ROWS: TagEditRow[] = [
  { id: "tag-1", name: "work", color: null, icon: null, count: 2 },
  { id: "tag-2", name: "home", color: null, icon: null, count: 0 },
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

const nameInput = (index = 0) =>
  screen.getAllByLabelText("Rename tag")[index] as HTMLInputElement;
const saveButton = (tagName: string) =>
  screen.queryByRole("button", { name: `Save: ${tagName}` });
const typeName = (value: string, index = 0) =>
  fireEvent.change(nameInput(index), { target: { value } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TagEditModal — rename commits on the save button (#715)", () => {
  it("keeps the typed name as a draft when the field loses focus", () => {
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    typeName("chores");
    fireEvent.blur(nameInput());

    expect(onRename).not.toHaveBeenCalled();
    // The draft survives the blur — losing focus is not "cancel" either.
    expect(nameInput().value).toBe("chores");
  });

  it("writes the rename when the save button is pressed", () => {
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    typeName("chores");
    fireEvent.click(saveButton("work")!);

    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  it("trims the saved name and refuses one that is only whitespace", () => {
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    typeName("   ");
    // Nothing to write, so there is no button to press (#434 S-1).
    expect(saveButton("work")).toBeNull();

    typeName("  chores  ");
    fireEvent.click(saveButton("work")!);
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  it("puts the stored name back when the field is left blank", () => {
    render(<TagEditModal {...props()} />);

    typeName("");
    expect(nameInput().value).toBe("");

    fireEvent.blur(nameInput());
    // Showing an empty field the panel would never save is a screen that
    // disagrees with the state behind it.
    expect(nameInput().value).toBe("work");
  });

  it("offers no save button while the name matches the stored one", () => {
    render(<TagEditModal {...props()} />);
    expect(saveButton("work")).toBeNull();

    typeName("chores");
    expect(saveButton("work")).not.toBeNull();

    typeName("work");
    expect(saveButton("work")).toBeNull();
  });

  it("saves on Enter, but never on the Enter that confirms an IME conversion", () => {
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    typeName("しごと");
    // #670: the composition-confirming Enter must not reach the commit.
    fireEvent.keyDown(nameInput(), { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    // Some IMEs report the legacy keyCode instead.
    fireEvent.keyDown(nameInput(), { key: "Enter", keyCode: 229 });
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.keyDown(nameInput(), { key: "Enter" });
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "しごと");
  });

  it("edits one row at a time — a draft never leaks into its neighbour", () => {
    const onRename = vi.fn();
    render(<TagEditModal {...props({ onRename })} />);

    typeName("chores", 0);
    expect(nameInput(1).value).toBe("home");
    expect(saveButton("home")).toBeNull();

    fireEvent.click(saveButton("work")!);
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  // #586 pin, restated for the draft model: an untouched row still follows the
  // live tag, so a rename landing from sync / MCP is not reverted by a stale
  // local copy.
  it("adopts an outside rename on a row the user has not touched", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    const renamed = ROWS.map((r) =>
      r.id === "tag-2" ? { ...r, name: "house" } : r,
    );
    rerender(<TagEditModal {...props({ tags: renamed })} />);

    expect(nameInput(1).value).toBe("house");
  });
});

describe("TagEditModal — icon and color join the same save (#715)", () => {
  it("holds an icon pick until the row is saved", () => {
    const onSetIcon = vi.fn();
    render(<TagEditModal {...props({ onSetIcon })} />);

    fireEvent.click(screen.getAllByLabelText("Icon")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    expect(onSetIcon).not.toHaveBeenCalled();

    fireEvent.click(saveButton("work")!);
    expect(onSetIcon).toHaveBeenCalledExactlyOnceWith("tag-1", "Star");
  });

  it("holds a color pick until the row is saved", () => {
    const onSetColor = vi.fn();
    render(<TagEditModal {...props({ onSetColor })} />);

    fireEvent.click(screen.getAllByLabelText("Color")[0]);
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));
    expect(onSetColor).not.toHaveBeenCalled();

    fireEvent.click(saveButton("work")!);
    expect(onSetColor).toHaveBeenCalledExactlyOnceWith("tag-1", "#2563eb");
  });

  it("commits every changed field of the row in one press", () => {
    const onRename = vi.fn();
    const onSetIcon = vi.fn();
    const onSetColor = vi.fn();
    render(<TagEditModal {...props({ onRename, onSetIcon, onSetColor })} />);

    typeName("chores");
    fireEvent.click(screen.getAllByLabelText("Icon")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    fireEvent.click(screen.getAllByLabelText("Color")[0]);
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));

    fireEvent.click(saveButton("work")!);

    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
    expect(onSetIcon).toHaveBeenCalledExactlyOnceWith("tag-1", "Star");
    expect(onSetColor).toHaveBeenCalledExactlyOnceWith("tag-1", "#2563eb");
  });
});

describe("TagEditModal — unsaved drafts and the close guard (#715)", () => {
  it("discards the drafts when the panel is closed without saving", () => {
    const onRename = vi.fn();
    const { rerender } = render(<TagEditModal {...props({ onRename })} />);

    typeName("chores");
    rerender(<TagEditModal {...props({ onRename, open: false })} />);
    rerender(<TagEditModal {...props({ onRename })} />);

    expect(onRename).not.toHaveBeenCalled();
    expect(nameInput().value).toBe("work");
    expect(saveButton("work")).toBeNull();
  });

  // The #368 filter unmounts the rows it hides. A row-local draft would be
  // thrown away by typing in the search box — silently, which is the loss the
  // save button exists to make impossible.
  it("keeps a pending draft alive while the filter hides its row", () => {
    render(<TagEditModal {...props()} />);
    typeName("chores");

    const filter = screen.getByLabelText("Filter tags by name");
    fireEvent.change(filter, { target: { value: "home" } });
    expect(screen.getAllByLabelText("Rename tag")).toHaveLength(1);

    fireEvent.change(filter, { target: { value: "" } });
    expect(nameInput().value).toBe("chores");
  });

  it("reports the panel-wide dirty state to the host", () => {
    const onDirtyChange = vi.fn();
    const { rerender, unmount } = render(
      <TagEditModal {...props({ onDirtyChange })} />,
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    typeName("chores");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // Dirty counts rows the filter is hiding: the draft is still there.
    fireEvent.change(screen.getByLabelText("Filter tags by name"), {
      target: { value: "home" },
    });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    rerender(<TagEditModal {...props({ onDirtyChange, open: false })} />);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    unmount();
    // A host parking this in a ref must not go on guarding a panel that is gone.
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it("stops being dirty once the host's rename comes back through props", () => {
    const onDirtyChange = vi.fn();
    const { rerender } = render(<TagEditModal {...props({ onDirtyChange })} />);
    typeName("chores");
    fireEvent.click(saveButton("work")!);
    // Still pending while the write is in flight — the overlay keeps showing
    // what was typed instead of snapping back to the old name.
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(nameInput().value).toBe("chores");

    const renamed = ROWS.map((r) =>
      r.id === "tag-1" ? { ...r, name: "chores" } : r,
    );
    rerender(<TagEditModal {...props({ onDirtyChange, tags: renamed })} />);

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(saveButton("chores")).toBeNull();
  });
});

/** The host wiring TagEditorHost uses, reduced to the parts under test. */
function Harness({
  onRename,
}: {
  onRename: (id: string, name: string) => void;
}) {
  const dirtyRef = useRef(false);
  const [open, setOpen] = useState(true);
  const close = () => {
    if (dirtyRef.current && !window.confirm("Discard?")) return;
    dirtyRef.current = false;
    setOpen(false);
  };
  return (
    <TagEditModal
      {...props({ onRename, open })}
      onClose={close}
      onDirtyChange={(dirty) => {
        dirtyRef.current = dirty;
      }}
    />
  );
}

const panelIsOpen = () => screen.queryByRole("dialog") !== null;
const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

describe("TagEditModal — the host's unsaved-close guard (#715, same shape as #628)", () => {
  it("closes without a word when nothing is pending", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness onRename={vi.fn()} />);

    pressEscape();
    // Asking to discard when there is nothing to discard is the fastest way to
    // teach the user to dismiss the dialog without reading it.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(panelIsOpen()).toBe(false);
  });

  it("asks before discarding, and stays open when the answer is no", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness onRename={vi.fn()} />);

    typeName("chores");
    pressEscape();

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(panelIsOpen()).toBe(true);
    expect(nameInput().value).toBe("chores");
  });

  it("throws the draft away when the answer is yes", () => {
    const onRename = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness onRename={onRename} />);

    typeName("chores");
    pressEscape();

    expect(panelIsOpen()).toBe(false);
    expect(onRename).not.toHaveBeenCalled();
  });
});
