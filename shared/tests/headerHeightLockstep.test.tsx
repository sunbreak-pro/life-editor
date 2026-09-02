import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SidebarNav, SectionHeader } from "../src/components";

/*
 * #1399 — the two top chrome rows must be the same height.
 *
 * On the wide layout AppShell puts <SidebarNav> and the content column side by
 * side, and each opens its own row at the same y: the sidebar's brand header,
 * and <SectionHeader> in the column's `header` slot. They live in different
 * components with no shared parent sizing them, so nothing but a shared number
 * makes them agree — and they did not. The sidebar was pinned at `h-12` (48px)
 * against the section header's `min-h-14 md:min-h-15` (56/60px), which left the
 * brand mark 6px above the section title and drew the two bottom borders as a
 * 12px step across the top of the app.
 *
 * Both rows now read --spacing-lumen-header / -wide. What this suite can check
 * is the class arrangement that decides the height, not the height: jsdom
 * loads no stylesheet and has no layout engine, so every box measures 0 here
 * and no assertion can see the step itself. The regression being guarded — one
 * of the two rows re-inlining a literal — breaks neither the build nor any
 * render, which is exactly why it needs a test that reads classes.
 *
 * Assertions run against the RENDERED row (the aside's / container's first
 * child) rather than the file text, so an unrelated `h-12` elsewhere in either
 * component neither trips this suite nor hides a real drift in it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(
  resolve(here, "../src/styles/tokens.css"),
  "utf8",
).replace(/\r\n/g, "\n");

/** Utility classes on `el`, each stripped of its responsive prefix. */
const utilities = (el: Element): string[] =>
  el.className.split(" ").map((c) => c.slice(c.lastIndexOf(":") + 1));

function renderSidebarHeader(): Element {
  const { container } = render(
    <SidebarNav
      sections={[{ id: "schedule", label: "Schedule", icon: <span /> }]}
      activeSection="schedule"
      onNavigate={vi.fn()}
      collapsed={false}
      onToggleCollapsed={vi.fn()}
      onTogglePalette={vi.fn()}
      userEmail="user@example.com"
      onSignOut={vi.fn()}
      labels={{
        appName: "Life Editor",
        collapse: "Collapse sidebar",
        expand: "Expand sidebar",
        commandPalette: "Command palette",
        signOut: "Sign out",
      }}
    />,
  );
  // <aside> > [header row, nav, footer] — the brand header is first.
  const row = container.querySelector("aside")?.firstElementChild;
  if (!row) throw new Error("sidebar header row not found");
  return row;
}

describe("the top chrome height is declared once (#1399)", () => {
  it("defines the narrow / wide pair as spacing tokens", () => {
    // The --spacing-* namespace is what makes `h-lumen-header` and
    // `min-h-lumen-header-wide` exist as utilities at all under Tailwind v4.
    // Moved out of it, both classes stop being generated — and an undefined
    // utility is not an error, it is a row with no height at all.
    expect(tokens).toMatch(/--spacing-lumen-header:\s*3\.5rem;/);
    expect(tokens).toMatch(/--spacing-lumen-header-wide:\s*3\.75rem;/);
  });

  it("keeps the pair in rem so both rows track the font-size setting", () => {
    // The unit is load-bearing, which is easy to miss because `3.75rem` and
    // `60px` look interchangeable at a 16px root — and this app's root is
    // never 16px. ThemeContext drives documentElement from the Settings step
    // (12-25px), and everything inside both rows is rem: the text line boxes,
    // `py-2`, `pt-4`, the brand mark's `h-6`. Pin ONE of the rows to px and it
    // stops scaling while its twin's contents keep going, which re-opens the
    // step at every step but the one the value was picked for.
    const value = (name: string): string => {
      const m = new RegExp(`--spacing-${name}:\\s*([^;]+);`).exec(tokens);
      if (!m?.[1]) throw new Error(`--spacing-${name} is not defined`);
      return m[1].trim();
    };
    expect(value("lumen-header")).toMatch(/rem$/);
    expect(value("lumen-header-wide")).toMatch(/rem$/);
  });

  it("sizes the sidebar brand header from the token", () => {
    const row = renderSidebarHeader();
    expect(row.className).toContain("h-lumen-header");
    expect(row.className).toContain("md:h-lumen-header-wide");
  });

  it("floors the section header at the same token", () => {
    const { container } = render(<SectionHeader title="Work" />);
    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("min-h-lumen-header");
    expect(row.className).toContain("md:min-h-lumen-header-wide");
  });

  it("leaves no numeric height on either row", () => {
    // The failure this catches is a half-revert: one row goes back to a number
    // while the other keeps the token, and the step returns silently. Both
    // rows own their full height, so ANY `h-<n>` / `min-h-<n>` on them is the
    // regression — no legitimate numeric height belongs on either.
    const numeric = /^(min-)?h-\d/;
    expect(
      utilities(renderSidebarHeader()).filter((c) => numeric.test(c)),
    ).toEqual([]);

    const { container } = render(<SectionHeader title="Work" />);
    const sectionRow = container.firstElementChild as HTMLElement;
    expect(utilities(sectionRow).filter((c) => numeric.test(c))).toEqual([]);
  });
});
