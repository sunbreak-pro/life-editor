import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SidebarNav, type SidebarNavSection } from "../src/components";

/*
 * Target-IA wide sidebar. The mainline sections render as primary rows; the
 * optional utility group (Settings / Trash) is pushed to the bottom behind a
 * divider, in the same text token as the footer rows (#1623). Pure presentation — no
 * matchMedia needed (SidebarNav is layout-agnostic; AppShell owns the switch).
 */

const Dot = () => <span data-testid="icon">•</span>;

const SECTIONS: SidebarNavSection[] = [
  { id: "schedule", label: "Schedule", icon: <Dot /> },
  { id: "materials", label: "Materials", icon: <Dot /> },
  { id: "connect", label: "Connect", icon: <Dot /> },
];

const UTILITY: SidebarNavSection[] = [
  { id: "settings", label: "Settings", icon: <Dot /> },
  { id: "trash", label: "Trash", icon: <Dot /> },
];

const LABELS = {
  appName: "Life Editor",
  collapse: "Collapse sidebar",
  expand: "Expand sidebar",
  signOut: "Sign out",
};

function renderSidebar(props?: Partial<Parameters<typeof SidebarNav>[0]>) {
  const onNavigate = vi.fn();
  render(
    <SidebarNav
      sections={SECTIONS}
      utilitySections={UTILITY}
      activeSection="materials"
      onNavigate={onNavigate}
      collapsed={false}
      onToggleCollapsed={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={LABELS}
      {...props}
    />,
  );
  return { onNavigate };
}

describe("SidebarNav Claude launcher row (#1211)", () => {
  it("stays out of the sidebar without a handler", () => {
    // Withholding the handler is how the browser and the Capacitor shells opt
    // out — there is no CLI on those devices to launch.
    renderSidebar({ labels: { ...LABELS, launchClaude: "Start Claude Code" } });
    expect(
      screen.queryByRole("button", { name: "Start Claude Code" }),
    ).not.toBeInTheDocument();
  });

  it("stays out without a label too, rather than rendering untranslated", () => {
    renderSidebar({ onLaunchClaude: vi.fn() });
    expect(
      screen.getAllByRole("button").map((b) => b.textContent),
    ).not.toContain("launchClaude");
  });

  it("launches on click when both halves are passed", () => {
    const onLaunchClaude = vi.fn();
    renderSidebar({
      onLaunchClaude,
      labels: { ...LABELS, launchClaude: "Start Claude Code" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start Claude Code" }));
    expect(onLaunchClaude).toHaveBeenCalledTimes(1);
  });

  it("keeps its label reachable on the collapsed rail", () => {
    // Icon-only rail: the accessible name has to survive the text being gone.
    renderSidebar({
      collapsed: true,
      onLaunchClaude: vi.fn(),
      labels: { ...LABELS, launchClaude: "Start Claude Code" },
    });
    expect(
      screen.getByRole("button", { name: "Start Claude Code" }),
    ).toBeInTheDocument();
  });
});

describe("SidebarNav account row (#1624)", () => {
  const WITH_PROFILE = { ...LABELS, profile: "Edit profile" };

  it("shows the display name instead of the address when one is set", () => {
    renderSidebar({ userName: "Kodai" });
    expect(screen.getByText("Kodai")).toBeInTheDocument();
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });

  it("falls back to the address when the name is empty", () => {
    renderSidebar({ userName: "" });
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("opens the profile on click when both halves are passed", () => {
    const onOpenProfile = vi.fn();
    renderSidebar({ userName: "Kodai", onOpenProfile, labels: WITH_PROFILE });
    const row = screen.getByRole("button", { name: /Kodai.*Edit profile/ });
    // The address is what the name replaced, so it stays reachable on hover.
    expect(row).toHaveAttribute("title", "user@example.com");
    fireEvent.click(row);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it("stays plain text without a handler", () => {
    renderSidebar({ userName: "Kodai", labels: WITH_PROFILE });
    expect(
      screen.queryByRole("button", { name: /Edit profile/ }),
    ).not.toBeInTheDocument();
  });
});

describe("SidebarNav utility group", () => {
  it("renders a divider separating the mainline from the utility group", () => {
    renderSidebar();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("draws the utility rows with the footer rows' text token, not a dimmer one (#1623)", () => {
    // Settings was the only row a step darker (text-tertiary) than the
    // footer rows directly under it, which read as disabled in dark mode.
    // Same token as the Claude footer row is the contract.
    renderSidebar({
      activeSection: "schedule",
      onLaunchClaude: vi.fn(),
      labels: { ...LABELS, launchClaude: "Start Claude Code" },
    });
    const settings = screen.getByRole("button", { name: "Settings" });
    const claude = screen.getByRole("button", { name: "Start Claude Code" });
    expect(claude.className).toContain("text-lumen-text-secondary");
    expect(settings.className).toContain("text-lumen-text-secondary");
    expect(settings.className).not.toContain("text-lumen-text-tertiary");
  });

  it("does not render a divider when there is no utility group", () => {
    renderSidebar({ utilitySections: undefined });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Schedule" }),
    ).toBeInTheDocument();
  });
});

/*
 * #2216 — the command palette has no sidebar row any more, expanded or
 * collapsed. It still opens from the header's search field and Cmd/Ctrl+K;
 * those routes are fenced where they live (commandSearchField.test.tsx /
 * useGlobalShortcuts.test.ts), not here.
 */
describe("SidebarNav without a command palette row (#2216)", () => {
  it.each([false, true])("draws no palette row (collapsed=%s)", (collapsed) => {
    renderSidebar({ collapsed });
    expect(
      screen.queryByRole("button", { name: /command palette/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
    expect(screen.queryByText("Ctrl K")).not.toBeInTheDocument();
  });
});

/*
 * #550 — the optional per-section sublabel line (the Work row's live timer).
 * The line renders under the label inside the same nav row, truncated so a
 * long todo title cannot widen the sidebar, and disappears entirely in the
 * collapsed (icon-only) rail.
 */
describe("SidebarNav section sublabel (#550)", () => {
  const WITH_SUBLABEL: SidebarNavSection[] = [
    ...SECTIONS,
    { id: "work", label: "Work", icon: <Dot />, sublabel: "24:31 · My todo" },
  ];

  it("renders the sublabel line inside the section's row", () => {
    renderSidebar({ sections: WITH_SUBLABEL });
    const status = screen.getByText("24:31 · My todo");
    const row = screen.getByRole("button", { name: "Work" });
    expect(row).toContainElement(status);
  });

  it("leaves sections without a sublabel unchanged", () => {
    renderSidebar({ sections: WITH_SUBLABEL });
    const schedule = screen.getByRole("button", { name: "Schedule" });
    expect(schedule.textContent).toBe("•Schedule");
  });

  it("hides the sublabel in the collapsed icon-only rail", () => {
    renderSidebar({ sections: WITH_SUBLABEL, collapsed: true });
    expect(screen.queryByText("24:31 · My todo")).not.toBeInTheDocument();
  });
});

/*
 * #2278 — the Settings row left the sidebar: the host stops passing the
 * utility group, and the account button (name + gear) is the way in. The
 * collapsed rail keeps the gear alone, above sign-out. Sign-out asks first in
 * a small panel beside the button; only its own Sign out signs out.
 */
describe("SidebarNav account button as the Settings entry (#2278)", () => {
  const WITH_PROFILE = { ...LABELS, profile: "Edit profile" };

  it("carries the gear inside the account button and opens Settings from it", () => {
    const onOpenProfile = vi.fn();
    renderSidebar({
      utilitySections: undefined,
      userName: "Kodai",
      onOpenProfile,
      labels: WITH_PROFILE,
    });
    expect(
      screen.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();
    const account = screen.getByRole("button", { name: /Kodai.*Edit profile/ });
    // One press target: the gear is inside the button, not a sibling of it.
    expect(account.querySelector("svg")).not.toBeNull();
    fireEvent.click(account);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it("lights the account button only while Settings is open", () => {
    renderSidebar({
      userName: "Kodai",
      onOpenProfile: vi.fn(),
      labels: WITH_PROFILE,
      accountActive: true,
    });
    const account = screen.getByRole("button", { name: /Kodai.*Edit profile/ });
    expect(account).toHaveAttribute("aria-current", "page");
    expect(account.className).toContain("bg-lumen-accent-subtle");
  });

  it("stays unlit by default", () => {
    renderSidebar({
      userName: "Kodai",
      onOpenProfile: vi.fn(),
      labels: WITH_PROFILE,
    });
    const account = screen.getByRole("button", { name: /Kodai.*Edit profile/ });
    expect(account).not.toHaveAttribute("aria-current");
    expect(account.className).not.toContain("bg-lumen-accent-subtle");
  });

  it("puts the gear above sign-out on the collapsed rail", () => {
    const onOpenProfile = vi.fn();
    renderSidebar({
      collapsed: true,
      onOpenProfile,
      labels: WITH_PROFILE,
    });
    const gear = screen.getByRole("button", { name: "Edit profile" });
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(
      gear.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(gear);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});

describe("SidebarNav sign-out confirm (#2278)", () => {
  const WITH_CONFIRM = {
    ...LABELS,
    signOutPrompt: "Sign out?",
    cancel: "Cancel",
  };

  function openConfirm(collapsed = false) {
    const onSignOut = vi.fn();
    renderSidebar({ collapsed, onSignOut, labels: WITH_CONFIRM });
    const trigger = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Sign out?" });
    return { onSignOut, trigger, dialog };
  }

  it("opens the panel on the first press instead of signing out", () => {
    const { onSignOut, trigger, dialog } = openConfirm();
    expect(onSignOut).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Cancel takes the focus, so a stray Enter backs out.
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
  });

  it("signs out only from the panel's own Sign out", () => {
    const { onSignOut, dialog } = openConfirm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks on the collapsed rail too", () => {
    const { onSignOut, dialog } = openConfirm(true);
    expect(onSignOut).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("closes on Cancel without signing out and hands the focus back", () => {
    const { onSignOut, trigger, dialog } = openConfirm();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("closes on Esc without signing out", () => {
    const { onSignOut } = openConfirm();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("closes on a pointerdown outside without signing out", () => {
    const { onSignOut } = openConfirm();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Schedule" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it("closes again from the trigger instead of reopening", () => {
    const { trigger } = openConfirm();
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("signs out at once when the host passes no confirm copy", () => {
    const onSignOut = vi.fn();
    renderSidebar({ onSignOut });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
