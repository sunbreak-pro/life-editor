import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";
import { LegalReaderHost } from "../src/legal/LegalReaderHost";
import { LEGAL_DOCUMENTS } from "../src/legal/legalContent";

/*
 * #1251 — the signed-in door to the policy and the terms.
 *
 * #1198 shipped the documents with links on the sign-in card only, so they
 * stopped existing the moment an account did. This suite is the end-to-end
 * version of the fix: press the button in Settings, get the document — with
 * nothing passed between them but the URL.
 *
 * `RightSidebarPortal` is stubbed to render inline, the way the other Settings
 * suites do: without a RightSidebarProvider the real one renders nothing.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
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
      setInitialView: vi.fn(),
    }),
    useTourContext: () => ({ restart: vi.fn(), startSection: vi.fn() }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

const EN = LEGAL_DOCUMENTS.en;

function setQuery(search: string): void {
  window.history.replaceState({}, "", `${window.location.pathname}${search}`);
}

/*
 * The account card reads the session on mount (#919) and the mock resolves a
 * microtask later, so a bare render would report that arrival as an update
 * outside act(). Flushing it up front keeps the noise out.
 */
async function renderSignedIn() {
  render(
    <>
      <SettingsScreen />
      <LegalReaderHost />
    </>,
  );
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  setQuery("");
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("Settings — policy and terms (#1251)", () => {
  it("carries a card for them on the General category", async () => {
    await renderSignedIn();

    expect(screen.getByText("settings.legal.heading")).toBeTruthy();
    expect(screen.getByText("settings.legal.description")).toBeTruthy();
  });

  it("opens the privacy policy from Settings", async () => {
    await renderSignedIn();
    expect(screen.queryByText(EN.privacy.title)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.privacy" }));

    expect(screen.getByText(EN.privacy.title)).toBeTruthy();
    // Settings is still mounted underneath — the reader overlays, so coming
    // back does not cost the category the user was on.
    expect(screen.getByText("settings.legal.heading")).toBeTruthy();
  });

  it("opens the terms from Settings", async () => {
    await renderSignedIn();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));

    expect(screen.getByText(EN.terms.title)).toBeTruthy();
  });

  it("leaves a linkable URL behind, the same one the sign-in footer writes", async () => {
    await renderSignedIn();

    fireEvent.click(screen.getByRole("button", { name: "auth.legal.terms" }));

    expect(window.location.search).toBe("?legal=terms");
  });
});
