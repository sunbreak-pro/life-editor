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
});
