import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { TagEditModal, type TagEditRow } from "../src/components";
import {
  TAG_LABELS,
  nameField,
  saveButton,
  selectTagRow,
  typeName,
} from "./tagEditLabels";

/*
 * #715 (Epic #627 — ユーザー裁定 D-20260810-sched-1 = A): the tag editor commits
 * ONLY from its save button.
 *
 * Before this the name committed on blur while the icon / color pickers wrote on
 * the click, so one panel confirmed edits two different ways and merely tabbing
 * out of the field renamed a tag — a rename that does not stop at this screen,
 * because a wiki tag is referenced from every item carrying it.
 *
 * #740 (ユーザー裁定 D-20260812-tags-1) rebuilt the panel as two columns, so the
 * same contract is now pinned against ONE save button in the editor footer:
 * editing starts by selecting a tag in the list, and the button is always there
 * — disabled while there is nothing to write, never appearing and disappearing
 * under the cursor.
 *
 * What the tests pin: blur writes nothing, the button (and Enter) writes
 * everything that moved, an IME-confirming Enter is not a save, the pending
 * draft survives both the #368 filter and a change of selection, leaving a tag
 * with unsaved edits asks first, and the panel reports its dirty state so the
 * host can guard the close.
 */

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
    labels: TAG_LABELS,
    ...over,
  };
}

/** Render with "work" already open in the editor — the start of every edit. */
function renderEditing(over: Partial<ModalProps> = {}) {
  const result = render(<TagEditModal {...props(over)} />);
  selectTagRow("work");
  return result;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TagEditModal — rename commits on the save button (#715)", () => {
  it("keeps the typed name as a draft when the field loses focus", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });

    typeName("chores");
    fireEvent.blur(nameField());

    expect(onRename).not.toHaveBeenCalled();
    // The draft survives the blur — losing focus is not "cancel" either.
    expect(nameField().value).toBe("chores");
  });

  it("writes the rename when the save button is pressed", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });

    typeName("chores");
    fireEvent.click(saveButton());

    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  it("trims the saved name and refuses one that is only whitespace", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });

    typeName("   ");
    // Nothing to write, so the button is off rather than pressable-and-inert
    // (#434 S-1).
    expect(saveButton()).toBeDisabled();

    typeName("  chores  ");
    fireEvent.click(saveButton());
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  it("puts the stored name back when the field is left blank", () => {
    renderEditing();

    typeName("");
    expect(nameField().value).toBe("");

    fireEvent.blur(nameField());
    // Showing an empty field the panel would never save is a screen that
    // disagrees with the state behind it.
    expect(nameField().value).toBe("work");
  });

  /*
   * The #740 layout pin. The save button used to be rendered only while its row
   * had something pending, so starting or abandoning a draft shifted the three
   * controls to its right — on every keystroke that crossed the threshold. One
   * permanent button, toggled by `disabled`, is what replaced that.
   */
  it("keeps the save button in place, disabled, while nothing is pending", () => {
    renderEditing();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();

    typeName("chores");
    expect(saveButton()).toBeEnabled();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    typeName("work");
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("saves on Enter, but never on the Enter that confirms an IME conversion", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });

    typeName("しごと");
    // #670: the composition-confirming Enter must not reach the commit.
    fireEvent.keyDown(nameField(), { key: "Enter", isComposing: true });
    expect(onRename).not.toHaveBeenCalled();
    // Some IMEs report the legacy keyCode instead.
    fireEvent.keyDown(nameField(), { key: "Enter", keyCode: 229 });
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.keyDown(nameField(), { key: "Enter" });
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "しごと");
  });

  it("edits one tag at a time — a draft never leaks into another", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });

    typeName("chores");
    // The list follows the draft (one name on screen, not two), while the tag
    // that was never touched keeps its stored one.
    expect(
      screen.getByRole("button", { name: "chores: 2 items" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "home: 0 items" })).toBeTruthy();

    fireEvent.click(saveButton());
    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
  });

  // #586 pin, restated for the draft model: an untouched tag still follows the
  // live row, so a rename landing from sync / MCP is not reverted by a stale
  // local copy.
  it("adopts an outside rename on a tag the user has not touched", () => {
    const { rerender } = render(<TagEditModal {...props()} />);
    selectTagRow("home");
    expect(nameField().value).toBe("home");

    const renamed = ROWS.map((r) =>
      r.id === "tag-2" ? { ...r, name: "house" } : r,
    );
    rerender(<TagEditModal {...props({ tags: renamed })} />);

    expect(nameField().value).toBe("house");
  });
});

describe("TagEditModal — icon and color join the same save (#715)", () => {
  it("holds an icon pick until the tag is saved", () => {
    const onSetIcon = vi.fn();
    renderEditing({ onSetIcon });

    fireEvent.click(screen.getByLabelText("Icon"));
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    expect(onSetIcon).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    expect(onSetIcon).toHaveBeenCalledExactlyOnceWith("tag-1", "Star");
  });

  it("holds a color pick until the tag is saved", () => {
    const onSetColor = vi.fn();
    renderEditing({ onSetColor });

    fireEvent.click(screen.getByLabelText("Color"));
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));
    expect(onSetColor).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    expect(onSetColor).toHaveBeenCalledExactlyOnceWith("tag-1", "#2563eb");
  });

  it("commits every changed field of the tag in one press", () => {
    const onRename = vi.fn();
    const onSetIcon = vi.fn();
    const onSetColor = vi.fn();
    renderEditing({ onRename, onSetIcon, onSetColor });

    typeName("chores");
    fireEvent.click(screen.getByLabelText("Icon"));
    fireEvent.click(screen.getByRole("button", { name: "Star" }));
    fireEvent.click(screen.getByLabelText("Color"));
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));

    fireEvent.click(saveButton());

    expect(onRename).toHaveBeenCalledExactlyOnceWith("tag-1", "chores");
    expect(onSetIcon).toHaveBeenCalledExactlyOnceWith("tag-1", "Star");
    expect(onSetColor).toHaveBeenCalledExactlyOnceWith("tag-1", "#2563eb");
  });
});

/*
 * #740: selecting another tag unmounts the editor, so it is a way to lose a
 * draft that #715 did not have to answer for. The panel asks with the in-app
 * <ConfirmDialog> the app switched to in #729 — `window.confirm` would land
 * outside the theme and freeze the page.
 */
describe("TagEditModal — switching tags with unsaved edits (#740)", () => {
  const discardDialog = () => screen.queryByText(TAG_LABELS.switchConfirm);

  it("switches without a word when nothing is pending", () => {
    render(<TagEditModal {...props()} />);
    selectTagRow("work");
    selectTagRow("home");

    expect(discardDialog()).toBeNull();
    expect(nameField().value).toBe("home");
  });

  it("asks before leaving a draft behind, and stays put when refused", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });
    typeName("chores");

    selectTagRow("home");
    expect(discardDialog()).not.toBeNull();
    // Nothing has moved yet: the editor is still on the tag being edited.
    expect(nameField().value).toBe("chores");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(discardDialog()).toBeNull();
    expect(nameField().value).toBe("chores");
    expect(onRename).not.toHaveBeenCalled();
  });

  it("throws the draft away when the switch is confirmed", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });
    typeName("chores");

    selectTagRow("home");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(discardDialog()).toBeNull();
    expect(nameField().value).toBe("home");
    expect(onRename).not.toHaveBeenCalled();

    // Discarded means gone: coming back shows the stored name, and the panel
    // has stopped reporting itself dirty.
    selectTagRow("work");
    expect(nameField().value).toBe("work");
    expect(saveButton()).toBeDisabled();
  });

  it("keeps a saved-and-unchanged tag switchable", () => {
    const onRename = vi.fn();
    renderEditing({ onRename });
    typeName("chores");
    fireEvent.click(saveButton());

    // The write is in flight, so the overlay still differs from the stored
    // name — leaving now would still lose it if the write never lands.
    selectTagRow("home");
    expect(discardDialog()).not.toBeNull();
  });
});

describe("TagEditModal — unsaved drafts and the close guard (#715)", () => {
  it("discards the drafts when the panel is closed without saving", () => {
    const onRename = vi.fn();
    const { rerender } = renderEditing({ onRename });

    typeName("chores");
    rerender(<TagEditModal {...props({ onRename, open: false })} />);
    rerender(<TagEditModal {...props({ onRename })} />);

    expect(onRename).not.toHaveBeenCalled();
    // The panel also reopens on the list, not on whatever was being edited.
    expect(screen.queryByLabelText("Rename tag")).toBeNull();
    selectTagRow("work");
    expect(nameField().value).toBe("work");
    expect(saveButton()).toBeDisabled();
  });

  // The #368 filter unmounts the rows it hides, and #740 lets the selection
  // outlive them. A draft held any lower would be thrown away by typing in the
  // search box — silently, which is the loss the save button exists to make
  // impossible.
  it("keeps a pending draft alive while the filter hides its row", () => {
    renderEditing();
    typeName("chores");

    const filter = screen.getByLabelText("Filter tags by name");
    fireEvent.change(filter, { target: { value: "home" } });
    expect(screen.getByRole("button", { name: "home: 0 items" })).toBeTruthy();
    // The editor stays on the tag being edited even once the list stops
    // showing it.
    expect(nameField().value).toBe("chores");

    fireEvent.change(filter, { target: { value: "" } });
    expect(nameField().value).toBe("chores");
  });

  it("reports the panel-wide dirty state to the host", () => {
    const onDirtyChange = vi.fn();
    const { rerender, unmount } = renderEditing({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    typeName("chores");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    // Dirty counts tags the filter is hiding: the draft is still there.
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
    const { rerender } = renderEditing({ onDirtyChange });
    typeName("chores");
    fireEvent.click(saveButton());
    // Still pending while the write is in flight — the overlay keeps showing
    // what was typed instead of snapping back to the old name.
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(nameField().value).toBe("chores");

    const renamed = ROWS.map((r) =>
      r.id === "tag-1" ? { ...r, name: "chores" } : r,
    );
    rerender(<TagEditModal {...props({ onDirtyChange, tags: renamed })} />);

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(saveButton()).toBeDisabled();
  });
});

/*
 * The host wiring TagEditorHost uses, reduced to the parts under test.
 *
 * `askDiscard` returns a PROMISE on purpose: since #707 the question is the
 * in-app <ConfirmDialog>, which answers a tick later, and a guard that read the
 * pending promise as a truthy "yes" would discard the draft the moment the
 * dialog opened.
 */
function Harness({
  onRename,
  askDiscard,
}: {
  onRename: (id: string, name: string) => void;
  askDiscard: () => Promise<boolean>;
}) {
  const dirtyRef = useRef(false);
  const [open, setOpen] = useState(true);
  const close = async () => {
    if (dirtyRef.current && !(await askDiscard())) return;
    dirtyRef.current = false;
    setOpen(false);
  };
  return (
    <TagEditModal
      {...props({ onRename, open })}
      onClose={() => void close()}
      onDirtyChange={(dirty) => {
        dirtyRef.current = dirty;
      }}
    />
  );
}

const panelIsOpen = () => screen.queryByRole("dialog") !== null;
const pressEscape = () => fireEvent.keyDown(document, { key: "Escape" });

describe("TagEditModal — the host's unsaved-close guard (#715, same shape as #628)", () => {
  it("closes without a word when nothing is pending", async () => {
    const askDiscard = vi.fn().mockResolvedValue(true);
    render(<Harness onRename={vi.fn()} askDiscard={askDiscard} />);

    pressEscape();
    // Asking to discard when there is nothing to discard is the fastest way to
    // teach the user to dismiss the dialog without reading it.
    expect(askDiscard).not.toHaveBeenCalled();
    await waitFor(() => expect(panelIsOpen()).toBe(false));
  });

  it("asks before discarding, and stays open when the answer is no", async () => {
    const askDiscard = vi.fn().mockResolvedValue(false);
    render(<Harness onRename={vi.fn()} askDiscard={askDiscard} />);

    selectTagRow("work");
    typeName("chores");
    pressEscape();

    await waitFor(() => expect(askDiscard).toHaveBeenCalledOnce());
    expect(panelIsOpen()).toBe(true);
    expect(nameField().value).toBe("chores");
  });

  it("keeps the draft while the question is still on screen", async () => {
    // The promise is still pending here — exactly the state the panel is in
    // for as long as the in-app dialog waits for an answer (#729). Reading it
    // as a truthy "yes" would throw the draft away the moment the dialog
    // opened, which is what `window.confirm` never did (it blocked instead).
    let answer: (discard: boolean) => void = () => {};
    const askDiscard = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    render(<Harness onRename={vi.fn()} askDiscard={askDiscard} />);

    selectTagRow("work");
    typeName("chores");
    pressEscape();

    await waitFor(() => expect(askDiscard).toHaveBeenCalledOnce());
    expect(panelIsOpen()).toBe(true);
    expect(nameField().value).toBe("chores");

    answer(true);
    await waitFor(() => expect(panelIsOpen()).toBe(false));
  });

  it("throws the draft away when the answer is yes", async () => {
    const onRename = vi.fn();
    render(
      <Harness
        onRename={onRename}
        askDiscard={vi.fn().mockResolvedValue(true)}
      />,
    );

    selectTagRow("work");
    typeName("chores");
    pressEscape();

    await waitFor(() => expect(panelIsOpen()).toBe(false));
    expect(onRename).not.toHaveBeenCalled();
  });
});
