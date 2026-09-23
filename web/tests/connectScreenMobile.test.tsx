import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import {
  WikiTagsUnifiedProvider,
  resetConnectSelection,
  type DataService,
} from "@life-editor/shared";
import { ConnectScreen } from "../src/connect/ConnectScreen";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * Connect on a phone (#1646): the three steps are one screen at a time, every
 * row menu is a bottom sheet, and the relations — with no side panel to live
 * in — come up as a sheet of their own.
 *
 * Narrow is forced through matchMedia (jsdom has none, and useMediaQuery falls
 * back to wide without it), the same way the Briefing suites do it.
 */

const TAGS = [
  { id: "t-work", name: "Work", color: null, icon: null, isDeleted: false },
];

const ASSIGNMENTS = [
  { id: "a-1", itemId: "task-1", tagId: "t-work", isDeleted: false },
  { id: "a-2", itemId: "note-1", tagId: "t-work", isDeleted: false },
];

const WRITE_METHODS = [
  "createWikiTagUnified",
  "updateWikiTagUnified",
  "softDeleteWikiTagUnified",
  "unassignTagFromItem",
  "assignTagToItem",
] as const;

function makeDS(over: Partial<Record<string, unknown>> = {}) {
  return stubDataService({
    fetchTodoTree: vi
      .fn()
      .mockResolvedValue([{ id: "task-1", title: "Draft the PR" }]),
    fetchEvents: vi.fn().mockResolvedValue([]),
    listNotesUnified: vi
      .fn()
      .mockResolvedValue([{ id: "note-1", title: "Migration notes" }]),
    listDailiesUnified: vi.fn().mockResolvedValue([]),
    fetchAllRoutines: vi.fn().mockResolvedValue([]),
    listAllWikiTagsUnified: vi.fn().mockResolvedValue(TAGS),
    listAllTagAssignments: vi.fn().mockResolvedValue(ASSIGNMENTS),
    listAllTagConnections: vi.fn().mockResolvedValue([]),
    ...over,
  });
}

function makeWritableDS() {
  const writes: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of WRITE_METHODS) {
    writes[method] = vi.fn(async () => ({ ...TAGS[0] }));
  }
  return { ds: makeDS(writes), writes };
}

/** jsdom has no matchMedia; useMediaQuery falls back to wide without it. */
function setNarrow() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

async function renderNarrow(ds: DataService = makeDS()) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={ds}>
        <ConnectScreen dataService={ds} onNavigateToItem={onNavigateToItem} />
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
  return { onNavigateToItem };
}

/** The narrow layout lands on the tag list; this is step two. */
const openWork = () =>
  fireEvent.click(screen.getByRole("button", { name: "Work: 2 items" }));

beforeEach(() => {
  cleanup();
  resetConnectSelection();
  setNarrow();
});

afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
});

describe("ConnectScreen narrow — a row's actions (M3)", () => {
  it("offers reading the relations and taking this tag off", async () => {
    await renderNarrow();
    openWork();
    fireEvent.click(
      screen.getByRole("button", { name: "Draft the PR: Item actions" }),
    );

    const sheet = within(
      screen.getByRole("dialog", { name: "Draft the PR: Item actions" }),
    );
    sheet.getByRole("button", { name: "See what it relates to" });
    sheet.getByRole("button", { name: "Remove this tag" });
  });

  it("takes the tag off through the assignment the cache holds", async () => {
    const { ds, writes } = makeWritableDS();
    await renderNarrow(ds);
    openWork();
    fireEvent.click(
      screen.getByRole("button", { name: "Draft the PR: Item actions" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove this tag" }));

    await waitFor(() =>
      expect(writes.unassignTagFromItem).toHaveBeenCalledWith("a-1"),
    );
    expect(writes.softDeleteWikiTagUnified).not.toHaveBeenCalled();
  });

  it("opens the relations as a sheet, not a side panel", async () => {
    await renderNarrow();
    openWork();
    fireEvent.click(
      screen.getByRole("button", { name: "Draft the PR: Item actions" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "See what it relates to" }),
    );

    const sheet = screen.getByRole("dialog", {
      name: "Related: Draft the PR",
    });
    within(sheet).getByRole("region", { name: "Links (0)" });
    // The other note carries the same tag, so it is the one relation there is.
    within(sheet).getByRole("region", { name: "Items sharing a tag (1)" });
  });
});

describe("ConnectScreen narrow — editing one field at a time (M1)", () => {
  it("opens the named field alone, and saves it", async () => {
    const { ds, writes } = makeWritableDS();
    await renderNarrow(ds);
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    const sheet = within(screen.getByRole("dialog", { name: "Work: Name" }));
    // The sheet is the action that was picked — not the whole editor.
    expect(sheet.queryByRole("group", { name: "Color" })).toBeNull();
    expect(sheet.queryByRole("button", { name: "Delete tag" })).toBeNull();
    // …and the inline block behind it stays shut, so there is one Name field
    // and one Save on the screen, not two stacked pairs (#1851).
    expect(screen.getAllByLabelText("Name")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);

    fireEvent.change(sheet.getByRole("textbox"), {
      target: { value: "Work log" },
    });
    fireEvent.click(sheet.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(writes.updateWikiTagUnified).toHaveBeenCalledWith("t-work", {
        name: "Work log",
      }),
    );
  });
});

describe("ConnectScreen narrow — what the phone does not get", () => {
  it("has no checkboxes and no selection bar", async () => {
    await renderNarrow();
    openWork();

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });
});
