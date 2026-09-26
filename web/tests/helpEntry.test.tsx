import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { SettingsScreen } from "../src/settings/SettingsScreen";
import { AuthScreen } from "../src/AuthScreen";
import { OPERATOR, operatorContactLinks } from "../src/legal/operator";

/*
 * #1989 — help, FAQ and contact, reachable in two presses from Settings and
 * from the sign-in screen, with every contact link read from operator.ts.
 *
 * `useTranslation` echoes its key, so the assertions read as key names. No
 * jest-dom in web/ — presence comes from getBy* throwing, absence from
 * queryBy* being null.
 */

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  restart: vi.fn(),
  startSection: vi.fn(),
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
    useTourContext: () => ({
      restart: state.restart,
      startSection: state.startSection,
    }),
    getSession: state.getSession,
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

beforeEach(() => {
  state.getSession.mockReset();
  state.getSession.mockResolvedValue({ user: { email: "me@example.com" } });
});

const FAQ_KEYS = [
  "help.faq.confirmEmail.question",
  "help.faq.password.question",
  "help.faq.export.question",
  "help.faq.deleteAccount.question",
];

function githubLink(dialog: HTMLElement): HTMLAnchorElement {
  const link = dialog.querySelector<HTMLAnchorElement>(
    'a[data-contact-id="github"]',
  );
  if (!link) throw new Error("no GitHub contact link");
  return link;
}

async function renderSettings() {
  // getDataService() throws without credentials, which Settings logs.
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<SettingsScreen />);
  await waitFor(() => expect(state.getSession).toHaveBeenCalled());
  error.mockRestore();
}

describe("Help from Settings (#1989)", () => {
  it("opens the help dialog in one press and reaches the contact in the second", async () => {
    await renderSettings();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.help.button" }),
    );

    const dialog = screen.getByRole("dialog", { name: "help.title" });
    for (const key of FAQ_KEYS) {
      expect(within(dialog).getByText(key)).toBeTruthy();
    }
    const link = githubLink(dialog);
    expect(link.getAttribute("href")).toBe(OPERATOR.contactUrl);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("hands over to the tutorial launcher from the How to use section", async () => {
    await renderSettings();

    fireEvent.click(
      screen.getByRole("button", { name: "settings.help.button" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "help.title" })).getByRole(
        "button",
        { name: "help.tutorial.button" },
      ),
    );

    expect(screen.queryByRole("dialog", { name: "help.title" })).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "tour.launcher.title" }),
    ).toBeTruthy();
  });
});

describe("Help from the sign-in screen (#1989)", () => {
  it("offers a Need help line that opens the same FAQ and contact", () => {
    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "auth.help.link" }));

    const dialog = screen.getByRole("dialog", { name: "help.title" });
    for (const key of FAQ_KEYS) {
      expect(within(dialog).getByText(key)).toBeTruthy();
    }
    expect(githubLink(dialog).getAttribute("href")).toBe(OPERATOR.contactUrl);
    // No app behind this screen yet, so no tour to offer.
    expect(
      within(dialog).queryByRole("button", { name: "help.tutorial.button" }),
    ).toBeNull();
  });

  it("keeps the line on the recovery card too, where a stuck user also lands", () => {
    render(<AuthScreen recovery />);
    expect(screen.getByRole("button", { name: "auth.help.link" })).toBeTruthy();
  });
});

describe("operatorContactLinks (#1989)", () => {
  it("offers GitHub Issues alone while the direct contact is unset", () => {
    expect(OPERATOR.directContact).toBeNull();
    expect(operatorContactLinks()).toEqual([
      { id: "github", kind: "github", href: OPERATOR.contactUrl },
    ]);
  });

  it("puts a chosen email first, as a mailto link", () => {
    expect(
      operatorContactLinks({
        contactUrl: OPERATOR.contactUrl,
        directContact: { kind: "email", value: "help@example.com" },
      }),
    ).toEqual([
      { id: "direct", kind: "email", href: "mailto:help@example.com" },
      { id: "github", kind: "github", href: OPERATOR.contactUrl },
    ]);
  });

  it("uses a chosen form URL as it is", () => {
    const [first] = operatorContactLinks({
      contactUrl: OPERATOR.contactUrl,
      directContact: { kind: "form", value: "https://forms.example.com/x" },
    });
    expect(first).toEqual({
      id: "direct",
      kind: "form",
      href: "https://forms.example.com/x",
    });
  });
});
