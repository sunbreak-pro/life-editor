import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1872 — "Reset all shortcuts" asks first.
 *
 * It was the one bulk press on the Settings screen that ran the moment it was
 * touched: no dialog, and every override gone. Reset preferences, Delete
 * account and Empty the trash all go through the in-app ConfirmDialog, so this
 * pins the same three things for the shortcut card — the press opens the
 * question and moves nothing, No leaves it that way, Yes resets once.
 *
 * The other Settings suites stub useShortcutConfig to null (the native mobile
 * value), which hides the card entirely; this one hands it a live stub.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  resetAll: vi.fn(),
  setBinding: vi.fn(),
  resetBinding: vi.fn(),
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
    useShortcutConfig: () => ({
      config: {},
      getDisplayString: () => "Ctrl + K",
      findConflict: () => null,
      setBinding: state.setBinding,
      resetBinding: state.resetBinding,
      resetAll: state.resetAll,
    }),
    useStartupSectionPref: () => ({ pref: "last", setPref: vi.fn() }),
    useDayStartHourPref: () => ({ dayStartHour: 4, setDayStartHour: vi.fn() }),
    useTourContext: () => ({ restart: vi.fn(), startSection: vi.fn() }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

async function pressResetAll() {
  render(<SettingsScreen />);
  await act(async () => {});
  fireEvent.click(
    screen.getByRole("button", { name: "settings.shortcuts.resetAll" }),
  );
  await screen.findByRole("dialog", {
    name: "settings.shortcuts.resetAllConfirm",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("SettingsScreen — reset all shortcuts (#1872)", () => {
  it("opens the question and resets nothing on the press itself", async () => {
    await pressResetAll();

    expect(state.resetAll).not.toHaveBeenCalled();
  });

  it("leaves every shortcut alone when the answer is no", async () => {
    await pressResetAll();

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(state.resetAll).not.toHaveBeenCalled();
  });

  it("resets once when the answer is yes", async () => {
    await pressResetAll();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.shortcuts.resetAllConfirmButton",
      }),
    );

    await waitFor(() => expect(state.resetAll).toHaveBeenCalledTimes(1));
    expect(state.setBinding).not.toHaveBeenCalled();
    expect(state.resetBinding).not.toHaveBeenCalled();
  });
});
