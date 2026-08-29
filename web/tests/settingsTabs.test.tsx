import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1174 — Settings as CATEGORIES.
 *
 * The screen grew a second axis: the rightSidebar face lists the categories
 * and the body below shows one of them. Two things about that are easy to get
 * wrong and invisible to the primitives' own suites, which never see the
 * screen that wires them:
 *
 *   - a category row swaps the BODY. Every card that used to be on screen at
 *     once now depends on `tab`, so a row that fails to switch (or a body that
 *     forgets to hide) reads as "the setting disappeared".
 *   - the Tips row is NOT a category. It raises a centred dialog and must
 *     leave the body it was pressed from exactly where it was — the one row in
 *     the list whose press means something different from all the others.
 *
 * `RightSidebarPortal` is stubbed to render inline, the way the other Settings
 * suites do: without a RightSidebarProvider the real one renders nothing, and
 * the nav under test would never reach the document.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  setInitialView: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
    useMediaQuery: () => true,
    useThemeContext: () => ({
      theme: "light",
      themeMode: "system",
      fontSize: 3,
      fontFamily: "system",
      reduceMotion: "system",
      language: "en",
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      setThemeMode: vi.fn(),
      setFontSize: vi.fn(),
      setFontFamily: vi.fn(),
      setReduceMotion: vi.fn(),
      setLanguage: vi.fn(),
    }),
    useShortcutConfig: () => null,
    useStartupSectionPref: () => ({ pref: "last", setPref: vi.fn() }),
    useDayStartHourPref: () => ({ dayStartHour: 4, setDayStartHour: vi.fn() }),
    useScheduleInitialViewPref: () => ({
      initialView: "week",
      setInitialView: state.setInitialView,
    }),
    useTourContext: () => ({ restart: vi.fn() }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/** The list, in the order #1174 fixes it. Labels are the mocked t() keys. */
const ROWS = [
  "settings.tabs.general",
  "section.briefing",
  "section.schedule",
  "section.materials",
  "section.work",
  "section.analytics",
  "settings.tabs.tips",
];

const nav = () =>
  screen.getByRole("navigation", { name: "settings.tabs.navLabel" });
const rowLabels = () =>
  Array.from(nav().querySelectorAll("button")).map((b) =>
    b.getAttribute("aria-label"),
  );
const pressRow = (label: string) =>
  fireEvent.click(screen.getByRole("button", { name: label }));

/** The Reset card only exists on General — a cheap "which body is up" probe. */
const generalOnScreen = () =>
  screen.queryByRole("button", { name: "settings.reset.button" }) !== null;

/*
 * The account card reads the session on mount (#919) and the mock resolves a
 * microtask later, so every render here would otherwise report that arrival as
 * an update outside act(). Flushing it up front keeps the noise out of six
 * tests that have nothing to do with the session.
 */
async function renderSettings() {
  render(<SettingsScreen />);
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("SettingsScreen — the category list (#1174)", () => {
  it("lists the seven rows in order, with Tips last", async () => {
    await renderSettings();

    expect(rowLabels()).toEqual(ROWS);
  });

  it("opens on General, with the current row marked", async () => {
    await renderSettings();

    expect(generalOnScreen()).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "settings.tabs.general" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("swaps the body when a category is chosen", async () => {
    await renderSettings();

    pressRow("section.schedule");

    // The Schedule card arrived and General went with the press.
    screen.getByRole("radiogroup", {
      name: "settings.schedule.initialViewLabel",
    });
    expect(generalOnScreen()).toBe(false);
  });

  it("gives a category with no settings yet a reason rather than a blank column", async () => {
    await renderSettings();

    pressRow("section.work");

    screen.getByText("settings.placeholder.message");
    expect(generalOnScreen()).toBe(false);
  });

  it("comes back to General", async () => {
    await renderSettings();

    pressRow("section.analytics");
    pressRow("settings.tabs.general");

    expect(generalOnScreen()).toBe(true);
  });
});

describe("SettingsScreen — the Schedule category (#1174)", () => {
  it("initial-view segment → setInitialView(the view pressed)", async () => {
    await renderSettings();
    pressRow("section.schedule");

    fireEvent.click(
      screen.getByRole("radio", { name: "settings.schedule.month" }),
    );

    expect(state.setInitialView.mock.calls).toEqual([["month"]]);
  });

  it("shows the stored choice as the checked one", async () => {
    await renderSettings();
    pressRow("section.schedule");

    expect(
      screen
        .getByRole("radio", { name: "settings.schedule.week" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
});

describe("SettingsScreen — the Tips row (#1174)", () => {
  it("raises a centred dialog instead of swapping the body", async () => {
    await renderSettings();

    expect(screen.queryByRole("dialog")).toBe(null);
    pressRow("settings.tabs.tips");

    screen.getByRole("dialog", { name: "settings.tabs.tips" });
    // The category underneath is untouched — Tips is not a category.
    expect(generalOnScreen()).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "settings.tabs.general" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("closes again, leaving the body it was opened over", async () => {
    await renderSettings();

    pressRow("settings.tabs.tips");
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));

    expect(screen.queryByRole("dialog")).toBe(null);
    expect(generalOnScreen()).toBe(true);
  });
});
