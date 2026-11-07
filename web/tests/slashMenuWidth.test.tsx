import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heading1, ListChecks } from "lucide-react";
import { SlashMenu, type SlashMenuItem } from "../src/notes/SlashMenu";

/*
 * #2669 — the "/" menu's width below 768px.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so a rendered panel measures 0 wide
 * whatever its classes say; the width is asserted through the classes, the
 * same way the other menu-size guards are. What has to hold together:
 *
 *   - Desktop keeps the fixed 16rem of #2586.
 *   - Below `md` the panel is as wide as its longest label (`w-max`) and
 *     capped to the screen, and each row keeps its label on one line — a
 *     content-wide panel whose rows could wrap would just be the old wide
 *     panel with broken labels.
 *   - The 44px row floor below `md` is untouched.
 */
const item = (id: string, title: string, Icon = Heading1): SlashMenuItem => ({
  id,
  title,
  Icon,
  command: vi.fn(),
});

describe("SlashMenu — narrow width (#2669)", () => {
  it("is content-wide and screen-capped below md, 16rem above", () => {
    render(
      <SlashMenu
        items={[
          item("h1", "Heading 1"),
          item("todo", "To-do list", ListChecks),
        ]}
        command={vi.fn()}
        emptyLabel="No match"
      />,
    );
    const panel = screen.getByRole("listbox");
    const classes = panel.className.split(/\s+/);
    expect(classes).toContain("w-[16rem]");
    expect(classes).toContain("max-md:w-max");
    expect(classes).toContain("max-md:max-w-[calc(100vw-2rem)]");
  });

  it("keeps every label on one line and the 44px row floor", () => {
    render(
      <SlashMenu
        items={[
          item("h1", "Heading 1"),
          item("todo", "To-do list", ListChecks),
        ]}
        command={vi.fn()}
        emptyLabel="No match"
      />,
    );
    for (const row of screen.getAllByRole("option")) {
      const classes = row.className.split(/\s+/);
      expect(classes).toContain("whitespace-nowrap");
      expect(classes).toContain("max-md:min-h-11");
    }
  });

  it("narrows the no-match panel the same way", () => {
    render(<SlashMenu items={[]} command={vi.fn()} emptyLabel="No match" />);
    const panel = screen.getByText("No match");
    const classes = panel.className.split(/\s+/);
    expect(classes).toContain("w-[16rem]");
    expect(classes).toContain("max-md:w-max");
  });
});
