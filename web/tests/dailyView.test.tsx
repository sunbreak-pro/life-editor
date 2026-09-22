import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  extractEveningSection,
  eveningBodyLines,
  stripEveningSection,
  UndoRedoManager,
  type DailyNode,
  type UndoCommand,
} from "@life-editor/shared";
import {
  DailyView,
  DAILY_EDITOR_CARD_MIN_HEIGHT,
} from "../src/daily/DailyView";

/*
 * #588 — the Daily screen. Its two surfaces navigate the same selection by
 * different means (desktop: the sidebar entry panel; mobile: the date strip),
 * and everything the user can destroy sits behind one kebab that both surfaces
 * share. Those are the seams this pins.
 *
 * The editor is stubbed: TipTap's own behaviour is covered elsewhere, and what
 * matters here is WHICH day it is mounted for (the key carries the date, so a
 * wrong one would edit the wrong entry).
 *
 * Dates are computed the same way the view does (formatDateKey on the real
 * clock) rather than frozen: the "today" button's whole job is to agree with
 * the machine's own idea of today.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const state = vi.hoisted(() => {
  const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
  return {
    isWide: true,
    dailies: [] as unknown[],
    selectedDate: "",
    setSelectedDate: vi.fn(),
    upsertDaily: vi.fn(),
    deleteDaily: vi.fn(),
    togglePin: vi.fn(),
    createItemLink: vi.fn(() => Promise.resolve()),
    syncInlineLinks: vi.fn(() => Promise.resolve()),
    outgoing: [] as { toItemId: string; isDeleted?: boolean }[],
    /* #876: narrow puts the entry panel in the modal drawer, so picking
     * a day has to close it. Null on Desktop-only renders is fine — the
     * view reads the panel through the null-safe hook. */
    closeDrawer: vi.fn(),
    /* #1680: the global undo stack the evening card pushes mood edits to. */
    pushUndo: vi.fn(),
    /* The bodies the stubbed editor saves. WITH carries a resolved itemLink
     * atom for LINK_TARGET; WITHOUT is the same day after the user deleted it
     * again — which is the pair the #372 fold turns on. */
    linkTarget: "task-9",
    bodyWithLink: doc([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "see " },
          {
            type: "itemLink",
            attrs: { targetId: "task-9", label: "Roof", role: "task" },
          },
        ],
      },
    ]),
    bodyWithoutLink: doc([
      { type: "paragraph", content: [{ type: "text", text: "see" }] },
    ]),
  };
});

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
    useMediaQuery: () => state.isWide,
    useSyncDomains: () => 0,
    useDailiesUnifiedContext: () => ({
      dailies: state.dailies,
      selectedDate: state.selectedDate,
      setSelectedDate: state.setSelectedDate,
      selectedDaily:
        (state.dailies as DailyNode[]).find(
          (d) => d.date === state.selectedDate,
        ) ?? null,
      upsertDaily: state.upsertDaily,
      deleteDaily: state.deleteDaily,
      togglePin: state.togglePin,
      getDailyForDate: (date: string) =>
        (state.dailies as DailyNode[]).find((d) => d.date === date) ?? null,
    }),
    useWikiTagsUnifiedContext: () => ({
      createItemLink: state.createItemLink,
      getLinksForItem: () => ({ outgoing: state.outgoing, incoming: [] }),
      syncInlineLinks: state.syncInlineLinks,
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
    useRightSidebarOptional: () => ({ close: state.closeDrawer }),
    useUndoRedoOptional: () => ({ push: state.pushUndo }),
  };
});

/*
 * The editor is stubbed down to the three moments the Daily host is wired to:
 * the "[[" picker committing a row, and a save carrying the link / no longer
 * carrying it. jsdom has no layout, so the real picker cannot be driven here
 * (CLAUDE.md §7.1) — buttons stand in for it, and what gets pinned is the
 * host-side wiring behind them, which is the half Daily owns.
 */
vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({
    noteId,
    initialContent,
    onUpdate,
    onResolvedLinkInserted,
    loadLinkTargets,
  }: {
    noteId: string;
    initialContent?: string;
    onUpdate?: (content: string) => void;
    onResolvedLinkInserted?: (targetId: string) => void;
    loadLinkTargets?: unknown;
  }) => (
    <div
      data-testid="editor"
      data-link-pool={loadLinkTargets === undefined ? "off" : "on"}
      data-initial-content={initialContent ?? ""}
    >
      {noteId}
      <button
        data-testid="pick-link"
        onClick={() => onResolvedLinkInserted?.(state.linkTarget)}
      />
      <button
        data-testid="save-with-link"
        onClick={() => onUpdate?.(state.bodyWithLink)}
      />
      <button
        data-testid="save-without-link"
        onClick={() => onUpdate?.(state.bodyWithoutLink)}
      />
    </div>
  ),
}));

/** The view's own date math, so "today" means the same thing on both sides. */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = isoDay(0);
const YESTERDAY = isoDay(-1);
const LAST_WEEK = isoDay(-7);
const LONG_AGO = isoDay(-40);

function daily(date: string, over: Partial<DailyNode> = {}): DailyNode {
  return {
    id: `daily-${date}`,
    type: "daily",
    date,
    title: date,
    content: `entry for ${date}`,
    isPinned: false,
    isDeleted: false,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
    ...over,
  } as DailyNode;
}

beforeEach(() => {
  localStorage.clear();
  state.isWide = true;
  state.selectedDate = YESTERDAY;
  state.dailies = [daily(TODAY), daily(YESTERDAY), daily(LAST_WEEK)];
  state.setSelectedDate.mockClear();
  state.upsertDaily.mockClear();
  state.deleteDaily.mockClear();
  state.togglePin.mockClear();
  state.createItemLink.mockClear();
  state.syncInlineLinks.mockClear();
  state.closeDrawer.mockClear();
  state.pushUndo.mockClear();
  state.outgoing = [];
  // The save that persists the body is also the save that proves the day's
  // items_meta row exists — the parked edges wait on its resolved node.
  state.upsertDaily.mockResolvedValue(daily(YESTERDAY));
});

describe("DailyView — the open day", () => {
  it("mounts the editor for the selected date, not for today", async () => {
    render(<DailyView />);
    // findBy, not getBy: the editor is loaded on its own chunk since #991, so
    // the first paint is the placeholder.
    expect((await screen.findByTestId("editor")).textContent).toBe(
      `daily-${YESTERDAY}`,
    );
  });

  it("jumps the selection to today from the accent CTA", () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.toToday" }),
    );
    expect(state.setSelectedDate).toHaveBeenCalledExactlyOnceWith(TODAY);
  });

  it("reads as saved before anything is typed", () => {
    render(<DailyView />);
    screen.getByText("materials.daily.saved");
  });

  /*
   * #1839 — the caption is a claim about a row. On a day nobody has written
   * on there is no row, and "Saved" was a claim about nothing.
   */
  it("says nothing about saving on a day with no entry", () => {
    state.selectedDate = LONG_AGO;
    render(<DailyView />);

    expect(screen.queryByText("materials.daily.saved")).toBeNull();
    expect(screen.queryByText("materials.daily.unsaved")).toBeNull();
  });
});

/*
 * #776 — Daily's end of the shared "[[" wiring. Its shape is the one that
 * differs: a day has no items_meta row until its first save lands, so an
 * insertion is PARKED under the date and written by the save that persists the
 * text carrying it (#371). Parking is all that is Daily-specific; the write it
 * ends in is the shared one, whose guards are pinned in useInlineItemLinks.test.
 */
describe("DailyView — inline links", () => {
  it("offers the picker a candidate pool", () => {
    render(<DailyView />);
    expect(screen.getByTestId("editor").dataset.linkPool).toBe("on");
  });

  it("writes the parked edge once the save proves the day exists", async () => {
    render(<DailyView />);

    fireEvent.click(screen.getByTestId("pick-link"));
    // Nothing yet: the FK target does not exist until the save lands, and
    // writing here is exactly what dropped that first edge for good (#371).
    expect(state.createItemLink).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("save-with-link"));

    await vi.waitFor(() =>
      expect(state.createItemLink).toHaveBeenCalledExactlyOnceWith(
        `daily-${YESTERDAY}`,
        state.linkTarget,
        "inline",
      ),
    );
  });

  it("drops a parked edge the user removed again before the save", async () => {
    render(<DailyView />);

    fireEvent.click(screen.getByTestId("pick-link"));
    fireEvent.click(screen.getByTestId("save-without-link"));

    await vi.waitFor(() => expect(state.syncInlineLinks).toHaveBeenCalled());
    expect(state.createItemLink).not.toHaveBeenCalled();
  });

  it("leaves an edge the day already has alone", async () => {
    state.outgoing = [{ toItemId: "task-9" }];
    render(<DailyView />);

    fireEvent.click(screen.getByTestId("pick-link"));
    fireEvent.click(screen.getByTestId("save-with-link"));

    await vi.waitFor(() => expect(state.syncInlineLinks).toHaveBeenCalled());
    expect(state.createItemLink).not.toHaveBeenCalled();
  });

  // #372 — the fold. Deleting a "[[ ]]" from the body and saving is how an
  // inline edge is meant to go away; without this the graph keeps a link the
  // text no longer shows, and the user has no way to reach it.
  it("folds the edges the saved body no longer carries", async () => {
    render(<DailyView />);

    fireEvent.click(screen.getByTestId("save-without-link"));

    await vi.waitFor(() =>
      expect(state.syncInlineLinks).toHaveBeenCalledExactlyOnceWith(
        `daily-${YESTERDAY}`,
        state.bodyWithoutLink,
      ),
    );
  });
});

describe("DailyView — the actions kebab", () => {
  it("keeps pin and delete behind it", () => {
    render(<DailyView />);

    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );

    const menu = screen.getByRole("menu");
    fireEvent.click(within(menu).getByText("materials.daily.pin"));
    // The kebab acts on the OPEN day — a delete aimed at today while reading
    // yesterday would be unrecoverable-looking to the user.
    expect(state.togglePin).toHaveBeenCalledExactlyOnceWith(YESTERDAY);
  });

  // #1679 — the menu is not portalled and the card clips (overflow-hidden),
  // so the card's floor is what keeps the delete row reachable on a short day.
  // jsdom has no layout, so the class is the pin; the height is a browser check.
  it.each([
    ["desktop", true],
    ["mobile", false],
  ])("keeps the editor card tall enough for the menu (%s)", (_, wide) => {
    state.isWide = wide;
    render(<DailyView />);

    const classes = screen
      .getByTestId("daily-editor-card")
      .className.split(" ");
    expect(classes).toContain(DAILY_EDITOR_CARD_MIN_HEIGHT);
    // `cn` does not merge: a leftover min-h-0 would fight the floor.
    expect(classes).not.toContain("min-h-0");
  });

  it("asks before it deletes the open day (#1838)", async () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    fireEvent.click(
      within(screen.getByRole("menu")).getByText("materials.daily.delete"),
    );

    // Nothing is gone yet. The press opens the question, and the question
    // names the day the entry list names.
    expect(state.deleteDaily).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    within(dialog).getByText(/^materials\.daily\.deleteConfirmBody\|/);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "materials.daily.deleteConfirmAction",
      }),
    );
    await waitFor(() =>
      expect(state.deleteDaily).toHaveBeenCalledExactlyOnceWith(YESTERDAY),
    );
  });

  it("keeps the day when the question is answered no (#1838)", async () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    fireEvent.click(
      within(screen.getByRole("menu")).getByText("materials.daily.delete"),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "common.cancel",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.deleteDaily).not.toHaveBeenCalled();
  });

  it("has nothing to delete on a day with no entry (#1838)", () => {
    // The old item ran deleteDaily on an absent row: a no-op with no
    // feedback, which reads as a broken button rather than as an empty day.
    state.selectedDate = LONG_AGO;
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    const item = within(screen.getByRole("menu"))
      .getAllByRole("menuitem", { hidden: true })
      .find((el) => el.textContent?.includes("materials.daily.delete"));
    expect(item?.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("DailyView — the entry list says which day is open (#1839)", () => {
  it("marks exactly the open day, and marks it with aria-current", () => {
    render(<DailyView />);

    const current = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(`entry for ${YESTERDAY}`);
  });

  it("marks nothing when the open day has no entry", () => {
    state.selectedDate = LONG_AGO;
    render(<DailyView />);

    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-current") === "true"),
    ).toHaveLength(0);
  });

  it("says why the list is empty when a filter empties it", () => {
    render(<DailyView />);

    fireEvent.change(
      screen.getByLabelText("materials.daily.filterLabel"),
      { target: { value: "nothing-matches-this" } },
    );

    screen.getByText("materials.daily.entriesCount|0");
    screen.getByText("materials.daily.searchEmpty");
    expect(screen.queryByText("materials.daily.empty")).toBeNull();
  });

  it("says so when there are no entries at all", () => {
    state.dailies = [];
    render(<DailyView />);

    screen.getByText("materials.daily.empty");
    expect(screen.queryByText("materials.daily.searchEmpty")).toBeNull();
  });
});

describe("DailyView — desktop entry panel", () => {
  it("counts the entries it lists and selects one on click", () => {
    render(<DailyView />);

    screen.getByText("materials.daily.entriesCount|3");
    // Each entry row is a button carrying its own day label.
    const entry = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes(`entry for ${LAST_WEEK}`));
    expect(entry).not.toBeUndefined();
    fireEvent.click(entry as HTMLElement);
    expect(state.setSelectedDate).toHaveBeenCalledExactlyOnceWith(LAST_WEEK);
  });

  it("narrows the list by the sidebar filter query", () => {
    render(<DailyView />);

    fireEvent.change(screen.getByLabelText("materials.daily.filterLabel"), {
      target: { value: `entry for ${LAST_WEEK}` },
    });
    screen.getByText("materials.daily.entriesCount|1");
  });

  it("offers no today / yesterday jump beside the picker (#1189)", () => {
    render(<DailyView />);
    // Both set the same selected date the picker and the rows set, so from the
    // outside they read as a filter that did nothing.
    expect(screen.queryByText("materials.daily.today")).toBeNull();
    expect(screen.queryByText("materials.daily.yesterday")).toBeNull();
    // What is left above the list: the picker, the search and the sort.
    screen.getByLabelText("materials.daily.datePicker");
    screen.getByLabelText("materials.daily.filterLabel");
    screen.getByLabelText("materials.sidebar.sort");
  });
});

describe("DailyView — mobile", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("has no date strip over the editor (#1189)", () => {
    render(<DailyView />);

    // The strip only ever reached the last fourteen days, which is the range
    // the drawer's entry list already covers — and every day it offered was a
    // day the picker offers too.
    expect(
      screen.queryByRole("group", { name: "materials.daily.dateStripLabel" }),
    ).toBeNull();
  });

  /*
   * #876 replaced the two-row "past entries" teaser under the editor with the
   * SAME panel Desktop has, in the hamburger's drawer. What that buys is the
   * whole list: the teaser showed two rows and the strip reaches fourteen days,
   * so a 40-day-old entry had no route on a phone at all.
   */
  it("gets the desktop entry panel, whole, in the drawer", () => {
    state.dailies = [
      daily(TODAY),
      daily(YESTERDAY),
      daily(LAST_WEEK),
      daily(LONG_AGO),
    ];
    render(<DailyView />);

    // Every entry, not a two-row teaser — LONG_AGO included.
    screen.getByText("materials.daily.entriesCount|4");
    screen.getByText(`entry for ${LONG_AGO}`);
    // And the sort / filter controls that came with it.
    screen.getByLabelText("materials.daily.filterLabel");
  });

  it("closes the drawer on the day it just opened", () => {
    state.dailies = [daily(TODAY), daily(YESTERDAY), daily(LAST_WEEK)];
    render(<DailyView />);

    const entry = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes(`entry for ${LAST_WEEK}`));
    fireEvent.click(entry as HTMLElement);

    expect(state.setSelectedDate).toHaveBeenCalledExactlyOnceWith(LAST_WEEK);
    // The drawer is a modal overlay: leaving it up would cover the entry.
    expect(state.closeDrawer).toHaveBeenCalledTimes(1);
  });

  it("leaves the desktop panel where it is", () => {
    state.isWide = true;
    state.dailies = [daily(TODAY), daily(LAST_WEEK)];
    render(<DailyView />);

    const entry = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes(`entry for ${LAST_WEEK}`));
    fireEvent.click(entry as HTMLElement);

    expect(state.closeDrawer).not.toHaveBeenCalled();
  });

  it("keeps the same kebab actions the desktop header has", () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    within(screen.getByRole("menu")).getByText("materials.daily.delete");
  });
});

/*
 * #1046 — 夕刊カテゴリ. The evening section stays in the STORED content
 * (zero migration), but it no longer renders inside the body editor: the
 * editor mounts the day without it, the card below prints it, and a body
 * save re-attaches it so an edit can never drop what the evening wrote.
 */
describe("DailyView — evening category (#1046)", () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
  const eveningDaily = daily(YESTERDAY, {
    content: doc([
      {
        type: "paragraph",
        content: [{ type: "text", text: "day note" }],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "夕刊" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "気分: 4/5" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "夜の振り返りの一文" }],
      },
    ]),
  });

  it("renders mood + reflection in the card, not in the editor body", async () => {
    state.dailies = [eveningDaily];
    render(<DailyView />);

    // The card: heading, 4/5 stars, the reflection line.
    screen.getByText("materials.daily.eveningTitle");
    // Pressable since #1680 — the stored mood is the pressed star.
    expect(
      screen
        .getByRole("button", { name: "briefing.evening.moodStar|4" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    screen.getByText("夜の振り返りの一文");

    // The editor mounts the STRIPPED day — no 夕刊 heading, body text kept.
    const editor = await screen.findByTestId("editor");
    expect(editor.dataset.initialContent).toContain("day note");
    expect(editor.dataset.initialContent).not.toContain("夕刊");
  });

  it("shows no card for a day without evening data", () => {
    state.dailies = [daily(YESTERDAY)];
    render(<DailyView />);
    expect(screen.queryByText("materials.daily.eveningTitle")).toBeNull();
  });

  it("re-attaches the stored evening section on a body save", async () => {
    state.dailies = [eveningDaily];
    state.upsertDaily.mockResolvedValue(eveningDaily);
    render(<DailyView />);

    fireEvent.click(await screen.findByTestId("save-with-link"));

    await vi.waitFor(() => expect(state.upsertDaily).toHaveBeenCalledTimes(1));
    const savedContent = state.upsertDaily.mock.calls[0]?.[1] as string;
    // The emitted body (bodyWithLink) carries no 夕刊 — the save must put the
    // stored section back: heading + mood line + reflection, after the body.
    expect(savedContent).toContain("夕刊");
    expect(savedContent).toContain("気分: 4/5");
    expect(savedContent).toContain("夜の振り返りの一文");
    expect(savedContent).toContain("see ");
  });
});

/*
 * #1680 — the evening card is editable. Every write goes through the section
 * merge, so what is pinned is the stored content: the edited evening reads
 * back through extractEveningSection, and the body half is byte-for-byte what
 * the editor had.
 */
describe("DailyView — editing the evening card (#1680)", () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
  const para = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  const eveningDaily = daily(YESTERDAY, {
    content: doc([
      para("day note"),
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "夕刊" }],
      },
      para("気分: 4/5"),
      para("夜の振り返りの一文"),
    ]),
  });

  /** The content of the Nth upsertDaily call. */
  const saved = (n = 0) => state.upsertDaily.mock.calls[n]?.[1] as string;

  it("sets the mood from a star without touching the body", async () => {
    state.dailies = [eveningDaily];
    render(<DailyView />);
    const editor = await screen.findByTestId("editor");

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|5" }),
    );

    expect(state.upsertDaily).toHaveBeenCalledExactlyOnceWith(
      YESTERDAY,
      expect.any(String),
      { skipUndo: true },
    );
    const evening = extractEveningSection(saved());
    expect(evening.mood).toBe(5);
    expect(eveningBodyLines(evening.bodyDocJson)).toEqual([
      "夜の振り返りの一文",
    ]);
    // The body editor's half is exactly what it was, and the editor was not
    // remounted by the write (same element, same initial content).
    expect(stripEveningSection(saved())).toBe(
      stripEveningSection(eveningDaily.content),
    );
    expect(screen.getByTestId("editor")).toBe(editor);
  });

  it("clears the mood when the lit star is tapped again", () => {
    state.dailies = [eveningDaily];
    render(<DailyView />);

    const lit = screen.getByRole("button", {
      name: "briefing.evening.moodStar|4",
    });
    expect(lit.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(lit);

    const evening = extractEveningSection(saved());
    expect(evening.mood).toBeNull();
    expect(eveningBodyLines(evening.bodyDocJson)).toEqual([
      "夜の振り返りの一文",
    ]);
  });

  it("edits the reflection and keeps the body and the mood", async () => {
    state.dailies = [eveningDaily];
    render(<DailyView />);
    await screen.findByTestId("editor");

    fireEvent.click(
      screen.getByRole("button", {
        name: "materials.daily.eveningEditReflection 夜の振り返りの一文",
      }),
    );
    // The preview swapped for a second editor bound to the evening section.
    const reflection = (await screen.findAllByTestId("editor")).find(
      (el) => el.textContent === `daily-evening-${YESTERDAY}`,
    );
    expect(reflection?.dataset.initialContent).toContain("夜の振り返りの一文");
    expect(reflection?.dataset.initialContent).not.toContain("気分");

    fireEvent.click(within(reflection!).getByTestId("save-without-link"));

    const evening = extractEveningSection(saved());
    expect(evening.mood).toBe(4);
    expect(eveningBodyLines(evening.bodyDocJson)).toEqual(["see"]);
    expect(stripEveningSection(saved())).toBe(
      stripEveningSection(eveningDaily.content),
    );
  });

  it("opens an empty card on a day that has no evening yet", () => {
    state.dailies = [daily(YESTERDAY)];
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.eveningStart" }),
    );
    screen.getByText("materials.daily.eveningTitle");
    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|3" }),
    );

    expect(extractEveningSection(saved()).mood).toBe(3);
    // The legacy plain-text body survives the merge as its own paragraph.
    expect(stripEveningSection(saved())).toContain(`entry for ${YESTERDAY}`);
  });

  it("puts a mood change on the undo stack", async () => {
    state.dailies = [eveningDaily];
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|2" }),
    );
    expect(state.pushUndo).toHaveBeenCalledTimes(1);
    const [domain, command] = state.pushUndo.mock.calls[0] as [
      string,
      UndoCommand,
    ];
    expect(domain).toBe("daily");

    // The store caught up with the tap (the context updates optimistically).
    state.dailies = [{ ...eveningDaily, content: saved(0) }];
    // #1750: the reversal waits for the write it reverses, so it only reaches
    // upsertDaily after that promise settles — hence the await.
    await command.undo();
    expect(extractEveningSection(saved(1)).mood).toBe(4);

    state.dailies = [{ ...eveningDaily, content: saved(1) }];
    await command.redo();
    expect(extractEveningSection(saved(2)).mood).toBe(2);
  });

  /*
   * #1750: before this, the undo closure called writeEvening and dropped the
   * promise, so a write that never landed still read as a clean reversal —
   * the toast said「元に戻しました」and the command moved on to the redo stack,
   * offering to re-apply something that was never undone.
   *
   * Driven through the REAL manager rather than the pushUndo stub, because
   * what the Issue asks about is where the command ends up, and that is the
   * manager's half of the contract (UndoRedoManager#apply).
   */
  it("treats a write that did not land as a failed undo", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    state.dailies = [eveningDaily];
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|2" }),
    );
    const [, command] = state.pushUndo.mock.calls[0] as [string, UndoCommand];

    state.dailies = [{ ...eveningDaily, content: saved(0) }];
    // A write the server refused: upsertDaily logs the rejection itself and
    // reports the failure to its caller by resolving null.
    state.upsertDaily.mockResolvedValue(null);

    const manager = new UndoRedoManager();
    manager.push(command, "daily");
    const outcome = await manager.undo();

    expect(outcome?.ok).toBe(false);
    // Not on the redo stack — it is back where it was, for the user to retry.
    expect(manager.canRedo()).toBe(false);
    expect(manager.canUndo()).toBe(true);
    errors.mockRestore();
  });
});
