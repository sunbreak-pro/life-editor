import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1624 — the Profile category and its display-name form.
 *
 * Rendered through the whole screen (D-20260812-refactor-2): the things worth
 * pinning are wiring, not layout — the stored name seeds the field, the value
 * that reaches Supabase is the one typed, a failure says so, and the shell's
 * "open Profile" intent actually lands on this category and is consumed.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  updateDisplayName: vi.fn(),
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
    useTourContext: () => ({ restart: vi.fn(), startSection: vi.fn() }),
    resetLocalPreferences: vi.fn(),
    getSession: state.getSession,
    updateDisplayName: state.updateDisplayName,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

const FIELD = "settings.profile.displayNameLabel";
const SUBMIT = "settings.profile.submit";

function openProfile() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings.tabs.profile" }),
  );
}

describe("Settings profile card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.getSession.mockResolvedValue({
      user: {
        email: "me@example.com",
        user_metadata: { display_name: "Kodai" },
      },
    });
    state.updateDisplayName.mockResolvedValue({ error: null });
  });

  it("seeds the field with the stored name", async () => {
    render(<SettingsScreen />);
    openProfile();

    await waitFor(() =>
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe(
        "Kodai",
      ),
    );
    // The address stays visible: the name replaces it in the sidebar, so this
    // is where the user can still see which account they are editing.
    expect(screen.getAllByText("me@example.com").length).toBeGreaterThan(0);
  });

  it("saves what was typed and confirms it", async () => {
    render(<SettingsScreen />);
    openProfile();
    await waitFor(() =>
      expect((screen.getByLabelText(FIELD) as HTMLInputElement).value).toBe(
        "Kodai",
      ),
    );

    fireEvent.change(screen.getByLabelText(FIELD), {
      target: { value: "こうだい" },
    });
    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText("settings.profile.done")).toBeTruthy();
    expect(state.updateDisplayName).toHaveBeenCalledWith("こうだい");
  });

  it("reports a refused save with the catalog message", async () => {
    state.updateDisplayName.mockResolvedValue({ error: "boom" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<SettingsScreen />);
    openProfile();

    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      await screen.findByText("settings.profile.errors.generic"),
    ).toBeTruthy();
    expect(screen.queryByText("settings.profile.done")).toBeNull();
    spy.mockRestore();
  });

  it("does not submit on the Enter that confirms an IME conversion", async () => {
    render(<SettingsScreen />);
    openProfile();

    const field = screen.getByLabelText(FIELD);
    // keyCode 229 is how WebKit reports the confirming Enter (#737). The
    // default action of that keydown is the form's implicit submission, so a
    // cancelled event is what keeps the half-converted text from being saved.
    const allowed = fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });

    expect(allowed).toBe(false);
    expect(state.updateDisplayName).not.toHaveBeenCalled();
  });

  it("opens on Profile when the shell asks, and consumes the ask", () => {
    const onConsumeProfile = vi.fn();
    render(
      <SettingsScreen pendingProfile onConsumeProfile={onConsumeProfile} />,
    );

    expect(screen.getByLabelText(FIELD)).toBeTruthy();
    // Reset lives on General only — its absence is the "body switched" probe.
    expect(
      screen.queryByRole("button", { name: "settings.reset.button" }),
    ).toBeNull();
    expect(onConsumeProfile).toHaveBeenCalledTimes(1);
  });
});
