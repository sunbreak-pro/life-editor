import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1210 — the AI integration card, as the HOST wires it.
 *
 * The card itself is pinned in shared/tests/settingsAiIntegration.test.tsx.
 * What only this side can see is the read behind it, and the read has a
 * failure mode that is easy to reintroduce: `getDataService()` THROWS
 * SYNCHRONOUSLY when the app has no Supabase credentials. A `.catch()` on the
 * returned promise never sees that throw, so the first version of this effect
 * took the whole Settings screen down in every suite that renders it — 48
 * tests across 7 files, none of them about AI. The last case here is that
 * regression, kept close to the code that caused it.
 *
 * No jest-dom in web/: presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const BRIEFING_DOC = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Briefing" }] },
    { type: "paragraph", content: [{ type: "text", text: "A word on yesterday." }] },
  ],
});

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  getDataService: vi.fn(),
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
      setInitialView: vi.fn(),
    }),
    useTourContext: () => ({ restart: vi.fn(), startSection: vi.fn() }),
    getSession: state.getSession,
    getDataService: state.getDataService,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/** A DataService stub with only the one method this screen calls. */
const serviceReturning = (dailies: unknown[]) => ({
  listDailiesUnified: () => Promise.resolve(dailies),
});

describe("Settings AI integration card (#1210)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getSession.mockResolvedValue(null);
    state.getDataService.mockReturnValue(serviceReturning([]));
  });

  it("names the newest daily carrying a briefing", async () => {
    state.getDataService.mockReturnValue(
      serviceReturning([
        { date: "2026-08-28", content: BRIEFING_DOC },
        { date: "2026-08-30", content: BRIEFING_DOC },
      ]),
    );
    render(<SettingsScreen />);
    await waitFor(() => {
      screen.getByText("settings.ai.activityValue|2026-08-30");
    });
  });

  it("says 'nothing yet' rather than a date when no daily has one", async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      screen.getByText("settings.ai.activityNone");
    });
  });

  it("lists the generated catalog behind a collapsed toggle", async () => {
    render(<SettingsScreen />);
    await waitFor(() => {
      screen.getByText("settings.ai.heading");
    });
    // write_briefing is a real registry entry, so this also proves the list is
    // the generated one and not a literal in the component.
    expect(screen.queryByText("write_briefing")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /settings.ai.show/ }));
    screen.getByText("write_briefing");
  });

  it("survives a DataService that cannot even be constructed", async () => {
    state.getDataService.mockImplementation(() => {
      throw new Error("Supabase credentials missing");
    });
    render(<SettingsScreen />);
    // The rest of the screen is still there…
    screen.getByText("settings.appearance");
    // …and the card settles on the honest answer rather than spinning forever.
    await waitFor(() => {
      screen.getByText("settings.ai.activityNone");
    });
  });
});
