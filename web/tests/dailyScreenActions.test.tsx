import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import {
  DailiesUnifiedProvider,
  WikiTagsUnifiedProvider,
  type DataService,
} from "@life-editor/shared";
import { stubDataService, createBumpableSync } from "./helpers";
import { DailyView } from "../src/daily/DailyView";

/*
 * #1012 — the Daily screen, driven through its buttons' ARGUMENTS.
 *
 * dailyView.test.tsx already pins this screen against a STUBBED
 * DailiesUnifiedContext: press the kebab's delete and `deleteDaily` is called
 * with the open date. What that cannot see is everything below the context —
 * and that is where Daily's real wiring lives, because none of its three
 * actions reaches the service by the id the user's click carried:
 *
 *   pin    → getDailyByDateUnified(date) → updateDailyUnified(ROW.id, { isPinned })
 *   delete → getDailyByDateUnified(date) → softDeleteDailyUnified(ROW.id)
 *   save   → upsertDailyByDateUnified(date, body)
 *
 * Two of the three resolve a DATE into a row and then write by that row's OWN
 * id. The fixtures below therefore give the rows ids that are deliberately not
 * `daily-<date>`: a host that reconstructs the id from the date instead of
 * reading it off the resolved row passes every context-level test and writes to
 * a row that does not exist.
 *
 * So this suite mounts the REAL providers over a fake DataService and asserts
 * the method, its arguments, and that no sibling write fired.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
      i18n: { language: "en" },
    }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
    useRightSidebarOptional: () => null,
  };
});

/*
 * The editor is stubbed to the one moment the host is wired to — a save
 * carrying a body. TipTap's own behaviour is covered elsewhere, and jsdom has
 * no layout to drive the real one with (CLAUDE.md §7.1).
 */
vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({
    noteId,
    onUpdate,
  }: {
    noteId: string;
    onUpdate?: (content: string) => void;
  }) => (
    <div data-testid="editor">
      {noteId}
      <button data-testid="save" onClick={() => onUpdate?.(BODY)} />
      <button data-testid="save-empty" onClick={() => onUpdate?.(EMPTY_BODY)} />
    </div>
  ),
}));

const BODY = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "wrote" }] }],
});
const EMPTY_BODY = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

/** Every write a click on this screen can reach — the "no sibling" pool. */
const WRITE_METHODS = [
  "upsertDailyByDateUnified",
  "updateDailyUnified",
  "softDeleteDailyUnified",
  "restoreDailyUnified",
  "permanentDeleteDailyUnified",
  "createItemLink",
  "deleteItemLink",
] as const;

/** The view's own date math, so "today" means the same thing on both sides. */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = isoDay(0);
const YESTERDAY = isoDay(-1);

/*
 * Row ids that are NOT `daily-<date>`. Real rows carry exactly this shape (the
 * id is minted once and the date is a column), and it is what makes the
 * "resolve, then write by the row's id" step assertable.
 */
const ROW_ID: Record<string, string> = {
  [TODAY]: "daily-row-today",
  [YESTERDAY]: "daily-row-yesterday",
};

function row(date: string, over: Record<string, unknown> = {}) {
  return {
    id: ROW_ID[date],
    type: "daily",
    date,
    title: date,
    content: `entry for ${date}`,
    isPinned: false,
    isDeleted: false,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    ...over,
  };
}

interface Harness {
  ds: DataService;
  fns: Record<string, Mock>;
}

function makeHarness(rows = [row(TODAY), row(YESTERDAY)]): Harness {
  const fns: Record<string, Mock> = {
    listDailiesUnified: vi.fn(async () => rows.map((r) => ({ ...r }))),
    getDailyByDateUnified: vi.fn(async (date: string) => {
      const found = rows.find((r) => r.date === date);
      return found ? { ...found } : null;
    }),
    // The tag provider's three bulk reads — Daily's inline-link wiring hangs
    // off them, and without the Provider the screen does not mount at all.
    listAllWikiTagsUnified: vi.fn(async () => []),
    listAllTagAssignments: vi.fn(async () => []),
    listAllTagConnections: vi.fn(async () => []),
    // The evening card's schedule read (#1046) — a passive summary, so an
    // empty day is the honest default here.
    fetchScheduleItemsByDate: vi.fn(async () => []),
  };
  for (const method of WRITE_METHODS) {
    fns[method] = vi.fn(async () => ({ ...rows[0] }));
  }
  return { ds: stubDataService(fns) as DataService, fns };
}

const { wrapper: SyncWrapper } = createBumpableSync();

/** Renders the screen under the REAL providers and waits for the load. */
async function renderDaily(harness: Harness) {
  render(
    <SyncWrapper>
      <WikiTagsUnifiedProvider dataService={harness.ds}>
        <DailiesUnifiedProvider dataService={harness.ds}>
          <DailyView dataService={harness.ds} />
        </DailiesUnifiedProvider>
      </WikiTagsUnifiedProvider>
    </SyncWrapper>,
  );
  // The editor arrives on its own chunk (#991), so the first paint is the
  // placeholder.
  await screen.findByTestId("editor");
  await screen.findByText(`entry for ${YESTERDAY}`);
}

/** Moves the selection off today, through the entry panel the user uses. */
function openYesterday() {
  const entry = screen
    .getAllByRole("button")
    .find((b) => b.textContent?.includes(`entry for ${YESTERDAY}`));
  if (!entry) throw new Error("no entry row for yesterday");
  fireEvent.click(entry);
}

const kebab = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "materials.daily.moreActions" }),
  );

function menuItem(label: string) {
  fireEvent.click(within(screen.getByRole("menu")).getByText(label));
}

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
  localStorage.clear();
  vi.clearAllMocks();
});

describe("DailyView — the kebab writes to the row the date resolves to", () => {
  it("pin → updateDailyUnified(rowId, { isPinned: true }) for the OPEN day", async () => {
    const harness = await makeHarness();
    await renderDaily(harness);
    openYesterday();

    kebab();
    menuItem("materials.daily.pin");

    await waitFor(() =>
      expect(harness.fns.updateDailyUnified).toHaveBeenCalled(),
    );
    // The date the click carried is looked up first…
    expect(harness.fns.getDailyByDateUnified.mock.calls).toEqual([[YESTERDAY]]);
    // …and the write goes to THAT row's id, which is not `daily-<date>`.
    expectOnlyWrite(harness.fns, "updateDailyUnified", [
      ROW_ID[YESTERDAY],
      { isPinned: true },
    ]);
  });

  it("unpin sends the flipped flag, not a second pin", async () => {
    const harness = makeHarness([
      row(TODAY),
      row(YESTERDAY, { isPinned: true }),
    ]);
    await renderDaily(harness);
    openYesterday();

    kebab();
    menuItem("materials.daily.unpin");

    await waitFor(() =>
      expect(harness.fns.updateDailyUnified).toHaveBeenCalled(),
    );
    expectOnlyWrite(harness.fns, "updateDailyUnified", [
      ROW_ID[YESTERDAY],
      { isPinned: false },
    ]);
  });

  it("delete → softDeleteDailyUnified(rowId), never the permanent one", async () => {
    const harness = makeHarness();
    await renderDaily(harness);
    openYesterday();

    kebab();
    menuItem("materials.daily.delete");

    await waitFor(() =>
      expect(harness.fns.softDeleteDailyUnified).toHaveBeenCalled(),
    );
    expect(harness.fns.getDailyByDateUnified.mock.calls).toEqual([[YESTERDAY]]);
    // Dailies are soft-deleted so Trash can restore them; a permanent delete
    // from a kebab would be unrecoverable and is not what this menu offers.
    expectOnlyWrite(harness.fns, "softDeleteDailyUnified", [ROW_ID[YESTERDAY]]);
  });

  it("aims at today when today is what is open", async () => {
    const harness = makeHarness();
    await renderDaily(harness);
    // Opened explicitly rather than relied on as the default: the selection
    // store is module-level and outlives the tree by design (#282), so what
    // "the open day" is depends on where the session left off.
    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.today" }),
    );

    kebab();
    menuItem("materials.daily.delete");

    await waitFor(() =>
      expect(harness.fns.softDeleteDailyUnified).toHaveBeenCalled(),
    );
    expectOnlyWrite(harness.fns, "softDeleteDailyUnified", [ROW_ID[TODAY]]);
  });
});

describe("DailyView — the editor's save", () => {
  it("writes the body under the open DATE, not under a row id", async () => {
    const harness = makeHarness();
    await renderDaily(harness);
    openYesterday();

    fireEvent.click(screen.getByTestId("save"));

    await waitFor(() =>
      expect(harness.fns.upsertDailyByDateUnified).toHaveBeenCalled(),
    );
    // upsert-by-date is the one write that must NOT resolve an id first: a day
    // with no row yet is exactly the case it exists for.
    expectOnlyWrite(harness.fns, "upsertDailyByDateUnified", [YESTERDAY, BODY]);
  });

  it("mints nothing for an empty body on a day that has no entry", async () => {
    // Only today has a row; the strip's other days are blank.
    const harness = makeHarness([row(TODAY)]);
    render(
      <SyncWrapper>
        <WikiTagsUnifiedProvider dataService={harness.ds}>
          <DailiesUnifiedProvider dataService={harness.ds}>
            <DailyView dataService={harness.ds} />
          </DailiesUnifiedProvider>
        </WikiTagsUnifiedProvider>
      </SyncWrapper>,
    );
    await screen.findByTestId("editor");
    // Jump to a day with no stored entry: the date picker's "yesterday".
    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.yesterday" }),
    );

    fireEvent.click(screen.getByTestId("save-empty"));

    // Typing and deleting everything on a blank day would otherwise mint an
    // empty row and bump the sync cursor for nothing.
    for (const method of WRITE_METHODS) {
      expect(harness.fns[method]).not.toHaveBeenCalled();
    }
  });
});

describe("DailyView — what writes nothing at all", () => {
  it("jumping to today is navigation", async () => {
    const harness = makeHarness();
    await renderDaily(harness);
    openYesterday();

    fireEvent.click(
      screen.getByRole("button", { name: "materials.daily.toToday" }),
    );

    expect((await screen.findByTestId("editor")).textContent).toBe(
      `daily-${TODAY}`,
    );
    for (const method of WRITE_METHODS) {
      expect(harness.fns[method]).not.toHaveBeenCalled();
    }
  });

  it("picking an entry from the panel only changes what is open", async () => {
    const harness = makeHarness();
    await renderDaily(harness);

    openYesterday();

    expect((await screen.findByTestId("editor")).textContent).toBe(
      `daily-${YESTERDAY}`,
    );
    for (const method of WRITE_METHODS) {
      expect(harness.fns[method]).not.toHaveBeenCalled();
    }
  });

  it("opening the kebab without choosing anything writes nothing", async () => {
    const harness = makeHarness();
    await renderDaily(harness);

    kebab();
    screen.getByRole("menu");

    expect(harness.fns.getDailyByDateUnified).not.toHaveBeenCalled();
    for (const method of WRITE_METHODS) {
      expect(harness.fns[method]).not.toHaveBeenCalled();
    }
  });
});
