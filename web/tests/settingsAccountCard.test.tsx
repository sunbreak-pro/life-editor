import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #919 — the Account card's password change.
 *
 * The card is the "I still know my password" half of recovery, and the thing
 * worth pinning is what reaches Supabase: a typo in the confirmation must stop
 * at the screen, because `updateUser({ password })` succeeds unconditionally
 * and would lock the owner out of an account they can only recover by hand.
 *
 * Rendered through the whole screen rather than around an extracted function
 * (D-20260812-refactor-2): SettingsScreen loads under jsdom, so the button and
 * its wiring can be exercised as the user meets them.
 */

const state = vi.hoisted(() => ({
  updatePassword: vi.fn(),
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
    resetLocalPreferences: vi.fn(),
    getSession: state.getSession,
    updatePassword: state.updatePassword,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

function type(labelKey: string, value: string) {
  fireEvent.change(screen.getByLabelText(labelKey), { target: { value } });
}

function press() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings.account.submit" }),
  );
}

describe("Settings account card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
    state.updatePassword.mockResolvedValue({ error: null });
  });

  it("shows the address the session is signed in as", async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText("me@example.com")).toBeTruthy();
  });

  it("refuses a mismatched confirmation without calling Supabase", async () => {
    render(<SettingsScreen />);
    type("settings.account.newPassword", "correct-horse");
    type("settings.account.confirmPassword", "correct-hosre");
    press();

    expect(
      await screen.findByText("settings.account.errors.mismatch"),
    ).toBeTruthy();
    expect(state.updatePassword).not.toHaveBeenCalled();
  });

  it("refuses a password under the minimum without calling Supabase", async () => {
    render(<SettingsScreen />);
    type("settings.account.newPassword", "short");
    type("settings.account.confirmPassword", "short");
    press();

    expect(
      await screen.findByText("settings.account.errors.tooShort"),
    ).toBeTruthy();
    expect(state.updatePassword).not.toHaveBeenCalled();
  });

  it("sends a matching password and confirms it landed", async () => {
    render(<SettingsScreen />);
    type("settings.account.newPassword", "correct-horse");
    type("settings.account.confirmPassword", "correct-horse");
    press();

    await waitFor(() =>
      expect(state.updatePassword).toHaveBeenCalledWith("correct-horse"),
    );
    expect(await screen.findByText("settings.account.done")).toBeTruthy();
  });

  it("names the 'same as the old one' refusal instead of the generic failure", async () => {
    state.updatePassword.mockResolvedValue({
      error: "New password should be different from the old password.",
    });
    render(<SettingsScreen />);
    type("settings.account.newPassword", "correct-horse");
    type("settings.account.confirmPassword", "correct-horse");
    press();

    expect(
      await screen.findByText("settings.account.errors.samePassword"),
    ).toBeTruthy();
  });
});
