import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dot } from "lucide-react";
import { AppShell, BottomTabActionRow } from "../src/components";

/*
 * #472 — app-global actions in the narrow bottom bar's "More" sheet.
 *
 * The narrow layout renders no `header` slot (that is a wide-branch-only
 * concern), so controls acting on the current screen regardless of section —
 * undo/redo first — had nowhere reachable to live. The sheet is the only chrome
 * every narrow section shares.
 *
 * Covered: the rows land in the sheet under their own accessible group, actions
 * alone surface the More tab (a host with few sections still reaches them), a
 * repeatable row leaves the sheet open while a row may ask to close it, and the
 * WIDE layout stays untouched — the hard requirement of #472.
 */

const SECTIONS = [
  { id: "tasks", label: "Tasks", icon: <Dot /> },
  { id: "daily", label: "Daily", icon: <Dot /> },
  { id: "notes", label: "Notes", icon: <Dot /> },
  { id: "schedule", label: "Schedule", icon: <Dot /> },
  { id: "settings", label: "Settings", icon: <Dot /> },
];

const LABELS = {
  appName: "Life Editor",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  commandPalette: "Command palette",
  signOut: "Sign out",
  more: "More",
  moreTitle: "More",
  bottomBarActionsTitle: "Quick actions",
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
  const onUndo = vi.fn();
  const onJump = vi.fn();
  render(
    <AppShell
      sections={SECTIONS}
      activeSection="tasks"
      onNavigate={vi.fn()}
      onTogglePalette={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={LABELS}
      bottomBarActions={(closeSheet) => (
        <>
          <BottomTabActionRow label="Undo" icon={<Dot />} onSelect={onUndo} />
          <BottomTabActionRow
            label="Jump away"
            icon={<Dot />}
            onSelect={() => {
              onJump();
              closeSheet();
            }}
          />
        </>
      )}
      {...props}
    >
      <p>section body</p>
    </AppShell>,
  );
  return { onUndo, onJump };
}

const openSheet = () =>
  fireEvent.click(screen.getByRole("button", { name: "More" }));

afterEach(() => {
  // @ts-expect-error — clear the stub between tests.
  delete window.matchMedia;
  localStorage.clear();
});

describe("bottom bar actions (#472, narrow)", () => {
  it("lists the actions inside the More sheet, above the overflow sections", () => {
    mockMatchMedia(false);
    renderShell();
    // Closed sheet: the rows are not reachable yet.
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();

    openSheet();
    const group = screen.getByRole("list", { name: "Quick actions" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    // The overflow section rows still render, in their own list.
    expect(
      screen.getByRole("button", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("fires the row's handler", () => {
    mockMatchMedia(false);
    const { onUndo } = renderShell();
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheet open for a repeatable row, so undo can repeat", () => {
    mockMatchMedia(false);
    renderShell();
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    // Still there — a second undo is one tap, not a reopen.
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("closes the sheet when a row asks for it", () => {
    mockMatchMedia(false);
    const { onJump } = renderShell();
    openSheet();
    fireEvent.click(screen.getByRole("button", { name: "Jump away" }));
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("surfaces the More tab for actions even without overflow sections", () => {
    mockMatchMedia(false);
    // Three sections < the 4 fixed tabs, so nothing overflows.
    renderShell({ sections: SECTIONS.slice(0, 3) });
    openSheet();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    // No section rows to show alongside them.
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("disables a row when the host says so", () => {
    mockMatchMedia(false);
    render(
      <AppShell
        sections={SECTIONS}
        activeSection="tasks"
        onNavigate={vi.fn()}
        onTogglePalette={vi.fn()}
        userEmail="user@example.com"
        onSignOut={vi.fn()}
        labels={LABELS}
        bottomBarActions={() => (
          <BottomTabActionRow
            label="Undo"
            icon={<Dot />}
            onSelect={vi.fn()}
            disabled
          />
        )}
      >
        <p>section body</p>
      </AppShell>,
    );
    openSheet();
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("omits the More tab entirely when a host passes no actions", () => {
    mockMatchMedia(false);
    renderShell({
      sections: SECTIONS.slice(0, 3),
      bottomBarActions: undefined,
    });
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  });
});

describe("bottom bar actions (#472, wide is untouched)", () => {
  it("renders no actions and no More tab on the wide layout", () => {
    mockMatchMedia(true);
    renderShell();
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Quick actions" })).toBeNull();
  });
});
