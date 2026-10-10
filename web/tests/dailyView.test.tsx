import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  dateFromKey,
  extractEveningSection,
  readDailyText,
  writeDailyText,
  UndoRedoManager,
  type AttachmentRef,
  type DailyNode,
  type DataService,
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
    /* #2123: the goals behind「進んだ目標」. The real hook reads the Sync
     * Provider, which these renders do not mount; an empty goal set is
     * enough here — the counting itself is pinned in eveningDay.test.ts. */
    useGoalLinkSnapshot: () => ({
      state: { goals: [], links: [], todos: [] },
      failed: false,
      writeLinks: async () => {},
      writeGoals: async () => {},
    }),
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
    onDirty,
    onResolvedLinkInserted,
    loadLinkTargets,
    attachments,
  }: {
    noteId: string;
    initialContent?: string;
    onUpdate?: (content: string) => void;
    onDirty?: () => void;
    onResolvedLinkInserted?: (targetId: string) => void;
    loadLinkTargets?: unknown;
    attachments?: { attach: (kind: "image" | "file") => Promise<unknown> };
  }) => (
    <div
      data-testid="editor"
      data-link-pool={loadLinkTargets === undefined ? "off" : "on"}
      data-attach={attachments === undefined ? "off" : "on"}
      data-initial-content={initialContent ?? ""}
    >
      {noteId}
      <button
        data-testid="pick-link"
        onClick={() => onResolvedLinkInserted?.(state.linkTarget)}
      />
      {/* The "/" menu's image entry, minus the menu (#1404 on Daily). */}
      <button
        data-testid="attach-image"
        onClick={() => void attachments?.attach("image")}
      />
      <button
        data-testid="save-with-link"
        onClick={() => onUpdate?.(state.bodyWithLink)}
      />
      <button
        data-testid="save-without-link"
        onClick={() => onUpdate?.(state.bodyWithoutLink)}
      />
      {/* An emission of exactly the text the editor was mounted with (#2123). */}
      <button
        data-testid="save-initial"
        onClick={() => onUpdate?.(initialContent ?? "")}
      />
      {/* A keystroke the way the real editor reports it (#1954): onDirty now,
          onUpdate once its 800ms debounce fires. */}
      <button
        data-testid="type"
        onClick={() => {
          onDirty?.();
          setTimeout(() => onUpdate?.(state.bodyWithoutLink), 800);
        }}
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
 * #1954 — the caption during the editor's 800ms debounce.
 *
 * The editor emits only when its debounce fires, so for that whole window the
 * last emitted body still matched the stored one and the caption said "Saved"
 * over text that was not saved yet. The editor reports the keystroke itself
 * through `onDirty`; the stub above fires it and then emits 800ms later.
 */
describe("DailyView — the caption while a save is pending (#1954)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not say Saved before the debounce fires, and does after the save", async () => {
    const { rerender } = render(<DailyView />);
    const type = await screen.findByTestId("type");
    vi.useFakeTimers();

    fireEvent.click(type);
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(screen.queryByText("materials.daily.saved")).toBeNull();
    screen.getByText("materials.daily.unsaved");
    expect(state.upsertDaily).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(state.upsertDaily).toHaveBeenCalledTimes(1);

    // The save lands: the context now holds what was written.
    const written = state.upsertDaily.mock.calls[0]?.[1] as string;
    state.dailies = (state.dailies as DailyNode[]).map((d) =>
      d.date === YESTERDAY ? { ...d, content: written } : d,
    );
    rerender(<DailyView />);

    screen.getByText("materials.daily.saved");
    expect(screen.queryByText("materials.daily.unsaved")).toBeNull();
  });

  it("reports the first keystroke on a day with no entry as unsaved", async () => {
    state.selectedDate = LONG_AGO;
    render(<DailyView />);
    const type = await screen.findByTestId("type");
    vi.useFakeTimers();

    fireEvent.click(type);

    screen.getByText("materials.daily.unsaved");
    expect(screen.queryByText("materials.daily.saved")).toBeNull();
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

    // The fold reads the whole stored body: the one text under「夕刊」(#2123).
    await vi.waitFor(() =>
      expect(state.syncInlineLinks).toHaveBeenCalledExactlyOnceWith(
        `daily-${YESTERDAY}`,
        writeDailyText(`entry for ${YESTERDAY}`, state.bodyWithoutLink),
      ),
    );
  });
});

/*
 * Image / file embedding on Daily — the "/" menu's attach entries, wired the
 * way Notes wires them (#1404 / #1674). What Daily owns is the hand-off: the
 * body editor gets the uploader only when there is a DataService to upload
 * through, and the upload band sits above that body while the bytes travel.
 */
describe("DailyView — attachments", () => {
  function livePicker(): HTMLInputElement | null {
    return document.body.querySelector<HTMLInputElement>('input[type="file"]');
  }

  afterEach(() => {
    livePicker()?.remove();
  });

  function attachDs(
    uploadAttachment: DataService["uploadAttachment"],
  ): DataService {
    return {
      uploadAttachment,
      getAttachmentUrl: async () => "https://signed.example/x",
      fetchScheduleItemsByDate: async () => [],
    } as unknown as DataService;
  }

  it("offers no attach entries without a DataService to upload through", async () => {
    render(<DailyView />);
    expect((await screen.findByTestId("editor")).dataset.attach).toBe("off");
  });

  it("hands the body editor the uploader when a DataService is wired", async () => {
    render(<DailyView dataService={attachDs(vi.fn())} />);
    expect((await screen.findByTestId("editor")).dataset.attach).toBe("on");
  });

  it("shows the upload band above the body while the file travels", async () => {
    let finish!: (ref: AttachmentRef) => void;
    render(
      <DailyView
        dataService={attachDs(
          () => new Promise<AttachmentRef>((resolve) => (finish = resolve)),
        )}
      />,
    );
    fireEvent.click(await screen.findByTestId("attach-image"));

    const file = new File(["x"], "photo.png", { type: "image/png" });
    const input = livePicker()!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event("change"));
    });

    const band = screen.getByRole("status");
    expect(band.textContent).toContain("photo.png");
    expect(band.textContent).toContain("attachment.uploading");

    await act(async () => {
      finish({
        path: "uid/a.png",
        name: "photo.png",
        mimeType: "image/png",
        size: 1,
      });
    });
    expect(screen.queryByRole("status")).toBeNull();
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

    fireEvent.change(screen.getByLabelText("materials.daily.filterLabel"), {
      target: { value: "nothing-matches-this" },
    });

    screen.getByText("materials.daily.entriesCount|0");
    screen.getByText("materials.daily.searchEmpty");
    expect(screen.queryByText("materials.daily.empty")).toBeNull();
  });

  // #2032: a hold on an entry row selected its excerpt on a phone.
  it("keeps a hold on the entry list from selecting text", () => {
    render(<DailyView />);
    // The panel root that carries the guard, found by walking up from its
    // heading (a class with ":" in it is awkward as a selector).
    let panel: HTMLElement | null = screen.getByText(
      "materials.daily.entriesCount|3",
    );
    while (panel && !panel.classList.contains("max-md:select-none")) {
      panel = panel.parentElement;
    }
    expect(panel).not.toBeNull();
    expect(panel!.classList.contains("[@media(hover:none)]:select-none")).toBe(
      true,
    );
    expect(
      panel!.classList.contains("max-md:[-webkit-touch-callout:none]"),
    ).toBe(true);
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
 * #2123 — the Daily body is the day's ONE text: the stored body minus the
 * 朝刊 / 宣言 sections, the「夕刊」heading and the mood line, the old body and
 * the evening reflection in document order. Every write goes through
 * writeDailyText, so what is pinned is the stored content: the text reads
 * back through readDailyText, and the excluded parts are still there.
 */
describe("DailyView — the body is the day's one text (#2123)", () => {
  const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
  const para = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  });
  const heading = (text: string) => ({
    type: "heading",
    attrs: { level: 2 },
    content: [{ type: "text", text }],
  });
  const fullDay = daily(YESTERDAY, {
    content: doc([
      heading("朝刊"),
      para("講評の一文"),
      heading("宣言"),
      para("早く寝る"),
      para("day note"),
      heading("夕刊"),
      para("気分: 4/5"),
      para("夜の振り返りの一文"),
    ]),
  });

  /** The content of the Nth upsertDaily call. */
  const saved = (n = 0) => state.upsertDaily.mock.calls[n]?.[1] as string;

  it("mounts the old body and the evening reflection as one text", async () => {
    state.dailies = [
      daily(YESTERDAY, {
        content: doc([
          para("day note"),
          heading("夕刊"),
          para("気分: 4/5"),
          para("夜の振り返りの一文"),
        ]),
      }),
    ];
    render(<DailyView />);

    const initial = (await screen.findByTestId("editor")).dataset
      .initialContent!;
    expect(initial.indexOf("day note")).toBeGreaterThan(-1);
    expect(initial.indexOf("夜の振り返りの一文")).toBeGreaterThan(
      initial.indexOf("day note"),
    );
    expect(initial).not.toContain("夕刊");
    expect(initial).not.toContain("気分");
  });

  it("keeps the 朝刊 and 宣言 sections out of the editor", async () => {
    state.dailies = [fullDay];
    render(<DailyView />);

    const initial = (await screen.findByTestId("editor")).dataset
      .initialContent!;
    expect(initial).not.toContain("朝刊");
    expect(initial).not.toContain("講評の一文");
    expect(initial).not.toContain("宣言");
  });

  it("shows the morning comment and the 宣言 above the body, read-only", () => {
    state.dailies = [fullDay];
    render(<DailyView />);

    const note = screen.getByTestId("daily-morning-note");
    within(note).getByText("講評の一文");
    within(note).getByText("早く寝る");
    expect(within(note).queryByRole("button")).toBeNull();
  });

  it("prefers the morning_comment column over the body's 朝刊 section", () => {
    state.dailies = [{ ...fullDay, morningComment: ["列の講評"] }];
    render(<DailyView />);

    const note = screen.getByTestId("daily-morning-note");
    within(note).getByText("列の講評");
    expect(within(note).queryByText("講評の一文")).toBeNull();
  });

  it("lists a written day by its text, not by the 朝刊 /「夕刊」heading", () => {
    state.dailies = [fullDay];
    render(<DailyView />);

    // "day note" sits under 宣言 with no heading of its own, so it belongs to
    // that section; the one text opens with the reflection.
    const row = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("夜の振り返りの一文"));
    expect(row).toBeDefined();
    expect(row!.textContent).not.toContain("朝刊");
  });

  it("has no morning block on a day without either", () => {
    state.dailies = [daily(YESTERDAY)];
    render(<DailyView />);
    expect(screen.queryByTestId("daily-morning-note")).toBeNull();
  });

  it("writes nothing when a day is only opened", async () => {
    state.dailies = [fullDay];
    render(<DailyView />);
    await screen.findByTestId("editor");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(state.upsertDaily).not.toHaveBeenCalled();
  });

  it("writes nothing when the editor hands back the text it was given", async () => {
    state.dailies = [fullDay];
    render(<DailyView />);
    await screen.findByTestId("editor");

    fireEvent.click(screen.getByTestId("save-initial"));

    expect(state.upsertDaily).not.toHaveBeenCalled();
  });

  it("saves an edit as the one text and keeps every excluded part", async () => {
    state.dailies = [fullDay];
    state.upsertDaily.mockResolvedValue(fullDay);
    render(<DailyView />);

    fireEvent.click(await screen.findByTestId("save-without-link"));

    expect(state.upsertDaily).toHaveBeenCalledTimes(1);
    const content = saved();
    expect(readDailyText(content)).toBe(state.bodyWithoutLink);
    // The 朝刊 / 宣言 data and the mood are stored as before.
    expect(content).toContain("講評の一文");
    expect(content).toContain("早く寝る");
    expect(extractEveningSection(content).mood).toBe(4);
  });

  it("saves a legacy plain-text day only once it is edited", async () => {
    state.dailies = [daily(YESTERDAY)];
    render(<DailyView />);

    const initial = (await screen.findByTestId("editor")).dataset
      .initialContent!;
    expect(initial).toContain(`entry for ${YESTERDAY}`);
    expect(state.upsertDaily).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("save-without-link"));
    expect(readDailyText(saved())).toBe(state.bodyWithoutLink);
  });
});

/*
 * #2123 — under the body: the mood stars and the four figures, nothing else.
 * The stars are the evening paper's: the same mood-line write, and the same
 * publish stamp on `evening_published_at`.
 */
describe("DailyView — the strip under the body (#2123)", () => {
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

  /** A DataService carrying the day's rows for the four figures. */
  function figuresDs(): DataService & {
    updateDailyUnified: ReturnType<typeof vi.fn>;
  } {
    const at = (hh: number) => {
      const d = dateFromKey(YESTERDAY);
      d.setHours(hh, 0, 0, 0);
      return d;
    };
    return {
      fetchScheduleItemsByDate: vi.fn(async () => [
        { id: "ev-1", date: YESTERDAY, title: "会議", startTime: "10:00" },
        { id: "ev-2", date: YESTERDAY, title: "散歩", startTime: "18:00" },
      ]),
      fetchTodoTree: vi.fn(async () => [
        {
          id: "task-1",
          title: "done",
          status: "DONE",
          scheduledAt: at(12).toISOString(),
          completedAt: at(12).toISOString(),
        },
        {
          id: "task-2",
          title: "open",
          status: "TODO",
          scheduledAt: at(13).toISOString(),
        },
      ]),
      fetchTimerSessions: vi.fn(async () => [
        {
          id: "s-1",
          sessionType: "WORK",
          startedAt: at(14),
          completedAt: at(15),
          duration: 90 * 60,
          completed: true,
        },
      ]),
      updateDailyUnified: vi.fn(async () => eveningDaily),
    } as unknown as DataService & {
      updateDailyUnified: ReturnType<typeof vi.fn>;
    };
  }

  it("draws the stars and the four figures, and no schedule list", async () => {
    state.dailies = [eveningDaily];
    render(<DailyView dataService={figuresDs()} />);

    const footer = screen.getByTestId("daily-day-footer");
    expect(
      within(footer)
        .getByRole("button", { name: "briefing.evening.moodStar|4" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await within(footer).findByText("materials.daily.figureEvents");
    const terms = within(footer)
      .getAllByRole("term")
      .map((el) => el.textContent);
    expect(terms).toEqual([
      "materials.daily.figureEvents",
      "materials.daily.figureTodos",
      "materials.daily.figureWork",
      "materials.daily.figureGoals",
    ]);
    const values = within(footer)
      .getAllByRole("definition")
      .map((el) => el.textContent);
    expect(values).toEqual([
      "2",
      "1/2",
      "scheduleScreen.durationHourMin|1,30",
      "0",
    ]);
    // The schedule rows of the old evening card are gone.
    expect(screen.queryByText("会議")).toBeNull();
    // The reflection lives in the body, not under it.
    expect(within(footer).queryByText("夜の振り返りの一文")).toBeNull();
  });

  it("shows the stars without a DataService, and no figures", () => {
    state.dailies = [daily(YESTERDAY)];
    render(<DailyView />);

    const footer = screen.getByTestId("daily-day-footer");
    within(footer).getByRole("button", { name: "briefing.evening.moodStar|3" });
    expect(within(footer).queryAllByRole("term")).toHaveLength(0);
  });

  it("sets the mood from a star without touching the text", async () => {
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
    expect(extractEveningSection(saved()).mood).toBe(5);
    expect(readDailyText(saved())).toBe(readDailyText(eveningDaily.content));
    // Not remounted by the write (same element).
    expect(screen.getByTestId("editor")).toBe(editor);
  });

  it("publishes the day when a star is set on an unpublished day", async () => {
    const ds = figuresDs();
    state.dailies = [daily(YESTERDAY)];
    state.upsertDaily.mockResolvedValue(
      daily(YESTERDAY, { eveningPublishedAt: null }),
    );
    render(<DailyView dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|3" }),
    );

    expect(extractEveningSection(saved()).mood).toBe(3);
    await vi.waitFor(() =>
      expect(ds.updateDailyUnified).toHaveBeenCalledExactlyOnceWith(
        `daily-${YESTERDAY}`,
        { eveningPublishedAt: expect.any(String) },
      ),
    );
  });

  it("keeps the first stamp when a published day is re-rated", async () => {
    const ds = figuresDs();
    state.dailies = [eveningDaily];
    state.upsertDaily.mockResolvedValue({
      ...eveningDaily,
      eveningPublishedAt: "2026-10-09T21:00:00.000Z",
    });
    render(<DailyView dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|2" }),
    );

    await vi.waitFor(() => expect(state.upsertDaily).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ds.updateDailyUnified).not.toHaveBeenCalled();
  });

  it("clears the stamp when the lit star is tapped again", async () => {
    const ds = figuresDs();
    state.dailies = [eveningDaily];
    state.upsertDaily.mockResolvedValue({
      ...eveningDaily,
      eveningPublishedAt: "2026-10-09T21:00:00.000Z",
    });
    render(<DailyView dataService={ds} />);

    fireEvent.click(
      screen.getByRole("button", { name: "briefing.evening.moodStar|4" }),
    );

    expect(extractEveningSection(saved()).mood).toBeNull();
    expect(readDailyText(saved())).toBe(readDailyText(eveningDaily.content));
    await vi.waitFor(() =>
      expect(ds.updateDailyUnified).toHaveBeenCalledExactlyOnceWith(
        `daily-${YESTERDAY}`,
        { eveningPublishedAt: null },
      ),
    );
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
   * #1750: a write that never landed must not read as a clean reversal.
   * Driven through the REAL manager, because where the command ends up is the
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
    expect(manager.canRedo()).toBe(false);
    expect(manager.canUndo()).toBe(true);
    errors.mockRestore();
  });
});

/*
 * #1840 — the three Daily controls the audit read under 44px at 390px: the
 * Today CTA (36), the kebab (36) and the reflection preview (34).
 *
 * jsdom has no layout (CLAUDE.md §7.1), so none of that can be re-measured
 * here. What is pinned is the class contract that produces the size, the same
 * shape web/tests/materialsTapTargets.test.tsx uses.
 *
 * `max-md:` and never a bare floor: one component draws both the Desktop
 * header and the narrow one, so an unconditional min-height would grow the
 * mouse layout too.
 */
describe("#1840 — Daily's controls meet the 44px touch floor", () => {
  it("floors the Today CTA in height, and leaves its width to the label", () => {
    render(<DailyView />);
    const cta = screen.getByRole("button", { name: "materials.daily.toToday" });

    expect(cta.classList.contains("max-md:min-h-11")).toBe(true);
    // A labelled button is already wide enough for a thumb; a min-width would
    // stretch it for no one.
    expect(cta.classList.contains("max-md:min-w-11")).toBe(false);
    // Desktop unchanged: same padding, no unconditional floor.
    expect(cta.classList.contains("py-1.5")).toBe(true);
    expect(cta.classList.contains("min-h-11")).toBe(false);
  });

  it("floors the kebab both ways — it is a glyph with no label", () => {
    render(<DailyView />);
    const kebab = screen.getByRole("button", {
      name: "materials.daily.moreActions",
    });

    expect(kebab.classList.contains("max-md:min-h-11")).toBe(true);
    expect(kebab.classList.contains("max-md:min-w-11")).toBe(true);
    // The drawn box is untouched — the hit box is what grew.
    expect(kebab.classList.contains("h-7")).toBe(true);
    expect(kebab.classList.contains("min-h-11")).toBe(false);
  });

  // The reflection preview the audit also read (34px) went with the evening
  // card (#2123); the mood stars that replaced it carry the floor.
  it("floors each mood star both ways", () => {
    render(<DailyView />);
    const star = screen.getByRole("button", {
      name: "briefing.evening.moodStar|1",
    });
    expect(star.classList.contains("max-md:min-h-11")).toBe(true);
    expect(star.classList.contains("max-md:min-w-11")).toBe(true);
  });
});
