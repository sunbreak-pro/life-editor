import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from "@testing-library/react";
import {
  ItemPanelProvider,
  LONG_PRESS_MS,
  WikiTagsUnifiedProvider,
  resetConnectSelection,
  useItemPanelContext,
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
    fetchNoteTables: vi.fn().mockResolvedValue([]),
    // #2224 — the note excerpt read (none here).
    listNoteExcerptsUnified: vi.fn().mockResolvedValue([]),
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

/** #2224 — prints the item panel's open request, as the shell's host reads it. */
function PanelRequestProbe() {
  const { request } = useItemPanelContext();
  return (
    <output aria-label="Panel request">
      {request?.mode === "edit" ? JSON.stringify(request.target) : ""}
    </output>
  );
}

async function renderNarrow(ds: DataService = makeDS()) {
  const onNavigateToItem = vi.fn();
  const { wrapper: SyncWrapper } = createBumpableSync();
  render(
    <SyncWrapper>
      <ItemPanelProvider>
        <WikiTagsUnifiedProvider dataService={ds}>
          <ConnectScreen
            dataService={ds}
            onNavigateToItem={onNavigateToItem}
          />
        </WikiTagsUnifiedProvider>
        <PanelRequestProbe />
      </ItemPanelProvider>
    </SyncWrapper>,
  );
  await waitFor(() => screen.getByRole("list", { name: "Tags" }));
  return { onNavigateToItem };
}

/** A row's own button — the one holding its day (#2224). */
const rowButton = (row: HTMLElement): HTMLElement => {
  const button = row.querySelector("[data-taghub-when]")?.closest("button");
  if (!button) throw new Error("no row button");
  return button;
};

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

describe("ConnectScreen narrow — the edit sheet (M1 / #1886)", () => {
  it("opens the whole editor from the one edit item, and saves it", async () => {
    const { ds, writes } = makeWritableDS();
    await renderNarrow(ds);
    fireEvent.click(screen.getByRole("button", { name: "Work: Tag actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit tag" }));

    const sheet = within(
      screen.getByRole("dialog", { name: "Work: Edit this tag" }),
    );
    // One "Edit tag" replaced rename / icon / colour, so the sheet carries
    // every field rather than the one a menu item used to name.
    sheet.getByRole("group", { name: "Color" });
    // …and the inline block behind it stays shut, so there is one Name field
    // and one Save on the screen, not two stacked pairs (#1851).
    expect(screen.getAllByLabelText("Name")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(1);

    // By role, not label: until #1851 the inline block also opens behind the
    // sheet, so the page holds two inputs under the same label id.
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

/*
 * #2224 — selection reaches the phone, behind the same "Select" button, and
 * its bar is pinned over the list's bottom edge rather than laid out under it.
 */
describe("ConnectScreen narrow — selecting (#2224)", () => {
  const squares = () =>
    screen
      .queryAllByRole("checkbox")
      .filter((box) => box.getAttribute("aria-label")?.startsWith("Select “"));

  it("shows no square and no bar until Select is pressed", async () => {
    await renderNarrow();
    openWork();

    expect(squares()).toHaveLength(0);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("pins the bar over the bottom once a row is checked", async () => {
    await renderNarrow();
    openWork();
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(squares()).toHaveLength(2);
    // Selection mode alone draws no bar — only a checked row does.
    expect(screen.queryByRole("toolbar")).toBeNull();

    const items = document.querySelector("[data-taghub-items]");
    if (!(items instanceof HTMLElement)) throw new Error("no items pane");
    const before = [...items.children];

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select “Draft the PR”" }),
    );
    const bar = screen.getByRole("toolbar", { name: "Selected items" });
    expect(bar.getAttribute("data-taghub-selection-bar")).toBe("row");
    // Over the list, not in it: an absolutely placed wrapper on the bottom
    // edge, and the list's own rows untouched.
    expect(bar.parentElement?.className).toContain("absolute");
    expect(bar.parentElement?.className).toContain("bottom-0");
    expect(items.contains(bar)).toBe(false);
    expect([...items.children]).toEqual(before);
  });
});

/*
 * #2224 — a long press is the phone's right-click: a todo opens the
 * Schedule's editor over this screen, and the lifted finger's click does not
 * also open the item.
 */
describe("ConnectScreen narrow — long press (#2224)", () => {
  it("opens a todo's editor in place, and swallows the click after it", async () => {
    const { onNavigateToItem } = await renderNarrow();
    openWork();
    const row = document.querySelector('[data-taghub-row="task-1"]');
    if (!(row instanceof HTMLElement)) throw new Error("no todo row");

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(row);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      fireEvent.touchEnd(row);
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByRole("status", { name: "Panel request" })).toBeTruthy();
    expect(
      JSON.parse(
        screen.getByLabelText("Panel request").textContent ?? "null",
      ),
    ).toEqual({ role: "task", id: "task-1" });
    fireEvent.click(rowButton(row));
    expect(onNavigateToItem).not.toHaveBeenCalled();
  });

  it("leaves a short tap as a tap", async () => {
    const { onNavigateToItem } = await renderNarrow();
    openWork();
    const row = document.querySelector('[data-taghub-row="task-1"]');
    if (!(row instanceof HTMLElement)) throw new Error("no todo row");

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(row);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS - 100);
      });
      fireEvent.touchEnd(row);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByLabelText("Panel request").textContent).toBe("");
    fireEvent.click(rowButton(row));
    expect(onNavigateToItem).toHaveBeenCalledWith({
      id: "task-1",
      role: "task",
      date: undefined,
    });
  });
});
