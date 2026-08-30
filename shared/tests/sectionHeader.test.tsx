import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader, HeaderTabs } from "../src/components";

/*
 * Layout Standard v2 §1 — the standard section header row. Left = title (or
 * a tab band doubling as the title), right end = the injected controls, and
 * the row itself carries the full-width divider (border-b) + the v1 page
 * gutter so its left edge lines up with PageContainer content.
 */

describe("SectionHeader", () => {
  it("renders the title, the controls, and the full-width divider", () => {
    const { container } = render(
      <SectionHeader
        title="Work"
        controls={<button type="button">controls</button>}
      />,
    );
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "controls" }),
    ).toBeInTheDocument();
    const root = container.firstElementChild;
    expect(root?.className).toContain("border-b");
    expect(root?.className).toContain("px-lumen-gutter");
  });

  it("lets a tab band stand in for the title (v2 §1)", () => {
    render(
      <SectionHeader
        title="ignored"
        tabs={
          <HeaderTabs
            divider={false}
            tabs={[{ id: "a", label: "Tab A" }]}
            activeTab="a"
            onSelect={() => {}}
          />
        }
        controls={<button type="button">controls</button>}
      />,
    );
    expect(screen.getByRole("tab", { name: "Tab A" })).toBeInTheDocument();
    // The tab band replaces the title — no duplicated heading text.
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  it("omits the controls slot when none are given", () => {
    const { container } = render(<SectionHeader title="Trash" />);
    expect(screen.getByText("Trash")).toBeInTheDocument();
    // Only the left slot is rendered (no empty right-end flex box).
    expect(container.firstElementChild?.childElementCount).toBe(1);
  });

  /*
   * #1283 — the search field sat low because the ROW carried `pt-4` with no
   * `pb`, so `self-center` centred inside the padding box rather than the
   * band. jsdom has no layout, so no assertion here can see a position; what
   * IS observable is the class arrangement that decides it, and the two halves
   * pull in opposite directions:
   *
   *   - the row must have a height and NO vertical padding, or the controls go
   *     off-centre again;
   *   - the tab column must KEEP its top padding, or the strip stops hugging
   *     the divider and its `-mb-px` underline detaches from the row's
   *     border-b — a break nothing else in the suite would catch.
   */
  it("centres on the band: height on the row, no vertical padding (#1283)", () => {
    const { container } = render(
      <SectionHeader
        title="Work"
        controls={<button type="button">controls</button>}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    const utilities = root.className
      .split(" ")
      // Drop any responsive prefix so `md:pt-4` is caught alongside `pt-4`.
      .map((c) => c.slice(c.lastIndexOf(":") + 1));

    expect(utilities.some((c) => c.startsWith("min-h-"))).toBe(true);
    expect(
      utilities.filter(
        (c) =>
          c.startsWith("pt-") || c.startsWith("pb-") || c.startsWith("py-"),
      ),
    ).toEqual([]);
  });

  it("keeps the tab band bottom-glued and leaves a title unpadded (#1283)", () => {
    const withTabs = render(
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={[{ id: "a", label: "Tab A" }]}
            activeTab="a"
            onSelect={() => {}}
          />
        }
      />,
    );
    const tabColumn = withTabs.container.firstElementChild
      ?.firstElementChild as HTMLElement;
    expect(tabColumn.className).toContain("pt-3");

    withTabs.unmount();

    const withTitle = render(<SectionHeader title="Work" />);
    const titleColumn = withTitle.container.firstElementChild
      ?.firstElementChild as HTMLElement;
    expect(titleColumn.className).not.toContain("pt-3");
  });
});
