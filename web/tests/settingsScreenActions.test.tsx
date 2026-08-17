import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Mock } from "vitest";
import { SettingsScreen } from "../src/settings/SettingsScreen";

/*
 * #1012 — the Settings screen, driven through its controls' ARGUMENTS.
 *
 * Settings is the screen where the host wiring is the WHOLE of the screen: it
 * owns no data of its own, and every card is a pure primitive fed a value and a
 * setter (CLAUDE.md §6.4). Which means the failure mode here is a crossed wire
 * — the font-family segment handed `setReduceMotion`, the day-start select
 * handed the raw string from the <option> instead of a number — and it is
 * invisible to the primitives' own suites, which are handed `vi.fn()` and
 * cannot know which of the screen's eight setters they were given.
 *
 * Two suites already cover the two cards that reach a service: settingsScreen
 * (the reset confirm) and settingsAccountCard (the password). What is left, and
 * what this pins, is the routing table for the other four cards: for each
 * control, the setter it reaches, the VALUE that arrives there, and that no
 * sibling setter fired at all.
 *
 * No jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  setThemeMode: vi.fn(),
  setFontSize: vi.fn(),
  setFontFamily: vi.fn(),
  setReduceMotion: vi.fn(),
  setLanguage: vi.fn(),
  setStartupPref: vi.fn(),
  setDayStartHour: vi.fn(),
  resetLocalPreferences: vi.fn(),
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
      // 3 of 10, so an arrow key in either direction has somewhere to go.
      fontSize: 3,
      fontFamily: "system",
      reduceMotion: "system",
      language: "en",
      toggleTheme: vi.fn(),
      setTheme: vi.fn(),
      setThemeMode: state.setThemeMode,
      setFontSize: state.setFontSize,
      setFontFamily: state.setFontFamily,
      setReduceMotion: state.setReduceMotion,
      setLanguage: state.setLanguage,
    }),
    // Null is the honest value on the native mobile shells, where the Provider
    // is skipped (#320) — and it keeps the shortcut table out of these renders.
    useShortcutConfig: () => null,
    useStartupSectionPref: () => ({
      pref: "last",
      setPref: state.setStartupPref,
    }),
    useDayStartHourPref: () => ({
      dayStartHour: 4,
      setDayStartHour: state.setDayStartHour,
    }),
    resetLocalPreferences: state.resetLocalPreferences,
    getSession: state.getSession,
    updatePassword: state.updatePassword,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

/** Every sink a control on this screen can reach — the "no sibling" pool. */
const SINKS = [
  "setThemeMode",
  "setFontSize",
  "setFontFamily",
  "setReduceMotion",
  "setLanguage",
  "setStartupPref",
  "setDayStartHour",
  "resetLocalPreferences",
  "updatePassword",
] as const;

const sink = (name: (typeof SINKS)[number]): Mock => state[name];

/** Asserts exactly one sink fired, with exactly these arguments. */
function expectOnlySink(name: (typeof SINKS)[number], args: unknown[]) {
  expect(sink(name).mock.calls).toEqual([args]);
  for (const other of SINKS) {
    if (other === name) continue;
    expect(sink(other)).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

describe("SettingsScreen — the appearance card", () => {
  it("theme card → setThemeMode(mode of the card pressed)", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("radio", { name: "settings.dark" }));

    // The three cards look alike and differ only by the value they carry; a
    // copy-paste slip between them is silent on screen (#887 already caught
    // one on the styling side).
    expectOnlySink("setThemeMode", ["dark"]);
  });

  it("follow-the-OS is its own value, not the resolved light/dark", () => {
    render(<SettingsScreen />);

    fireEvent.click(
      screen.getByRole("radio", { name: "settings.themeSystem" }),
    );

    expectOnlySink("setThemeMode", ["system"]);
  });

  it("font-size slider → setFontSize(one step from where it was)", () => {
    render(<SettingsScreen />);

    // Keyboard, not a click: jsdom has no layout, so the click-to-seek path
    // reads a zero-width track (CLAUDE.md §7.1).
    fireEvent.keyDown(
      screen.getByRole("slider", { name: "settings.fontSize" }),
      {
        key: "ArrowRight",
      },
    );

    expectOnlySink("setFontSize", [4]);
  });

  it("font-family segment → setFontFamily(the segment pressed)", () => {
    render(<SettingsScreen />);

    fireEvent.click(
      screen.getByRole("radio", { name: "settings.fontFamilySerif" }),
    );

    expectOnlySink("setFontFamily", ["serif"]);
  });

  it("reduce-motion segment → setReduceMotion(the segment pressed)", () => {
    render(<SettingsScreen />);

    fireEvent.click(
      screen.getByRole("radio", { name: "settings.reduceMotionReduce" }),
    );

    // The neighbouring segment on the same card takes the same three-option
    // shape, so this is the pair most likely to end up crossed.
    expectOnlySink("setReduceMotion", ["reduce"]);
  });
});

describe("SettingsScreen — the preference selects", () => {
  it("startup select → setStartupPref(the option's own id)", () => {
    render(<SettingsScreen />);
    const select = screen.getByLabelText(
      "settings.startup.sectionLabel",
    ) as HTMLSelectElement;
    // The options are built from MAIN_SECTIONS, so the value is read off the
    // list rather than restated here — the section ids are the registry's.
    const option = Array.from(select.options).find((o) => o.value !== "last");
    if (!option) throw new Error("no section option to pick");

    fireEvent.change(select, { target: { value: option.value } });

    expectOnlySink("setStartupPref", [option.value]);
  });

  it("day-start select → setDayStartHour(a NUMBER, not the option string)", () => {
    render(<SettingsScreen />);

    fireEvent.change(screen.getByLabelText("settings.dayStart.hourLabel"), {
      target: { value: "6" },
    });

    // The hour is compared numerically downstream (#218 rollover), and a "6"
    // would keep working right up until it is compared against a number.
    expectOnlySink("setDayStartHour", [6]);
    expect(typeof sink("setDayStartHour").mock.calls[0][0]).toBe("number");
  });

  it("language card → setLanguage(the code of the card pressed)", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getByRole("radio", { name: "settings.japanese" }));

    expectOnlySink("setLanguage", ["ja"]);
  });
});

describe("SettingsScreen — what changes nothing", () => {
  it("rendering the screen sets no preference at all", async () => {
    render(<SettingsScreen />);
    // The address read is the one thing that happens on mount; wait it out so
    // a late setter would still be caught below.
    await screen.findByText("me@example.com");

    for (const name of SINKS) {
      expect(sink(name)).not.toHaveBeenCalled();
    }
  });

  it("the reset card asks before it touches any preference", async () => {
    render(<SettingsScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings.reset.button" }),
    );
    await screen.findByRole("dialog", { name: "settings.reset.confirm" });

    // The destructive card is the one that must not act on the press itself —
    // the clearing half is pinned in settingsScreen.test.tsx (#781); what
    // belongs here is that opening the question moves nothing.
    for (const name of SINKS) {
      expect(sink(name)).not.toHaveBeenCalled();
    }

    fireEvent.click(
      screen.getByRole("button", { name: "settings.reset.confirmButton" }),
    );
    await waitFor(() =>
      expect(state.resetLocalPreferences).toHaveBeenCalledTimes(1),
    );
    // Clearing the namespace is not the same as writing every preference back.
    expect(state.setThemeMode).not.toHaveBeenCalled();
    expect(state.setDayStartHour).not.toHaveBeenCalled();
  });
});
