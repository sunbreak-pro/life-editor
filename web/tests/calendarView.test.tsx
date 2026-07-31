import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarView } from "../src/schedule/CalendarView";

/*
 * #468 — the calendar ledger modal.
 *
 * The thing under test is a single verdict: "this calendar's tag was deleted".
 * It is the most expensive claim this screen makes, because it swaps the title
 * input for static struck-through text and leaves Delete as the only action —
 * and `calendars` has NO trash path (0006 omits is_deleted), so acting on it is
 * irreversible.
 *
 * A name lookup alone cannot support that claim. "Not loaded yet" and "the
 * fetch failed" both miss exactly the same way, and both really happen here:
 * the view's own loading gate covers the CALENDARS, while the tags arrive from
 * a separate hook that awaits tags + fully-paginated assignments + connections,
 * so the calendars routinely win the race. These pin the three states apart.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const state = vi.hoisted(() => ({
  calendars: [] as {
    id: string;
    title: string;
    tagId: string;
    order: number;
    createdAt: string;
    updatedAt: string;
  }[],
  tags: [] as { id: string; name: string }[],
  tagsLoading: false,
  deleteCalendar: vi.fn(),
}));

vi.mock("@life-editor/shared", () => ({
  useCalendarContext: () => ({
    calendars: state.calendars,
    isLoading: false,
    error: null,
    createCalendar: vi.fn(),
    updateCalendar: vi.fn(),
    deleteCalendar: state.deleteCalendar,
  }),
  useWikiTagsUnifiedContext: () => ({
    allTags: state.tags,
    loading: state.tagsLoading,
  }),
  // Keys through, with the interpolation appended so a string that carries the
  // tag id / name can still be told apart from one that does not.
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}|${Object.values(opts).join(",")}` : key,
  }),
}));

const CAL = {
  id: "cal-1",
  title: "Work",
  tagId: "tag-work",
  order: 0,
  createdAt: "2026-07-31T00:00:00Z",
  updatedAt: "2026-07-31T00:00:00Z",
};

const MISSING = "scheduleScreen.calendarTagMissing";

beforeEach(() => {
  state.calendars = [CAL];
  state.tags = [];
  state.tagsLoading = false;
  state.deleteCalendar.mockClear();
});

describe("CalendarView — the deleted-tag verdict", () => {
  it("does not call a tag deleted while the tag list is still loading", () => {
    state.tagsLoading = true;
    render(<CalendarView />);

    expect(screen.queryByText(MISSING)).toBeNull();
    // The title is still editable, so Delete is not the only way out.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    // The create row's "make a tag first" line misreads the same way, so it is
    // behind the same gate.
    expect(screen.queryByText("scheduleScreen.calendarsNoTags")).toBeNull();
    screen.getByText("scheduleScreen.calendarTagsLoading");
  });

  it("does not call a tag deleted when the tag fetch failed", () => {
    // The failure shape: `refresh` has no catch, so a throw leaves allTags at
    // [] and still flips loading off. Indistinguishable from a deletion by
    // lookup — so it does not get to claim one, permanently.
    state.tagsLoading = false;
    state.tags = [];
    render(<CalendarView />);

    expect(screen.queryByText(MISSING)).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    // It shows the raw id rather than a name it does not have.
    screen.getByText("scheduleScreen.calendarTagPrefix|tag-work");
  });

  it("names the tag once the list is in hand", () => {
    state.tags = [{ id: "tag-work", name: "Work" }];
    render(<CalendarView />);

    expect(screen.queryByText(MISSING)).toBeNull();
    screen.getByText("scheduleScreen.calendarTagPrefix|Work");
  });

  it("calls it deleted only when the loaded list really lacks it", () => {
    // Tags loaded, non-empty, and this calendar's tag is not among them: the
    // one state where the soft-deleted-tag diagnosis is actually true.
    state.tags = [{ id: "tag-home", name: "Home" }];
    render(<CalendarView />);

    screen.getByText(MISSING);
    // Title is now static text — renaming a calendar that can never match
    // anything would only make a broken filter look tidy.
    expect(screen.queryAllByRole("textbox")).toHaveLength(1); // the create input only
    screen.getByText("Work");
  });
});
