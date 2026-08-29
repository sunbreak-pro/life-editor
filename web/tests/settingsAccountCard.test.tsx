import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { PASSWORD_MIN_LENGTH } from "@life-editor/shared";
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
    // The tour Provider is not mounted in these renders, and useTourContext
    // throws outside it by design (#1122) — Settings' Tutorial card (#1123)
    // only needs a callable `restart` here.
    useTourContext: () => ({ restart: vi.fn() }),
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

  /*
   * #945 — the field a password manager reads to decide WHICH saved entry the
   * new password replaces. It is hidden, so no user-facing assertion can catch
   * its loss; the guard has to name the attribute the browser keys off. The
   * prop is optional on the form (the recovery card may not know an address),
   * which is exactly why Settings — where the address is always known — needs
   * its own pin against someone dropping the wiring.
   */
  it("carries the signed-in address as the password manager's username", async () => {
    const { container } = render(<SettingsScreen />);
    await screen.findByText("me@example.com");

    const username = container.querySelector<HTMLInputElement>(
      'input[autocomplete="username"]',
    );
    expect(username).not.toBeNull();
    expect(username?.value).toBe("me@example.com");
    // Hidden and read-only: it is context for the browser, not a field the
    // owner is meant to see or edit on this card.
    expect(username?.hidden).toBe(true);
    expect(username?.readOnly).toBe(true);
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

  // The two sides of the floor (#956). One character under and exactly on it,
  // rather than an obviously-short string, because the bug this guards is an
  // off-by-one in the comparison — and the length is read from the constant so
  // the boundary follows it instead of going stale at the old value.
  it("refuses a password one character under the floor, without calling Supabase", async () => {
    const justUnder = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    render(<SettingsScreen />);
    type("settings.account.newPassword", justUnder);
    type("settings.account.confirmPassword", justUnder);
    press();

    // The message quotes the same constant it was checked against — the `|n`
    // tail is this file's `t` mock rendering the interpolation options.
    expect(
      await screen.findByText(
        `settings.account.errors.tooShort|${PASSWORD_MIN_LENGTH}`,
      ),
    ).toBeTruthy();
    expect(state.updatePassword).not.toHaveBeenCalled();
  });

  it("accepts a password exactly at the floor", async () => {
    const atFloor = "a".repeat(PASSWORD_MIN_LENGTH);
    render(<SettingsScreen />);
    type("settings.account.newPassword", atFloor);
    type("settings.account.confirmPassword", atFloor);
    press();

    await waitFor(() =>
      expect(state.updatePassword).toHaveBeenCalledWith(atFloor),
    );
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
