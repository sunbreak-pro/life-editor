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
 */

const LABELS: TagFilterPanelLabels = {
  tagsHeading: "Tags",
  tagsLabel: "Tags to show",
  noTags: "Create a tag first.",
  tagsLoading: "Loading tags…",
  clear: "Clear",
  selectedCount: "1 selected",
  groupsHeading: "Saved groups",
  groupsEmpty: "No groups yet.",
  namePlaceholder: "Group name",
  save: "Save group",
  saveHint: "Tick at least one tag.",
  apply: "Apply",
  renameGroup: "Group name",
  groupEmpty: "Every tag in this group is gone.",
};

const TAGS = [
  { id: "tag-work", name: "Work", color: "#336699", icon: "Briefcase", count: 4 },
  { id: "tag-home", name: "Home", color: null, icon: null, count: 2 },
];

function group(over: Partial<TagFilterPanelGroup> = {}): TagFilterPanelGroup {
  return {
    id: "group-1",
    name: "Weekdays",
    tagNames: ["Work"],
    active: false,
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

const checkbox = (name: string) =>
  screen.getByRole("checkbox", { name: new RegExp(name) });

describe("TagFilterPanel — the tag multi-select", () => {
  it("reports a ticked tag by id", () => {
    const { onToggleTag } = renderPanel();
    fireEvent.click(checkbox("Work"));
    expect(onToggleTag).toHaveBeenCalledWith("tag-work");
  });

  it("keeps earlier ticks checked when a second tag goes on", () => {
    // The DoD's actual claim. A single-select control would drop the first —
    // which is exactly what the one-tag calendar it replaced did.
    renderPanel({ selectedTagIds: ["tag-work", "tag-home"] });
    expect((checkbox("Work") as HTMLInputElement).checked).toBe(true);
    expect((checkbox("Home") as HTMLInputElement).checked).toBe(true);
  });

  it("shows each tag's own count", () => {
    renderPanel();
    screen.getByText("4");
    screen.getByText("2");
  });

  it("offers Clear only while something is ticked", () => {
    renderPanel();
    expect(screen.queryByText("Clear")).toBeNull();

    const { onClear } = renderPanel({ selectedTagIds: ["tag-work"] });
    fireEvent.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalled();
  });

  it("says the list is loading rather than 'you have no tags'", () => {
    // Carried over from CalendarView: "not loaded yet" and "you have none"
    // look identical from a lookup, and only one of them is the user's problem.
    renderPanel({ tags: [], tagsLoading: true });
    screen.getByText("Loading tags…");
    expect(screen.queryByText("Create a tag first.")).toBeNull();
  });

  it("asks for a tag once the list is genuinely empty", () => {
    renderPanel({ tags: [], tagsLoading: false });
    screen.getByText("Create a tag first.");
  });
});

describe("TagFilterPanel — saving a group", () => {
  it("refuses to save with no tag ticked", () => {
    renderPanel({ selectedTagIds: [] });
    expect((screen.getByText("Save group") as HTMLButtonElement).disabled).toBe(
      true,
    );
    screen.getByText("Tick at least one tag.");
  });

  it("refuses to save an unnamed group", () => {
    renderPanel({ selectedTagIds: ["tag-work"] });
    expect((screen.getByText("Save group") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("saves the trimmed name and clears the field", () => {
    const { onSaveGroup } = renderPanel({ selectedTagIds: ["tag-work"] });
    const field = screen.getByPlaceholderText("Group name");
    fireEvent.change(field, { target: { value: "  Work  " } });
    fireEvent.click(screen.getByText("Save group"));
    expect(onSaveGroup).toHaveBeenCalledWith("Work");
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("saves on Enter, but not mid-IME-composition", () => {
    const { onSaveGroup } = renderPanel({ selectedTagIds: ["tag-work"] });
    const field = screen.getByPlaceholderText("Group name");
    fireEvent.change(field, { target: { value: "仕事" } });

    // The Enter that CONFIRMS a conversion candidate must not also submit.
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onSaveGroup).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSaveGroup).toHaveBeenCalledWith("仕事");
  });
});

describe("TagFilterPanel — the saved groups", () => {
  it("applies a group by id", () => {
    const { onApplyGroup } = renderPanel({ groups: [group()] });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApplyGroup).toHaveBeenCalledWith("group-1");
  });

  it("deletes the group the button names", () => {
    const { onDeleteGroup } = renderPanel({ groups: [group()] });
    fireEvent.click(screen.getByLabelText("Delete Weekdays"));
    expect(onDeleteGroup).toHaveBeenCalledWith("group-1");
  });

  it("will not apply a group whose tags are all gone", () => {
    // It could only ever empty the grid, and a control that always empties the
    // grid reads as a bug rather than as a filter.
    renderPanel({ groups: [group({ tagNames: [] })] });
    screen.getByText("Every tag in this group is gone.");
    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("says so when there is no group yet", () => {
    renderPanel({ groups: [] });
    screen.getByText("No groups yet.");
  });
});

describe("TagFilterPanel — renaming a group", () => {
  const renameField = () =>
    screen.getByLabelText("Group name", {
      selector: 'input[value="Weekdays"]',
    });

  it("does NOT write per keystroke", () => {
    /*
     * The ledger this replaced sent a version read + a PATCH on every
     * `onChange`, so typing a four-letter name was eight round trips and four
     * version bumps — each one a Realtime echo the section refetches on.
     */
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    fireEvent.change(renameField(), { target: { value: "Weekend" } });
    expect(onRenameGroup).not.toHaveBeenCalled();
  });

  it("writes once on blur", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    const field = renameField();
    fireEvent.change(field, { target: { value: "Weekend" } });
    fireEvent.blur(field);
    expect(onRenameGroup).toHaveBeenCalledTimes(1);
    expect(onRenameGroup).toHaveBeenCalledWith("group-1", "Weekend");
  });

  it("writes once on Enter, but not mid-IME-composition", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    const field = renameField();
    fireEvent.change(field, { target: { value: "平日" } });

    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onRenameGroup).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRenameGroup).toHaveBeenCalledWith("group-1", "平日");
  });

  it("snaps back rather than saving an empty name", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    const field = renameField();
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.blur(field);
    expect(onRenameGroup).not.toHaveBeenCalled();
    expect((field as HTMLInputElement).value).toBe("Weekdays");
  });

  it("does not write when the name comes back unchanged", () => {
    const { onRenameGroup } = renderPanel({ groups: [group()] });
    fireEvent.blur(renameField());
    expect(onRenameGroup).not.toHaveBeenCalled();
  });
});

describe("TagFilterPanel — the tag rows carry the tag's icon (#1291)", () => {
  it("draws each tag's glyph where the colour dot used to be", () => {
    renderPanel();
    const rows = screen.getByRole("group", { name: LABELS.tagsLabel });

    // lucide stamps its component name onto the <svg>. "Home" has no icon and
    // no colour, so before #1291 it had no leading mark at all; it now gets the
    // same generic tag glyph the editor's master list draws.
    const glyphs = [...rows.querySelectorAll("svg")]
      .map((svg) => /lucide-([a-z0-9-]+)/.exec(svg.getAttribute("class") ?? ""))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => match[1]);
    expect(glyphs).toEqual(["briefcase", "tag"]);
  });

  it("tints the glyph with the tag colour", () => {
    renderPanel();
    const rows = screen.getByRole("group", { name: LABELS.tagsLabel });
    expect(rows.querySelector("svg")).toHaveStyle({ color: "#336699" });
  });
});
