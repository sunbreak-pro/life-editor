import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1200 — sign out, and self-service account deletion.
 *
 * Two things live only in the host and are invisible to the primitives:
 *
 *   - the press-to-service routing. `deleteAccount()` erases an account for
 *     real, so the one thing that must be certain is that NOTHING calls it
 *     except the armed confirm inside the dialog — not the card's button,
 *     which only opens the question, and not a cancel.
 *   - what happens on failure. The account still exists, so the dialog has to
 *     stay up with the message rather than closing on a delete that did not
 *     happen. On success nothing is reset: the session is already gone and
 *     the screen is on its way out with it.
 *
 * Sign-out is here too because #1200 is also where the narrow layout got one:
 * the sidebar that holds the other sign-out is the wide layout only.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const EMAIL = "me@example.com";

const state = vi.hoisted(() => ({
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
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
    useTourContext: () => ({ restart: vi.fn() }),
    getSession: state.getSession,
    signOut: state.signOut,
    deleteAccount: state.deleteAccount,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

async function renderSettings() {
  render(<SettingsScreen />);
  // The address arrives a microtask after mount and the dialog's gate needs
  // it, so every test here waits for it rather than racing it.
  await act(async () => {});
}

const press = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

const typeAddress = (value: string) =>
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "settings.account.delete.inputLabel",
    }),
    { target: { value } },
  );

const CONFIRM = "settings.account.delete.confirm";

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ user: { email: EMAIL } });
  state.signOut.mockResolvedValue({ error: null });
  state.deleteAccount.mockResolvedValue({ error: null });
});

describe("SettingsScreen — signing out (#1200)", () => {
  it("has a sign-out on the account card, which ends the session", async () => {
    await renderSettings();

    press("settings.account.signOut.button");

    expect(state.signOut).toHaveBeenCalledTimes(1);
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });
});

describe("SettingsScreen — deleting the account (#1200)", () => {
  it("asks before it does anything", async () => {
    await renderSettings();

    expect(screen.queryByRole("dialog")).toBe(null);
    press("settings.account.delete.button");

    screen.getByRole("dialog", { name: "settings.account.delete.title" });
    // The card's button OPENS the question. It must never be the thing that
    // answers it.
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it("keeps the confirm inert until the address is typed back", async () => {
    await renderSettings();
    press("settings.account.delete.button");

    const confirm = screen.getByRole("button", {
      name: CONFIRM,
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    typeAddress(EMAIL);

    expect(
      (screen.getByRole("button", { name: CONFIRM }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("deletes once, on the armed confirm", async () => {
    await renderSettings();
    press("settings.account.delete.button");
    typeAddress(EMAIL);

    press(CONFIRM);

    await waitFor(() => expect(state.deleteAccount).toHaveBeenCalledTimes(1));
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("deletes nothing when the question is dismissed", async () => {
    await renderSettings();
    press("settings.account.delete.button");
    typeAddress(EMAIL);

    press("common.cancel");

    expect(screen.queryByRole("dialog")).toBe(null);
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it("forgets the typed address between asks", async () => {
    await renderSettings();
    press("settings.account.delete.button");
    typeAddress(EMAIL);
    press("common.cancel");

    press("settings.account.delete.button");

    // Re-opening on an armed button would put a confirmed delete one stray
    // press away.
    expect(
      (screen.getByRole("button", { name: CONFIRM }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("stays open with the reason when the service refuses", async () => {
    state.deleteAccount.mockResolvedValue({ error: "boom" });
    await renderSettings();
    press("settings.account.delete.button");
    typeAddress(EMAIL);

    press(CONFIRM);

    await screen.findByText("settings.account.delete.error");
    // Still up, and still armed — the account exists, so a retry is one press.
    screen.getByRole("dialog", { name: "settings.account.delete.title" });
    expect(
      (screen.getByRole("button", { name: CONFIRM }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("reports a thrown call the same way as a returned error", async () => {
    state.deleteAccount.mockRejectedValue(new Error("network"));
    await renderSettings();
    press("settings.account.delete.button");
    typeAddress(EMAIL);

    press(CONFIRM);

    await screen.findByText("settings.account.delete.error");
  });
});
