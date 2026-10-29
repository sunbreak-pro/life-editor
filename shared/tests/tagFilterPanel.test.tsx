import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TagFilterPanel,
  type TagFilterPanelGroup,
  type TagFilterPanelLabels,
  type TagFilterPanelProps,
} from "../src/components/schedule";

/*
 * TagFilterPanel (#1173) — the surface behind the Calendar toolbar's filter
 * button, and the ONLY place the Issue's multi-select contract is machine-
 * checked: CalendarTab needs the whole Provider stack plus real layout, and
 * jsdom has neither.
 *
 * It also carries over the two rules the retired CalendarView suite pinned,
 * because both are about not accusing the user of something the data has not
 * said yet: nothing is called broken while the tag list is still arriving, and
 * a filter that could only ever empty the grid is never offered.
 *
 * #2155 rebuilt the panel from the Claude Design proposal: a group row is one
 * press (apply, and press again to take it off), renaming lives in the
 * pencil's editor, and the new-group name field opens from one button.
 */

const LABELS: TagFilterPanelLabels = {
  tagsLabel: "Tags to show",
  noTags: "Create a tag first.",
  tagsLoading: "Loading tags…",
  clear: "Clear",
  close: "Close",
  groupsHeading: "Saved groups",
  groupsEmpty: "No groups yet.",
  saveCurrent: "Save these tags as a group",
  namePlaceholder: "Group name",
  save: "Save group",
  saveHint: "Tick at least one tag.",
  editTagsSave: "Save",
  cancel: "Cancel",
  editTagsHint: "Tick at least one tag to save.",
  renameGroup: "Rename group",
  groupEmpty: "Every tag in this group is gone.",
};

const TAGS = [
  {
    id: "tag-work",
    name: "Work",
    color: "#336699",
    icon: "Briefcase",
    count: 4,
  },
  { id: "tag-home", name: "Home", color: null, icon: null, count: 2 },
];

function group(over: Partial<TagFilterPanelGroup> = {}): TagFilterPanelGroup {
  return {
    id: "group-1",
    name: "Weekdays",
    tagNames: ["Work"],
    tagIds: ["tag-work"],
    active: false,
    editLabel: "Edit Weekdays",
    deleteLabel: "Delete Weekdays",
    ...over,
  };
}

function renderPanel(over: Partial<TagFilterPanelProps> = {}) {
  const spies = {
    onToggleTag: vi.fn(),
    onClear: vi.fn(),
    onSaveGroup: vi.fn(),
    onApplyGroup: vi.fn(),
    onReleaseGroup: vi.fn(),
    onUpdateGroupTags: vi.fn(),
    onRenameGroup: vi.fn(),
    onDeleteGroup: vi.fn(),
  };
  render(
    <TagFilterPanel
      tags={TAGS}
      selectedTagIds={[]}
      groups={[]}
      labels={LABELS}
      {...spies}
      {...over}
    />,
  );
  return spies;
}

/** The square on the row whose label reads `name`, inside `within`. */
function checkbox(name: string, within: ParentNode = document): HTMLElement {
  const box = [
    ...within.querySelectorAll<HTMLElement>('[role="checkbox"]'),
  ].find((el) => el.closest("label")?.textContent?.includes(name));
  if (!box) throw new Error(`no checkbox for ${name}`);
  return box;
}

const isChecked = (box: HTMLElement): boolean =>
  box.getAttribute("aria-checked") === "true";

describe("TagFilterPanel — the tag multi-select", () => {
  it("reports a ticked tag by id", () => {
    const { onToggleTag } = renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: /Work/ }));
    expect(onToggleTag).toHaveBeenCalledWith("tag-work");
  });

  it("keeps earlier ticks checked when a second tag goes on", () => {
    // The DoD's actual claim. A single-select control would drop the first —
    // which is exactly what the one-tag calendar it replaced did.
    renderPanel({ selectedTagIds: ["tag-work", "tag-home"] });
    expect(isChecked(checkbox("Work"))).toBe(true);
    expect(isChecked(checkbox("Home"))).toBe(true);
  });

  it("ticks with the square selection box, not the browser's own (#2217)", () => {
    renderPanel();
    const rows = screen.getByRole("group", { name: LABELS.tagsLabel });
    expect(rows.querySelector('input[type="checkbox"]')).toBeNull();
    expect(rows.querySelectorAll("[data-select-checkbox-mark]")).toHaveLength(
      2,
    );
  });

  it("shows each tag's own count", () => {
    renderPanel();
    screen.getByText("4");
    screen.getByText("2");
  });

  it("keeps Clear in place but dead while nothing is ticked", () => {
    // One fixed place for it (#2155): a button that appears on the first tick
    // moves everything under it.
    renderPanel();
    const clear = screen.getByRole("button", { name: "Clear" });
    expect((clear as HTMLButtonElement).disabled).toBe(true);
  });

  it("clears once something is ticked", () => {
    const { onClear } = renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("draws a Close at its foot only when the host hands it one", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    const onClose = vi.fn();
    renderPanel({ onClose });
    const close = screen.getByRole("button", { name: "Close" });
    // Narrow only — on wide the frame's corner × is within reach.
    expect(close.className).toContain("md:hidden");
    expect(close.className).toContain("min-h-11");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("says the list is loading rather than 'you have no tags'", () => {
    // Carried over from CalendarView: "not loaded yet" and "you have none"
    // look identical from a lookup, and only one of them is the user's problem.
    renderPanel({ tags: [], tagsLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading tags…");
    expect(screen.queryByText("Create a tag first.")).toBeNull();
  });

  it("asks for a tag once the list is genuinely empty", () => {
    renderPanel({ tags: [], tagsLoading: false });
    screen.getByText("Create a tag first.");
  });
});

describe("TagFilterPanel — saving a group", () => {
  const saveCurrent = (): HTMLButtonElement =>
    screen.getByRole("button", { name: "Save these tags as a group" });

  it("refuses to save with no tag ticked", () => {
    renderPanel({ selectedTagIds: [] });
    expect(saveCurrent().disabled).toBe(true);
    screen.getByText("Tick at least one tag.");
  });

  it("asks for the name only once the button is pressed", () => {
    renderPanel({ selectedTagIds: ["tag-work"] });
    expect(screen.queryByPlaceholderText("Group name")).toBeNull();
    fireEvent.click(saveCurrent());
    expect(screen.getByPlaceholderText("Group name")).toHaveFocus();
  });

  it("refuses to save an unnamed group", () => {
    renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(saveCurrent());
    const save = screen.getByRole("button", { name: "Save group" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the trimmed name and folds the field back", () => {
    const { onSaveGroup } = renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(saveCurrent());
    fireEvent.change(screen.getByPlaceholderText("Group name"), {
      target: { value: "  Work  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    expect(onSaveGroup).toHaveBeenCalledWith("Work");
    expect(screen.queryByPlaceholderText("Group name")).toBeNull();
  });

  it("saves on Enter, but not mid-IME-composition", () => {
    const { onSaveGroup } = renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(saveCurrent());
    const field = screen.getByPlaceholderText("Group name");
    fireEvent.change(field, { target: { value: "仕事" } });

    // The Enter that CONFIRMS a conversion candidate must not also submit.
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onSaveGroup).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSaveGroup).toHaveBeenCalledWith("仕事");
  });

  it("drops the name on Cancel", () => {
    const { onSaveGroup } = renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(saveCurrent());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("Group name")).toBeNull();
    expect(onSaveGroup).not.toHaveBeenCalled();
  });

  it("sinks the disabled Save into the fill (#1803)", () => {
    /*
     * jsdom loads no stylesheet, so "does this look pressable" is not
     * observable here — the assertion is on the lever, exactly as
     * buttonDisabledFill.test.tsx puts it (#1474). Fading an accent fill keeps
     * the hue that reads as "press me", and in dark theme the faded accent
     * lands next to the live one.
     */
    renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(saveCurrent());
    const save = screen.getByRole("button", { name: "Save group" }).className;
    expect(save).not.toMatch(/disabled:opacity-\d/);
    expect(save).toContain("disabled:bg-lumen-surface-sunken");
  });
});

describe("TagFilterPanel — the saved groups", () => {
  const row = (name = "Weekdays"): HTMLElement =>
    screen.getByRole("button", { name });

  it("applies a group with one press on its row", () => {
    const { onApplyGroup } = renderPanel({ groups: [group()] });
    expect(row()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(row());
    expect(onApplyGroup).toHaveBeenCalledWith("group-1");
  });

  it("takes the applied group off with a second press (#2142)", () => {
    const { onReleaseGroup, onApplyGroup } = renderPanel({
      groups: [group({ active: true })],
    });
    expect(row()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(row());
    expect(onReleaseGroup).toHaveBeenCalledTimes(1);
    expect(onApplyGroup).not.toHaveBeenCalled();
  });

  it("lights the applied row and marks it with a check", () => {
    renderPanel({ groups: [group({ active: true })] });
    expect(row().className).toContain("bg-lumen-accent-subtle");
    expect(row().querySelector("svg.lucide-check")).not.toBeNull();
  });

  it("deletes the group the button names", () => {
    const { onDeleteGroup } = renderPanel({ groups: [group()] });
    fireEvent.click(screen.getByRole("button", { name: "Delete Weekdays" }));
    expect(onDeleteGroup).toHaveBeenCalledWith("group-1");
  });

  it("will not apply a group whose tags are all gone", () => {
    // It could only ever empty the grid, and a control that always empties the
    // grid reads as a bug rather than as a filter.
    renderPanel({ groups: [group({ tagNames: [], tagIds: [] })] });
    screen.getByText("Every tag in this group is gone.");
    expect((row() as HTMLButtonElement).disabled).toBe(true);
  });

  it("says so when there is no group yet", () => {
    renderPanel({ groups: [] });
    screen.getByText("No groups yet.");
  });

  it("gives every row control a 44px floor on narrow (#1512)", () => {
    renderPanel({ groups: [group()] });
    expect(row().className).toContain("max-md:min-h-11");
    for (const name of ["Edit Weekdays", "Delete Weekdays"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "max-md:size-11",
      );
    }
  });
});

describe("TagFilterPanel — the tag rows carry the tag's icon (#1291)", () => {
  /** The tag glyphs, leaving out the lucide tick inside each square. */
  const glyphs = (): SVGElement[] => {
    const rows = screen.getByRole("group", { name: LABELS.tagsLabel });
    return [...rows.querySelectorAll("svg")].filter(
      (svg) => !svg.closest("[data-select-checkbox-mark]"),
    );
  };

  it("draws each tag's glyph where the colour dot used to be", () => {
    renderPanel();
    // lucide stamps its component name onto the <svg>. "Home" has no icon and
    // no colour, so before #1291 it had no leading mark at all; it now gets the
    // same generic tag glyph the editor's master list draws.
    const names = glyphs()
      .map((svg) => /lucide-([a-z0-9-]+)/.exec(svg.getAttribute("class") ?? ""))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => match[1]);
    expect(names).toEqual(["briefcase", "tag"]);
  });

  it("tints the glyph with the tag colour", () => {
    renderPanel();
    expect(glyphs()[0]).toHaveStyle({ color: "#336699" });
  });
});

describe("TagFilterPanel — editing a group (#2142, #2155)", () => {
  const openEditor = (): void => {
    fireEvent.click(screen.getByRole("button", { name: "Edit Weekdays" }));
  };
  const editor = (): HTMLElement =>
    screen.getByRole("group", { name: "Weekdays" });
  const nameField = (): HTMLElement => screen.getByLabelText("Rename group");

  it("opens with the group's own tags ticked", () => {
    renderPanel({ groups: [group()] });
    openEditor();
    expect(
      screen.getByRole("button", { name: "Edit Weekdays" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(isChecked(checkbox("Work", editor()))).toBe(true);
    expect(isChecked(checkbox("Home", editor()))).toBe(false);
  });

  it("writes nothing until Save, then hands up the new ticks", () => {
    const { onUpdateGroupTags, onRenameGroup } = renderPanel({
      groups: [group()],
    });
    openEditor();
    fireEvent.click(checkbox("Home", editor()));
    fireEvent.click(checkbox("Work", editor()));
    expect(onUpdateGroupTags).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onUpdateGroupTags).toHaveBeenCalledWith("group-1", ["tag-home"]);
    // The name was not touched, so it is not written.
    expect(onRenameGroup).not.toHaveBeenCalled();
    // The editor closes once the edit is handed up.
    expect(screen.queryByRole("group", { name: "Weekdays" })).toBeNull();
  });

  it("refuses to save a group with no tag", () => {
    const { onUpdateGroupTags } = renderPanel({ groups: [group()] });
    openEditor();
    fireEvent.click(checkbox("Work", editor()));
    screen.getByText("Tick at least one tag to save.");
    const save = screen.getByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(save);
    expect(onUpdateGroupTags).not.toHaveBeenCalled();
  });

  it("drops the draft on Cancel", () => {
    const { onUpdateGroupTags, onRenameGroup } = renderPanel({
      groups: [group()],
    });
    openEditor();
    fireEvent.change(nameField(), { target: { value: "Weekend" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Weekdays" })).toBeNull();
    expect(onUpdateGroupTags).not.toHaveBeenCalled();
    expect(onRenameGroup).not.toHaveBeenCalled();
  });

  it("does NOT write the name per keystroke", () => {
    /*
     * The ledger this replaced sent a version read + a PATCH on every
     * `onChange`, so typing a four-letter name was eight round trips and four
     * version bumps — each one a Realtime echo the section refetches on.
     */
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    openEditor();
    fireEvent.change(nameField(), { target: { value: "Weekend" } });
    expect(onRenameGroup).not.toHaveBeenCalled();
  });

  it("writes a new name once on Save, and leaves unchanged tags alone", () => {
    const { onRenameGroup, onUpdateGroupTags } = renderPanel({
      groups: [group()],
    });
    openEditor();
    fireEvent.change(nameField(), { target: { value: "  Weekend " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRenameGroup).toHaveBeenCalledTimes(1);
    expect(onRenameGroup).toHaveBeenCalledWith("group-1", "Weekend");
    expect(onUpdateGroupTags).not.toHaveBeenCalled();
  });

  it("saves on Enter in the name, but not mid-IME-composition", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    openEditor();
    fireEvent.change(nameField(), { target: { value: "平日" } });

    fireEvent.keyDown(nameField(), { key: "Enter", keyCode: 229 });
    expect(onRenameGroup).not.toHaveBeenCalled();

    fireEvent.keyDown(nameField(), { key: "Enter" });
    expect(onRenameGroup).toHaveBeenCalledWith("group-1", "平日");
  });

  it("keeps the old name rather than saving an empty one", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    openEditor();
    fireEvent.change(nameField(), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRenameGroup).not.toHaveBeenCalled();
  });
});
