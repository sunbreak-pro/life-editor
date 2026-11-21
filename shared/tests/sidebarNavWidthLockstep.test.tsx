import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "../src/components";
import { SIDEBAR_NAV_WIDTH_REM } from "../src/components/SidebarNav";

/*
 * #2544 — AppShell decides whether to fold the nav from SIDEBAR_NAV_WIDTH_REM,
 * while the browser draws the width from the Tailwind class. The class cannot
 * read the constant, so this pins the two together: Tailwind's `w-N` is
 * N × 0.25rem.
 */

function renderNav(collapsed: boolean): HTMLElement {
  render(
    <SidebarNav
      sections={[]}
      activeSection=""
      onNavigate={vi.fn()}
      collapsed={collapsed}
      onToggleCollapsed={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={{
        appName: "Life Editor",
        collapse: "Collapse sidebar",
        expand: "Expand sidebar",
        signOut: "Sign out",
      }}
    />,
  );
  return screen.getByRole("complementary", { name: "Life Editor" });
}

describe("SidebarNav widths match SIDEBAR_NAV_WIDTH_REM (#2544)", () => {
  it.each([
    [false, SIDEBAR_NAV_WIDTH_REM.expanded],
    [true, SIDEBAR_NAV_WIDTH_REM.collapsed],
  ])("collapsed=%s draws a %srem-wide class", (collapsed, rem) => {
    expect(renderNav(collapsed)).toHaveClass(`w-${rem * 4}`);
  });
});
