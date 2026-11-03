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

  /*
   * #2508 — the tab band has to stop at the controls. The band sits in the
   * shrinkable left column (flex-1 min-w-0), the controls in their own
   * non-shrinking column beside it, and the band's tablist is the one that
   * scrolls; if the band ever moved into the controls column or lost the
   * column's min-w-0, Analytics' tabs would run under the search field again.
   */
  it("keeps the tab band in the shrinkable column beside the controls (#2508)", () => {
    const { container } = render(
      <SectionHeader
        tabs={
          <HeaderTabs
            divider={false}
            tabs={[
              { id: "a", label: "概要" },
              { id: "b", label: "スケジュール" },
            ]}
            activeTab="a"
            onSelect={() => {}}
          />
        }
        controls={<button type="button">search</button>}
      />,
    );
    const row = container.firstElementChild as HTMLElement;
    const [tabColumn, controlsColumn] = Array.from(row.children);
    const tablist = screen.getByRole("tablist");

    expect(tabColumn?.contains(tablist)).toBe(true);
    expect(controlsColumn?.contains(tablist)).toBe(false);
    expect(controlsColumn?.contains(screen.getByText("search"))).toBe(true);
    expect(tabColumn?.className.split(" ")).toContain("min-w-0");
    expect(controlsColumn?.className.split(" ")).toContain("shrink-0");
    expect(tablist.className.split(" ")).toContain("overflow-x-auto");
  });

  /*
   * Review of PR #2529: at 768px the tablist got 0px. The search field kept
   * its full width inside the shrink-0 controls group, and the tab column
   * (flex-1, basis 0) only ever received the leftovers. The fix makes the
   * search field its own item of the row with a floor, hands it nearly all of
   * any shortfall, and gives the tab column its natural width as its basis.
   * jsdom has no layout, so these pin the structure and classes that decide
   * the order; the widths are checked in a real browser.
   */
  describe("short rows narrow the search field before the tabs (#2508)", () => {
    function renderTabbed(): HTMLElement {
      const { container } = render(
        <SectionHeader
          tabs={
            <HeaderTabs
              divider={false}
              tabs={[
                { id: "a", label: "概要" },
                { id: "b", label: "記録" },
              ]}
              activeTab="a"
              onSelect={() => {}}
            />
          }
          search={<button type="button">search</button>}
          controls={<button type="button">undo</button>}
        />,
      );
      return container.firstElementChild as HTMLElement;
    }

    it("puts the search field in its own row item between the tabs and the controls", () => {
      const row = renderTabbed();
      expect(row.childElementCount).toBe(3);
      const [tabColumn, searchSlot, controlsColumn] = Array.from(row.children);
      expect(tabColumn?.contains(screen.getByRole("tablist"))).toBe(true);
      expect(searchSlot?.contains(screen.getByText("search"))).toBe(true);
      expect(controlsColumn?.contains(screen.getByText("undo"))).toBe(true);
      // Inside the shrink-0 group the field's width was the group's minimum.
      expect(controlsColumn?.contains(screen.getByText("search"))).toBe(false);
    });

    it("gives the search slot its width, a floor and the larger shrink share", () => {
      const row = renderTabbed();
      const searchSlot = row.children[1];
      expect(searchSlot?.className.split(" ")).toEqual(
        expect.arrayContaining([
          "md:w-72",
          "xl:w-96",
          "md:min-w-32",
          "md:shrink-[1000]",
        ]),
      );
    });

    it("bases the tab column on the band's natural width, not on 0", () => {
      const row = renderTabbed();
      const classes = row.children[0]?.className.split(" ") ?? [];
      expect(classes).toEqual(expect.arrayContaining(["flex-auto", "min-w-0"]));
      // flex-1 is basis 0: the column would only get what the controls leave.
      expect(classes).not.toContain("flex-1");
    });

    it("keeps flex-1 on a title column and the old 8px before the controls", () => {
      const { container } = render(
        <SectionHeader
          title="Work"
          controls={<button type="button">undo</button>}
        />,
      );
      const [titleColumn, controlsColumn] = Array.from(
        (container.firstElementChild as HTMLElement).children,
      );
      expect(titleColumn?.className.split(" ")).toContain("flex-1");
      expect(controlsColumn?.className.split(" ")).toContain("pl-2");
    });

    it("spaces the controls 6px from the search field, as between controls", () => {
      const row = renderTabbed();
      const classes = row.children[2]?.className.split(" ") ?? [];
      expect(classes).toEqual(expect.arrayContaining(["pl-1.5", "gap-1.5"]));
      expect(classes).not.toContain("pl-2");
    });
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

  /*
   * #2280 — on Desktop a section title ("Schedule", "Work") read visibly
   * smaller than the tab labels of the tabbed sections. Both now step up to
   * base at md and keep sm below it; jsdom loads no stylesheet, so the class
   * pair is what this can see.
   */
  it("sizes the title like the tab labels: sm, base from md (#2280)", () => {
    const withTitle = render(<SectionHeader title="Work" />);
    const title = withTitle.getByRole("heading", { name: "Work" });
    expect(title.className.split(" ")).toEqual(
      expect.arrayContaining(["text-sm", "md:text-base"]),
    );
    withTitle.unmount();

    render(
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
    expect(
      screen.getByRole("tab", { name: "Tab A" }).className.split(" "),
    ).toEqual(expect.arrayContaining(["text-sm", "md:text-base"]));
  });
});
