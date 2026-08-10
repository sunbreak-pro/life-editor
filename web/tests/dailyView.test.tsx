import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DailyNode } from "@life-editor/shared";
import { DailyView } from "../src/daily/DailyView";

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

const state = vi.hoisted(() => ({
  isWide: true,
  dailies: [] as unknown[],
  selectedDate: "",
  setSelectedDate: vi.fn(),
  upsertDaily: vi.fn(),
  deleteDaily: vi.fn(),
  togglePin: vi.fn(),
}));

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
      createItemLink: vi.fn(),
      getLinksForItem: () => ({ outgoing: [], incoming: [] }),
      syncInlineLinks: vi.fn(),
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ noteId }: { noteId: string }) => (
    <div data-testid="editor">{noteId}</div>
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
});

describe("DailyView — the open day", () => {
  it("mounts the editor for the selected date, not for today", () => {
    render(<DailyView />);
    expect(screen.getByTestId("editor").textContent).toBe(`daily-${YESTERDAY}`);
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

  it("deletes the open day", () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    fireEvent.click(
      within(screen.getByRole("menu")).getByText("materials.daily.delete"),
    );
    expect(state.deleteDaily).toHaveBeenCalledExactlyOnceWith(YESTERDAY);
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

  it("does not render the mobile date strip", () => {
    render(<DailyView />);
    expect(
      screen.queryByRole("group", { name: "materials.daily.dateStripLabel" }),
    ).toBeNull();
  });
});

describe("DailyView — mobile", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("navigates by the date strip instead of the entry panel", () => {
    render(<DailyView />);

    // The strip is the last two weeks, so a 40-day-old entry is unreachable
    // there — which is what the past-entries teaser below the editor is for.
    const strip = screen.getByRole("group", {
      name: "materials.daily.dateStripLabel",
    });
    const days = within(strip).getAllByRole("button");
    expect(days.length).toBe(14);
    fireEvent.click(days[0]);
    expect(state.setSelectedDate).toHaveBeenCalledExactlyOnceWith(isoDay(-13));
  });

  it("teases the two most recent OTHER entries and opens one on tap", () => {
    state.dailies = [
      daily(TODAY),
      daily(YESTERDAY),
      daily(LAST_WEEK),
      daily(LONG_AGO),
    ];
    render(<DailyView />);

    screen.getByText("materials.daily.pastEntries");
    screen.getByText(`entry for ${TODAY}`);
    screen.getByText(`entry for ${LAST_WEEK}`);
    // Two rows only, and never the day already open.
    expect(screen.queryByText(`entry for ${YESTERDAY}`)).toBeNull();
    expect(screen.queryByText(`entry for ${LONG_AGO}`)).toBeNull();

    fireEvent.click(
      screen.getByText(`entry for ${LAST_WEEK}`).closest("button") as
        HTMLElement | HTMLButtonElement,
    );
    expect(state.setSelectedDate).toHaveBeenCalledExactlyOnceWith(LAST_WEEK);
  });

  it("keeps the same kebab actions the desktop header has", () => {
    render(<DailyView />);

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.moreActions" }),
    );
    within(screen.getByRole("menu")).getByText("materials.daily.delete");
  });
});
