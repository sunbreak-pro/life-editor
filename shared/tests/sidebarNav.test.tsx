import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SidebarNav, type SidebarNavSection } from "../src/components";

/*
 * Target-IA wide sidebar. The mainline sections render as primary rows; the
 * optional utility group (Settings / Trash) is pushed to the bottom behind a
 * divider and rendered muted (text-tertiary at rest). Pure presentation — no
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
  commandPalette: "Command palette",
  signOut: "Sign out",
  shortcutHint: "⌘K",
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
      onTogglePalette={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={LABELS}
      {...props}
    />,
  );
  return { onNavigate };
}

describe("SidebarNav utility group", () => {
  it("renders a divider separating the mainline from the utility group", () => {
    renderSidebar();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("renders utility rows muted (text-tertiary) while mainline rows are not", () => {
    renderSidebar();
    const trash = screen.getByRole("button", { name: "Trash" });
    expect(trash.className).toContain("text-lumen-text-tertiary");
    const schedule = screen.getByRole("button", { name: "Schedule" });
    expect(schedule.className).not.toContain("text-lumen-text-tertiary");
  });

  it("does not render a divider when there is no utility group", () => {
    renderSidebar({ utilitySections: undefined });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Schedule" }),
    ).toBeInTheDocument();
  });

  it("shows the ⌘K keycap hint on the command-palette footer row", () => {
    renderSidebar();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });
});

/*
 * #409 — the global tag editor entry. Placement is the requirement, not just
 * presence: the user picked "directly above the command palette" so the tag
 * master sits in the same column as the section list rather than among the
 * header's per-screen controls.
 */
describe("SidebarNav tag editor entry (#409)", () => {
  const TAG_LABELS = { ...LABELS, tagEditor: "Edit tags" };

  it("renders the row immediately above the command palette row", () => {
    renderSidebar({ labels: TAG_LABELS, onOpenTagEditor: vi.fn() });
    const tagEditor = screen.getByRole("button", { name: "Edit tags" });
    const palette = screen.getByRole("button", { name: "Command palette" });

    expect(tagEditor.parentElement).toBe(palette.parentElement);
    expect(tagEditor.nextElementSibling).toBe(palette);
  });

  it("calls onOpenTagEditor when pressed", () => {
    const onOpenTagEditor = vi.fn();
    renderSidebar({ labels: TAG_LABELS, onOpenTagEditor });
    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    expect(onOpenTagEditor).toHaveBeenCalledOnce();
  });

  it("keeps its label visible when expanded and drops to icon-only when collapsed", () => {
    renderSidebar({ labels: TAG_LABELS, onOpenTagEditor: vi.fn() });
    expect(screen.getByText("Edit tags")).toBeInTheDocument();

    cleanup();
    renderSidebar({
      labels: TAG_LABELS,
      onOpenTagEditor: vi.fn(),
      collapsed: true,
    });
    // Icon-only: the accessible name survives via aria-label, the text does not.
    expect(screen.queryByText("Edit tags")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit tags" }),
    ).toBeInTheDocument();
  });

  it("omits the row when no handler is supplied", () => {
    renderSidebar({ labels: TAG_LABELS });
    expect(
      screen.queryByRole("button", { name: "Edit tags" }),
    ).not.toBeInTheDocument();
  });

  it("omits the row when the label is missing (copy is host-injected)", () => {
    renderSidebar({ onOpenTagEditor: vi.fn() });
    expect(
      screen.queryByRole("button", { name: "Edit tags" }),
    ).not.toBeInTheDocument();
  });
});
