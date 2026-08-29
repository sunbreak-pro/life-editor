import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #781 — the Reset card's question.
 *
 * `resetLocalPreferences()` clears this device's whole preference namespace and
 * reloads the page; there is no undo and no Trash behind it. It used to be
 * guarded by the browser's own confirm, which answered inline — so the guard
 * was a plain `if`. The in-app <ConfirmDialog> (#707) answers a TICK LATER, and
 * a continuation written against the old shape would read the pending promise
 * as a truthy "yes" and wipe the settings the moment the dialog appeared. These
 * pin the two halves that matter: nothing is cleared until the answer arrives,
 * and a refusal clears nothing at all.
 *
 * Everything around the card is stubbed to its hooks — the screen is a HOST
 * (CLAUDE.md §6.4), so its own logic is exactly this one destructive press.
 */

const state = vi.hoisted(() => ({
  resetLocalPreferences: vi.fn(),
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
    // Null is the honest value on the native mobile shells, where the Provider
    // is skipped (#320) — and it keeps the shortcut table out of these renders.
    useShortcutConfig: () => null,
    useStartupSectionPref: () => ({ pref: "last", setPref: vi.fn() }),
    useDayStartHourPref: () => ({ dayStartHour: 4, setDayStartHour: vi.fn() }),
    // The tour Provider is not mounted in these renders, and useTourContext
    // throws outside it by design (#1122) — Settings' Tutorial card (#1123)
    // only needs a callable `restart` here.
    useTourContext: () => ({ restart: vi.fn() }),
    resetLocalPreferences: state.resetLocalPreferences,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

const ASK = "settings.reset.confirm";
const pressReset = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "settings.reset.button" }),
  );
const answer = (label: "settings.reset.confirmButton" | "common.cancel") =>
  fireEvent.click(screen.getByRole("button", { name: label }));

beforeEach(() => {
  state.resetLocalPreferences.mockClear();
});

describe("SettingsScreen — resetting local preferences (#781)", () => {
  it("asks in-app, and clears nothing while the question is open", async () => {
    render(<SettingsScreen />);
    pressReset();

    await screen.findByRole("dialog", { name: ASK });
    // A question, not a farewell.
    expect(state.resetLocalPreferences).not.toHaveBeenCalled();
    // Both answers are offered — this one IS refusable, unlike an acknowledge —
    // and getByRole throws when either is missing.
    screen.getByRole("button", { name: "settings.reset.confirmButton" });
    screen.getByRole("button", { name: "common.cancel" });
  });

  it("clears nothing when the question is refused", async () => {
    render(<SettingsScreen />);
    pressReset();
    await screen.findByRole("dialog", { name: ASK });

    answer("common.cancel");
    await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
    expect(state.resetLocalPreferences).not.toHaveBeenCalled();

    // And the card still works: a refusal is not a one-shot fuse.
    pressReset();
    await screen.findByRole("dialog", { name: ASK });
  });

  it("clears the preferences once it is agreed to", async () => {
    render(<SettingsScreen />);
    pressReset();
    await screen.findByRole("dialog", { name: ASK });

    answer("settings.reset.confirmButton");
    await waitFor(() =>
      expect(state.resetLocalPreferences).toHaveBeenCalledTimes(1),
    );
    // The question goes away with the answer, not before it.
    await waitFor(() => expect(screen.queryByText(ASK)).toBeNull());
  });
});
