import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { TagHubTagRail, type TagHubTagSummary } from "../src/components";
import { TAG_HUB_LABELS, formatCount, formatUnusedTags } from "./tagHubLabels";

/*
 * #2501 — a light tag colour (amber) melted into the selected row's wash. The
 * colour itself is the user's and is not corrected; the selected row alone lays
 * a page-coloured disc under the glyph. jsdom has no layout or paint, so this
 * pins the structure: the disc is there on the selected row, under the glyph,
 * drawn with a lumen-* token, and absent from every other row. The disc alone
 * left four light colours under 3:1, so the selected glyph also carries a 1px
 * outline in the text token; that too is pinned by its class.
 */

const DEV: TagHubTagSummary = {
  id: "t-dev",
  name: "Dev",
  color: "#eab308",
  icon: "Wrench",
  count: 3,
  isUntagged: false,
};

const HOME: TagHubTagSummary = {
  id: "t-home",
  name: "Home",
  color: "#2563eb",
  icon: null,
  count: 1,
  isUntagged: false,
};

const UNTAGGED: TagHubTagSummary = {
  id: "taghub:untagged",
  name: "Untagged",
  color: null,
  icon: null,
  count: 2,
  isUntagged: true,
};

function renderRail(selectedId: string | null, wide = true) {
  const tags = [DEV, HOME, UNTAGGED];
  render(
    <TagHubTagRail
      tags={tags}
      visibleTags={tags}
      unusedTags={[]}
      selectedId={selectedId}
      onSelect={vi.fn()}
      query=""
      onQueryChange={vi.fn()}
      formatCount={formatCount}
      formatUnusedTags={formatUnusedTags}
      onEditTag={vi.fn()}
      onDeleteTag={vi.fn()}
      wide={wide}
      labels={TAG_HUB_LABELS}
    />,
  );
}

// The exact "name: count" label, so the row's "…" (also "name: …") is not
// picked up as well.
const rowButton = (tag: TagHubTagSummary) =>
  screen.getByRole("button", {
    name: `${tag.name}: ${formatCount(tag.count)}`,
  });

const discIn = (tag: TagHubTagSummary) =>
  within(rowButton(tag)).queryByTestId("tag-rail-icon-disc");

beforeEach(cleanup);

describe("TagHubTagRail — the selected row's icon disc (#2501)", () => {
  it("lays a disc under the selected row's icon", () => {
    renderRail(DEV.id);
    const wrapper = discIn(DEV);
    expect(wrapper).not.toBeNull();
    // The disc comes first and sits below the glyph in its own stacking
    // context, so it never paints over the icon.
    expect(wrapper!.classList.contains("isolate")).toBe(true);
    const disc = wrapper!.firstElementChild as HTMLElement;
    expect(disc.tagName).toBe("SPAN");
    expect(disc.getAttribute("aria-hidden")).toBe("true");
    for (const cls of ["absolute", "-z-10", "rounded-full", "bg-lumen-bg"]) {
      expect(disc.classList.contains(cls)).toBe(true);
    }
    expect(wrapper!.querySelector("svg")).not.toBeNull();
  });

  it("keeps the tag's own colour on the glyph", () => {
    renderRail(DEV.id);
    const svg = discIn(DEV)!.querySelector("svg") as SVGElement;
    expect(svg.style.color).toBe("rgb(234, 179, 8)");
  });

  it("draws the disc with a token, not a hard-coded colour", () => {
    renderRail(DEV.id);
    const disc = discIn(DEV)!.firstElementChild as HTMLElement;
    expect(disc.getAttribute("style")).toBeNull();
    expect(disc.className).not.toMatch(/#|\[/);
  });

  it("leaves rows that are not selected without a disc", () => {
    renderRail(DEV.id);
    expect(discIn(HOME)).toBeNull();
    expect(discIn(UNTAGGED)).toBeNull();
    // The unselected glyph stays a direct child of the row button, as before.
    expect(rowButton(HOME).firstElementChild?.tagName.toLowerCase()).toBe(
      "svg",
    );
  });

  it("outlines the selected glyph in the text token, and only the glyph", () => {
    renderRail(DEV.id);
    const wrapper = discIn(DEV)!;
    const outline = within(wrapper).getByTestId("tag-rail-icon-outline");
    // The filter sits on the glyph's own span, not on the wrapper that also
    // holds the disc, so the disc is not outlined with it.
    expect(outline.querySelector("svg")).not.toBeNull();
    expect(wrapper.className).not.toMatch(/filter/);
    const filter = outline.className.match(/\[filter:([^\]]+)\]/)?.[1] ?? "";
    const shadows = filter.match(/drop-shadow\([^)]*\)\)/g) ?? [];
    expect(shadows).toHaveLength(4);
    for (const shadow of shadows) {
      expect(shadow).toContain("var(--color-lumen-text)");
    }
    expect(filter).not.toMatch(/#[0-9a-f]{3,8}|rgb/i);
    expect(outline.getAttribute("style")).toBeNull();
  });

  it("leaves rows that are not selected without an outline", () => {
    renderRail(DEV.id);
    for (const tag of [HOME, UNTAGGED]) {
      const row = rowButton(tag);
      expect(within(row).queryByTestId("tag-rail-icon-outline")).toBeNull();
      expect(row.innerHTML).not.toMatch(/drop-shadow/);
    }
  });

  it("draws no disc when nothing is selected", () => {
    renderRail(null);
    expect(screen.queryByTestId("tag-rail-icon-disc")).toBeNull();
  });

  it("moves the disc with the selection, on narrow too", () => {
    renderRail(HOME.id, false);
    expect(discIn(HOME)).not.toBeNull();
    expect(discIn(DEV)).toBeNull();
  });
});

describe("TagHubTagRail — the selected row's bar and title (#2600)", () => {
  it("draws a 3px accent bar beside the selected row only", () => {
    renderRail(DEV.id);
    const bars = screen.getAllByTestId("tag-rail-selection-bar");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveClass("w-[3px]", "bg-lumen-accent");
    expect(bars[0].closest("li")?.contains(rowButton(DEV))).toBe(true);
  });

  it("sets the selected title in the accent, semibold", () => {
    renderRail(DEV.id);
    const title = within(rowButton(DEV)).getByText(DEV.name);
    expect(title).toHaveClass("font-semibold", "text-lumen-accent");
    const other = within(rowButton(HOME)).getByText(HOME.name);
    expect(other).not.toHaveClass("font-semibold");
    expect(other).not.toHaveClass("text-lumen-accent");
  });

  it("keeps the disc while the title takes the accent", () => {
    renderRail(DEV.id);
    expect(discIn(DEV)).not.toBeNull();
  });
});
