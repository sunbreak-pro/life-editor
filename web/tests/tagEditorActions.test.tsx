import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataService } from "@life-editor/shared";
import type { Mock } from "vitest";
import { stubDataService, createBumpableSync } from "./helpers";
import { TagEditorHost } from "../src/tags/TagEditorHost";

/*
 * #1012 — the tag panel, driven through its buttons' ARGUMENTS (the #701 Step 2
 * shape trashScreenActions.test.tsx set, now on the second of four screens).
 *
 * What is already covered elsewhere is the PANEL: shared/tests/tagEditModal*
 * pin which control raises which callback with `vi.fn()` props. What no suite
 * held until now is the half that lives on this side of those props — the host
 * mounting the real `useWikiTagsUnifiedAPI` and that hook turning each callback
 * into one DataService call. Three of the five identity writes land on the SAME
 * method (`updateWikiTagUnified`) and differ only by which key is in the patch,
 * so a copy-paste slip there — a colour arriving as `{ name }` — leaves every
 * panel test green while the tag comes back renamed to "#e11d48".
 *
 * So the tables below assert the method, its arguments, AND that no sibling
 * write fired: rendering the real hook is what makes "only this one" mean
 * anything.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null (same convention as trashScreenActions.test.tsx).
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
  };
});

/** Every write a click in this panel can reach — the "no sibling" pool. */
const WRITE_METHODS = [
  "createWikiTagUnified",
  "updateWikiTagUnified",
  "softDeleteWikiTagUnified",
  "unassignTagFromItem",
  "assignTagToItem",
  "createItemLink",
  "deleteItemLink",
] as const;

const TAGS = [
  { id: "tag-work", name: "Work", color: null, icon: null },
  { id: "tag-home", name: "Home", color: null, icon: null },
];

const ASSIGNMENTS = [
  { id: "assign-1", tagId: "tag-work", itemId: "task-1", isDeleted: false },
  { id: "assign-2", tagId: "tag-home", itemId: "task-2", isDeleted: false },
];

interface Harness {
  ds: DataService;
  fns: Record<string, Mock>;
}

function makeHarness(): Harness {
  const fns: Record<string, Mock> = {
    // Bulk reads the tag hook makes on mount.
    listAllWikiTagsUnified: vi.fn(async () => TAGS.map((t) => ({ ...t }))),
    listAllTagAssignments: vi.fn(async () =>
      ASSIGNMENTS.map((a) => ({ ...a })),
    ),
    listAllTagConnections: vi.fn(async () => []),
    // The four reads useTaggedItemIndex resolves the item names with.
    listNotesUnified: vi.fn(async () => []),
    listDailiesUnified: vi.fn(async () => []),
    fetchTodoTree: vi.fn(async () => [
      { id: "task-1", title: "Buy milk", isDeleted: false },
      { id: "task-2", title: "Fix the roof", isDeleted: false },
    ]),
    fetchEvents: vi.fn(async () => []),
  };
  for (const method of WRITE_METHODS) {
    // Every write resolves with a tag-shaped row: the hook folds the result
    // back into its local list, so `undefined` would take the panel down
    // before the assertion runs.
    fns[method] = vi.fn(async () => ({ ...TAGS[0], name: "Work" }));
  }
  return { ds: stubDataService(fns) as DataService, fns };
}

const { wrapper: SyncWrapper } = createBumpableSync();

function Panel({ ds }: { ds: DataService }): ReactNode {
  return (
    <SyncWrapper>
      <TagEditorHost open onClose={() => {}} dataService={ds} />
    </SyncWrapper>
  );
}

/** Renders and waits for the first bulk load to land. */
async function renderPanel(): Promise<Harness> {
  const harness = makeHarness();
  render(<Panel ds={harness.ds} />);
  await screen.findByRole("button", { name: /^Work:/ });
  return harness;
}

/** Opens a tag in the editor pane (a selection, not a write). */
function openTag(name: string) {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${name}:`) }),
  );
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "materials.tags.save" }));

/** Asserts exactly one write method fired, with exactly these arguments. */
function expectOnlyWrite(
  fns: Record<string, Mock>,
  method: string,
  args: unknown[],
) {
  expect(fns[method].mock.calls).toEqual([args]);
  for (const other of WRITE_METHODS) {
    if (other === method) continue;
    expect(fns[other]).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TagEditorHost — creating a tag", () => {
  it("sends the typed name and nothing else", async () => {
    const { fns } = await renderPanel();

    fireEvent.change(screen.getByLabelText("materials.tags.addTag"), {
      target: { value: "Recipes" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.addTag" }),
    );

    await waitFor(() => expect(fns.createWikiTagUnified).toHaveBeenCalled());
    // The id is minted host-side (generateId("tag")), so the shape is what can
    // be pinned — a colourless new tag, created under a tag-prefixed id.
    expectOnlyWrite(fns, "createWikiTagUnified", [
      expect.stringMatching(/^tag-/) as unknown,
      "Recipes",
      null,
    ]);
  });

  it("writes nothing for a blank name", async () => {
    const { fns } = await renderPanel();

    fireEvent.change(screen.getByLabelText("materials.tags.addTag"), {
      target: { value: "   " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.addTag" }),
    );

    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });
});

describe("TagEditorHost — the save button routes each field to its own patch", () => {
  it("rename → updateWikiTagUnified(id, { name })", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.change(screen.getByLabelText("materials.tags.rename"), {
      target: { value: "Work log" },
    });
    save();

    await waitFor(() => expect(fns.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(fns, "updateWikiTagUnified", [
      "tag-work",
      { name: "Work log" },
    ]);
  });

  it("colour → updateWikiTagUnified(id, { color }), carrying the swatch pressed", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.colorLabel" }),
    );
    const palette = screen.getByRole("group", {
      name: "materials.tags.colorLabel",
    });
    // Each swatch is labelled with its own hex, so the value asserted below is
    // read off the button that was pressed rather than restated here.
    const swatch = within(palette).getAllByRole("button")[0];
    const hex = swatch.getAttribute("aria-label");
    fireEvent.click(swatch);
    save();

    await waitFor(() => expect(fns.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(fns, "updateWikiTagUnified", ["tag-work", { color: hex }]);
  });

  it("icon → updateWikiTagUnified(id, { icon }), carrying the glyph pressed", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.iconLabel" }),
    );
    const picker = screen.getByRole("group", {
      name: "materials.tags.iconLabel",
    });
    const choice = within(picker).getAllByRole("button")[0];
    const icon = choice.getAttribute("aria-label");
    fireEvent.click(choice);
    save();

    await waitFor(() => expect(fns.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(fns, "updateWikiTagUnified", ["tag-work", { icon }]);
  });

  it("keeps two moved fields in two patches, both aimed at the open tag", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.change(screen.getByLabelText("materials.tags.rename"), {
      target: { value: "Work log" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.colorLabel" }),
    );
    const palette = screen.getByRole("group", {
      name: "materials.tags.colorLabel",
    });
    const swatch = within(palette).getAllByRole("button")[0];
    const hex = swatch.getAttribute("aria-label");
    fireEvent.click(swatch);
    save();

    await waitFor(() =>
      expect(fns.updateWikiTagUnified).toHaveBeenCalledTimes(2),
    );
    // Name first, then colour — the order the panel has always written in, and
    // both on tag-work rather than on whatever the list had selected before.
    expect(fns.updateWikiTagUnified.mock.calls).toEqual([
      ["tag-work", { name: "Work log" }],
      ["tag-work", { color: hex }],
    ]);
    expect(fns.softDeleteWikiTagUnified).not.toHaveBeenCalled();
  });

  it("acts on the tag that is open, not the one opened before it", async () => {
    const { fns } = await renderPanel();
    openTag("Work");
    openTag("Home");

    fireEvent.change(screen.getByLabelText("materials.tags.rename"), {
      target: { value: "House" },
    });
    save();

    await waitFor(() => expect(fns.updateWikiTagUnified).toHaveBeenCalled());
    expectOnlyWrite(fns, "updateWikiTagUnified", [
      "tag-home",
      { name: "House" },
    ]);
  });
});

describe("TagEditorHost — removals", () => {
  it("delete → softDeleteWikiTagUnified(id), never a hard write", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.click(
      screen.getByRole("button", { name: "materials.tags.deleteTag" }),
    );

    await waitFor(() =>
      expect(fns.softDeleteWikiTagUnified).toHaveBeenCalled(),
    );
    expectOnlyWrite(fns, "softDeleteWikiTagUnified", ["tag-work"]);
  });

  it("unassign → unassignTagFromItem(assignmentId), not the tag itself", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    // The row is named by the item; what the click has to carry is the
    // ASSIGNMENT id, which is the one id on that row the user never sees.
    fireEvent.click(
      await screen.findByRole("button", {
        name: "materials.tags.unassign: Buy milk",
      }),
    );

    await waitFor(() => expect(fns.unassignTagFromItem).toHaveBeenCalled());
    expectOnlyWrite(fns, "unassignTagFromItem", ["assign-1"]);
  });
});

describe("TagEditorHost — what writes nothing", () => {
  it("opening a tag is navigation, not a write", async () => {
    const { fns } = await renderPanel();

    openTag("Work");
    openTag("Home");

    screen.getByLabelText("materials.tags.rename");
    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });

  it("typing without saving leaves the tag alone", async () => {
    const { fns } = await renderPanel();
    openTag("Work");

    fireEvent.change(screen.getByLabelText("materials.tags.rename"), {
      target: { value: "Work log" },
    });

    // The panel says so on screen; the service has heard nothing (#715 — blur
    // stopped committing, the button is the only commit).
    screen.getByText("materials.tags.unsaved");
    for (const method of WRITE_METHODS) {
      expect(fns[method]).not.toHaveBeenCalled();
    }
  });
});
