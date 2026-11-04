import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
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

  it("prints the count as plain text, without a pill (#2600)", () => {
    renderRail(true);
    const row = screen.getByRole("button", { name: "Work: 9 items" });
    const count = within(row).getByText("9 items");
    expect(count.className).not.toMatch(/\bbg-/);
    expect(count.className).not.toMatch(/\brounded/);
    expect(count).toHaveClass(
      "text-xs",
      "font-normal",
      "text-lumen-text-tertiary",
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

describe("TagHubTagRail — the add row (#2600)", () => {
  function renderWithAdd() {
    render(
      <TagHubTagRail
        tags={[WORK]}
        visibleTags={[WORK]}
        unusedTags={[]}
        selectedId={null}
        onSelect={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        formatCount={formatCount}
        formatUnusedTags={formatUnusedTags}
        onCreateTag={vi.fn()}
        wide
        labels={TAG_HUB_LABELS}
      />,
    );
  }

  const addField = () =>
    screen.getByRole("textbox", { name: TAG_HUB_LABELS.addPlaceholder });
  const addButton = () =>
    screen.getByRole("button", { name: TAG_HUB_LABELS.addButton });

  it("drops the leading plus glyph", () => {
    renderWithAdd();
    const row = addField().parentElement as HTMLElement;
    expect(row.querySelector("svg")).toBeNull();
    expect(row.firstElementChild).toBe(addField());
  });

  it("fills the Add button with the accent", () => {
    renderWithAdd();
    expect(addButton()).toHaveClass("bg-lumen-accent", "text-lumen-on-accent");
    expect(addButton().className).not.toMatch(/surface-sunken|bg-secondary/);
  });

  it("fades the accent rather than greying it while the field is empty", () => {
    renderWithAdd();
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveClass("disabled:opacity-50");
    fireEvent.change(addField(), { target: { value: "Reading" } });
    expect(addButton()).not.toBeDisabled();
  });
});
