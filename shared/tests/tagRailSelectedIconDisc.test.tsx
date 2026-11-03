import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { TagHubTagRail, type TagHubTagSummary } from "../src/components";
import { TAG_HUB_LABELS, formatCount, formatUnusedTags } from "./tagHubLabels";

/*
 * #2501 — a light tag colour (amber) melted into the selected row's wash. The
 * colour itself is the user's and is not corrected; the selected row alone lays
 * a page-coloured disc under the glyph. jsdom has no layout or paint, so this
 * pins the structure: the disc is there on the selected row, under the glyph,
 * drawn with a lumen-* token, and absent from every other row.
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
