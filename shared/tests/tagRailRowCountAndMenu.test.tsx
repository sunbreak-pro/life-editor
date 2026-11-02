import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { TagHubTagRail, type TagHubTagSummary } from "../src/components";
import { TAG_HUB_LABELS, formatCount, formatUnusedTags } from "./tagHubLabels";

/*
 * #2409 — what a rail row shows without being hovered: its count in words
 * ("9 items", not a bare "9"), and the "…" of tag actions on Desktop as well.
 */

const WORK: TagHubTagSummary = {
  id: "t-work",
  name: "Work",
  color: null,
  icon: null,
  count: 9,
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

function renderRail(wide: boolean) {
  const tags = [WORK, UNTAGGED];
  render(
    <TagHubTagRail
      tags={tags}
      visibleTags={tags}
      unusedTags={[]}
      selectedId={null}
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

const menuButton = () =>
  screen.getByRole("button", { name: `Work: ${TAG_HUB_LABELS.rowMenu}` });

beforeEach(cleanup);

describe("TagHubTagRail — the row's count and menu (#2409)", () => {
  it("prints the count with its unit", () => {
    renderRail(true);
    const row = screen.getByRole("button", { name: "Work: 9 items" });
    expect(within(row).getByText("9 items")).toBeTruthy();
  });

  it("keeps the row's spoken name, so the count is not announced twice", () => {
    renderRail(true);
    const row = screen.getByRole("button", { name: "Work: 9 items" });
    expect(within(row).getByText("9 items").getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("paints the Desktop menu without waiting for a hover", () => {
    renderRail(true);
    expect(menuButton().classList.contains("opacity-0")).toBe(false);
  });

  it("keeps the narrow menu at its 44px size", () => {
    renderRail(false);
    expect(menuButton().classList.contains("h-11")).toBe(true);
  });

  it("gives the untagged bucket no menu, since there is nothing to edit", () => {
    renderRail(true);
    expect(
      screen.queryByRole("button", {
        name: `Untagged: ${TAG_HUB_LABELS.rowMenu}`,
      }),
    ).toBeNull();
  });
});
