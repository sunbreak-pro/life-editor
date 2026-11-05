import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  i18n,
  type Session,
  type TimerContextValue,
} from "@life-editor/shared";
import { MainScreen } from "../src/MainScreen";

/*
 * #2390 — what the rightSidebar toggle is called, screen by screen.
 *
 * The real MainScreen, AppShell, tab band, section descriptors and i18next
 * catalog, so a label that never reaches the button, or a key missing from a
 * locale, fails here. What is stubbed is everything the name does not depend
 * on: the global Provider chain (only RightSidebar, which the toggle reads, and
 * an idle Timer for the sidebar stay) and the section bodies, each of which would otherwise need its own
 * Providers and a DataService.
 */

function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useSyncDomains: () => 0,
    getDataService: () => ({}),
    WikiTagsUnifiedProvider: Passthrough,
    DailiesUnifiedProvider: Passthrough,
  };
});

vi.mock("../src/AppProviders", async () => {
  const { RightSidebarProvider, TimerContext } =
    await import("@life-editor/shared");
  // An idle timer: the sidebar's timer row reads it and then draws nothing.
  const idleTimer = { isRunning: false } as TimerContextValue;
  return {
    AppProviders: ({ children }: { children: ReactNode }) => (
      <TimerContext.Provider value={idleTimer}>
        <RightSidebarProvider>{children}</RightSidebarProvider>
      </TimerContext.Provider>
    ),
  };
});
vi.mock("../src/HeaderUndoRedo", () => ({ HeaderUndoRedo: () => null }));
vi.mock("../src/TourHost", () => ({ TourHost: () => null }));
vi.mock("../src/MobileShellActions", () => ({
  MobileShellActions: () => null,
}));
vi.mock("../src/lazySections", () => ({
  NotesView: () => <div data-testid="notes-body" />,
  AnalyticsScreen: () => <div data-testid="analytics-body" />,
  prefetchLazySections: () => undefined,
}));
vi.mock("../src/notes/NotesUnifiedHost", () => ({
  NotesUnifiedHost: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../src/daily/DailyView", () => ({
  DailyView: () => <div data-testid="daily-body" />,
}));
vi.mock("../src/briefing/BriefingScreen", () => ({
  BriefingScreen: () => <div data-testid="briefing-body" />,
}));
vi.mock("../src/work/WorkScreen", () => ({
  WorkScreen: () => <div data-testid="work-body" />,
}));

const SESSION = {
  user: { id: "user-1", email: "a@example.com", user_metadata: {} },
} as unknown as Session;

/** A navigation row, by the section's label in the current language. */
function goToSection(key: "section.materials" | "section.work"): void {
  fireEvent.click(screen.getByRole("button", { name: i18n.t(key) }));
}

/** A tab of the Materials band, by its visible name (the count may follow it). */
function selectMaterialsTab(key: "section.notes" | "section.daily"): void {
  const band = screen.getByRole("tablist", {
    name: i18n.t("section.materials"),
  });
  const tab = within(band)
    .getAllByRole("tab")
    .find((t) => t.textContent?.startsWith(i18n.t(key)));
  if (!tab) throw new Error(`no Materials tab named ${key}`);
  fireEvent.click(tab);
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("ja");
});

afterEach(() => {
  // jsdom has no matchMedia, which useMediaQuery reads as "wide".
  delete (window as Partial<Window>).matchMedia;
});

// The singleton outlives this file; leave it on the default the others expect.
afterAll(async () => {
  await i18n.changeLanguage("en");
});

describe("rightSidebar toggle name (#2390)", () => {
  it("says the note list on the Notes screen, and flips with the panel", () => {
    render(<MainScreen session={SESSION} />);
    goToSection("section.materials");

    const toggle = screen.getByRole("button", { name: "ノート一覧を開く" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);

    expect(
      screen
        .getByRole("button", { name: "ノート一覧を閉じる" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("carries the English pair too", async () => {
    await i18n.changeLanguage("en");
    render(<MainScreen session={SESSION} />);
    goToSection("section.materials");

    fireEvent.click(screen.getByRole("button", { name: "Open note list" }));

    expect(
      screen.getByRole("button", { name: "Close note list" }),
    ).toBeTruthy();
  });

  it("names the calendar on the Daily tab of the same section (#2588)", () => {
    render(<MainScreen session={SESSION} />);
    goToSection("section.materials");

    selectMaterialsTab("section.daily");

    screen.getByTestId("daily-body");
    fireEvent.click(screen.getByRole("button", { name: "カレンダーを開く" }));
    expect(
      screen.getByRole("button", { name: "カレンダーを閉じる" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "ノート一覧を開く" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "カレンダーを閉じる" }));

    selectMaterialsTab("section.notes");

    expect(
      screen.getByRole("button", { name: "ノート一覧を開く" }),
    ).toBeTruthy();
  });

  it("keeps the generic name on the other sections", () => {
    render(<MainScreen session={SESSION} />);

    // The landing section first, then one reached from the sidebar.
    screen.getByTestId("briefing-body");
    fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
    expect(screen.getByRole("button", { name: "詳細を閉じる" })).toBeTruthy();

    goToSection("section.work");

    screen.getByTestId("work-body");
    expect(screen.getByRole("button", { name: "詳細を閉じる" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "ノート一覧を閉じる" }),
    ).toBeNull();
  });

  it("names the narrow hamburger the same way, since it opens the same list", () => {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    render(<MainScreen session={SESSION} />);
    // The bottom bar's row, on this width.
    goToSection("section.materials");

    expect(
      screen.getByRole("button", { name: "ノート一覧を開く" }),
    ).toBeTruthy();
  });
});
