import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { TagHubTagRail, type TagHubTagSummary } from "../src/components";
import { TAG_HUB_LABELS, formatCount, formatUnusedTags } from "./tagHubLabels";

/*
 * #1848 — the rail's "Unused tags" disclosure.
 *
 * 1. A tag made from the add row has nothing filed under it, so it sorts into
 *    the collapsed disclosure and vanished from sight. Selecting it (the host
 *    does, once the create lands) now opens the disclosure.
 * 2. The filter never reached the unused tags, so a query matching nothing
 *    still listed them — and while one existed, "no matching tag" never showed.
 */

const tag = (id: string, name: string, count = 1): TagHubTagSummary => ({
  id,
  name,
  color: null,
  icon: null,
  count,
  isUntagged: false,
});

const WORK = tag("t-work", "Work");
const IDLE = tag("t-idle", "Idle", 0);
const READING = tag("t-reading", "Reading", 0);

function renderRail({
  query = "",
  selectedId = null,
}: {
  query?: string;
  selectedId?: string | null;
} = {}) {
  const needle = query.trim().toLowerCase();
  const visibleTags = [WORK].filter((t) =>
    t.name.toLowerCase().includes(needle),
  );
  const props = {
    tags: [WORK],
    visibleTags,
    unusedTags: [IDLE, READING],
    onSelect: vi.fn(),
    query,
    onQueryChange: vi.fn(),
    formatCount,
    formatUnusedTags,
    wide: true,
    labels: TAG_HUB_LABELS,
  };
  const view = render(<TagHubTagRail {...props} selectedId={selectedId} />);
  return {
    select: (id: string | null) =>
      view.rerender(<TagHubTagRail {...props} selectedId={id} />),
  };
}

const unusedList = () =>
  screen.queryByRole("list", { name: TAG_HUB_LABELS.unusedTagsHeading });

beforeEach(cleanup);

describe("TagHubTagRail — a selected unused tag is shown (#1848)", () => {
  it("stays collapsed while nothing behind it is selected", () => {
    renderRail({ selectedId: "t-work" });
    expect(unusedList()).toBeNull();
  });

  it("opens the disclosure when an unused tag becomes the selection", () => {
    const { select } = renderRail();
    expect(unusedList()).toBeNull();

    // What the host does once the add row's create lands.
    select("t-reading");

    const list = unusedList();
    expect(list).not.toBeNull();
    expect(
      within(list as HTMLElement).getByRole("button", {
        name: "Reading: 0 items",
      }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Unused tags (2)" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

describe("TagHubTagRail — the filter reaches unused tags (#1848)", () => {
  it("narrows the disclosure's count to the matches", () => {
    renderRail({ query: "read" });
    screen.getByRole("button", { name: "Unused tags (1)" });
    // The primary list is empty, but a match exists — no "no match" copy.
    expect(screen.queryByText(TAG_HUB_LABELS.filterEmpty)).toBeNull();
  });

  it("says nothing matched when neither list has a match", () => {
    renderRail({ query: "zzz" });
    screen.getByText(TAG_HUB_LABELS.filterEmpty);
    expect(screen.queryByRole("button", { name: /Unused tags/ })).toBeNull();
  });

  it("lists every unused tag again once the query is cleared", () => {
    renderRail();
    screen.getByRole("button", { name: "Unused tags (2)" });
  });
});
