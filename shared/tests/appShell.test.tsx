import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AppShell, type AppShellSection } from "../src/components";

/*
 * W5 app shell — responsive single shell. The wide↔narrow switch is driven
 * by useMediaQuery; we mock matchMedia to pin each layout deterministically
 * (jsdom otherwise has no matchMedia → the hook's wide fallback).
 */

const Dot = () => <span data-testid="icon">•</span>;

const SECTIONS: AppShellSection[] = [
  { id: "tasks", label: "Tasks", icon: <Dot /> },
  { id: "daily", label: "Daily", icon: <Dot /> },
  { id: "notes", label: "Notes", icon: <Dot /> },
  { id: "schedule", label: "Schedule", icon: <Dot /> },
  { id: "settings", label: "Settings", icon: <Dot /> },
  { id: "trash", label: "Trash", icon: <Dot /> },
];

const LABELS = {
  appName: "Life Editor",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  commandPalette: "Command palette",
  signOut: "Sign out",
  more: "More",
  moreTitle: "More",
};

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function renderShell(props?: Partial<Parameters<typeof AppShell>[0]>) {
  const onNavigate = vi.fn();
  const onTogglePalette = vi.fn();
  const onSignOut = vi.fn();
  render(
    <AppShell
      sections={SECTIONS}
      activeSection="tasks"
      onNavigate={onNavigate}
      onTogglePalette={onTogglePalette}
      userEmail="user@example.com"
      onSignOut={onSignOut}
      labels={LABELS}
      {...props}
    >
      <p>section body</p>
    </AppShell>,
  );
  return { onNavigate, onTogglePalette, onSignOut };
}

afterEach(() => {
  // @ts-expect-error — clear the stub between tests.
  delete window.matchMedia;
  localStorage.clear();
});

describe("AppShell (wide)", () => {
  it("renders the sidebar with sections, children and footer chrome", () => {
    mockMatchMedia(true);
    const { onNavigate, onTogglePalette, onSignOut } = renderShell();

    expect(screen.getByText("section body")).toBeInTheDocument();
    // section nav items are buttons with aria-label = section label
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(onNavigate).toHaveBeenCalledWith("schedule");

    fireEvent.click(screen.getByRole("button", { name: "Command palette" }));
    expect(onTogglePalette).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("collapses and expands the sidebar", () => {
    mockMatchMedia(true);
    renderShell();
    // starts expanded → a collapse control is shown
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    // now an expand control is shown
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });
});

describe("AppShell (narrow)", () => {
  it("renders bottom tabs and a More sheet for overflow sections", () => {
    mockMatchMedia(false);
    const { onNavigate } = renderShell();

    expect(screen.getByText("section body")).toBeInTheDocument();
    // first 4 sections are fixed tabs; settings/trash overflow into More
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toBeInTheDocument();

    fireEvent.click(more);
    const sheet = screen.getByRole("dialog", { name: "More" });
    fireEvent.click(within(sheet).getByRole("button", { name: /Trash/ }));
    expect(onNavigate).toHaveBeenCalledWith("trash");
  });

  it("honours an explicit mobileSections order for the fixed tabs vs More overflow", () => {
    mockMatchMedia(false);
    // Wide sidebar order = mainline 5 + utility 2; Mobile promotes Work /
    // Analytics ahead of Connect (target-IA: fixed 4 = schedule/materials/
    // work/analytics, More = connect/settings/trash).
    const MAIN: AppShellSection[] = [
      { id: "schedule", label: "Schedule", icon: <Dot /> },
      { id: "materials", label: "Materials", icon: <Dot /> },
      { id: "connect", label: "Connect", icon: <Dot /> },
      { id: "work", label: "Work", icon: <Dot /> },
      { id: "analytics", label: "Analytics", icon: <Dot /> },
    ];
    const UTILITY: AppShellSection[] = [
      { id: "settings", label: "Settings", icon: <Dot /> },
      { id: "trash", label: "Trash", icon: <Dot /> },
    ];
    const MOBILE: AppShellSection[] = [
      MAIN[0], // schedule
      MAIN[1], // materials
      MAIN[3], // work
      MAIN[4], // analytics
      MAIN[2], // connect
      UTILITY[0], // settings
      UTILITY[1], // trash
    ];
    const onNavigate = vi.fn();
    render(
      <AppShell
        sections={MAIN}
        utilitySections={UTILITY}
        mobileSections={MOBILE}
        activeSection="schedule"
        onNavigate={onNavigate}
        onTogglePalette={vi.fn()}
        userEmail="user@example.com"
        onSignOut={vi.fn()}
        labels={LABELS}
      >
        <p>section body</p>
      </AppShell>,
    );

    // Fixed tabs = first 4 of mobileSections → Work is a top-level tab...
    expect(
      screen.getByRole("button", { name: "Analytics" }),
    ).toBeInTheDocument();
    // ...and Connect sank into More (not a fixed tab).
    expect(
      screen.queryByRole("button", { name: "Connect" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Connect" }));
    expect(onNavigate).toHaveBeenCalledWith("connect");
  });
});
