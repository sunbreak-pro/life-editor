import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1182 — the host's half of the mobile size presets.
 *
 * The three-stop control itself is pinned in shared (mobileFontSizePresets).
 * What only the screen can get wrong is the wiring: `touch` is derived from
 * the media query here, and the px readout beside the group is a DIFFERENT
 * label from the slider's (`fontSizeValue` reads "18px (5/10)", which is a
 * lie next to three stops). Both are invisible to the primitive's own suite,
 * which is handed whatever the test passes it.
 *
 * Every other suite on this screen renders wide; this one is the narrow twin.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  setFontSize: vi.fn(),
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
    // The narrow layout — the whole point of this suite.
    useMediaQuery: () => false,
    useThemeContext: () => ({
      theme: "light",
      themeMode: "system",
      // The app default (18px) = the middle preset.
      fontSize: 5,
      fontFamily: "system",
      reduceMotion: "system",
      language: "en",
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      setThemeMode: vi.fn(),
      setFontSize: state.setFontSize,
      setFontFamily: vi.fn(),
      setReduceMotion: vi.fn(),
      setLanguage: vi.fn(),
    }),
    // Null is the honest value on the native mobile shells (#320).
    useShortcutConfig: () => null,
    useStartupSectionPref: () => ({ pref: "last", setPref: vi.fn() }),
    useDayStartHourPref: () => ({ dayStartHour: 4, setDayStartHour: vi.fn() }),
    useTourContext: () => ({ restart: vi.fn() }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

async function renderSettings() {
  render(<SettingsScreen />);
  // The account card's session read (#919) resolves a microtask after mount.
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("SettingsScreen — font size on the narrow layout (#1182)", () => {
  it("offers three presets instead of the ten-step slider", async () => {
    await renderSettings();

    for (const name of [
      "settings.fontSizePresetSmall",
      "settings.fontSizePresetMedium",
      "settings.fontSizePresetLarge",
    ]) {
      screen.getByRole("radio", { name });
    }
    expect(screen.queryByRole("slider")).toBe(null);
  });

  it("reports the plain px, not the slider's step-of-ten reading", async () => {
    await renderSettings();

    screen.getByText("settings.fontSizePx|18");
    expect(screen.queryByText("settings.fontSizeValue|18,5,10")).toBe(null);
  });

  it("a preset reaches setFontSize with a step on the shared scale", async () => {
    await renderSettings();

    fireEvent.click(
      screen.getByRole("radio", { name: "settings.fontSizePresetSmall" }),
    );

    expect(state.setFontSize.mock.calls).toEqual([[3]]);
  });
});
