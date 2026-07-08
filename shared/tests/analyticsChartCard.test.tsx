import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartCard } from "../src/components/Analytics/ChartCard";

/*
 * ChartCard is the single surface every Analytics chart sits on
 * (design-analytics-v2). It renders a title + optional meta / control / legend
 * slots + body. Pure presentation.
 */
describe("ChartCard", () => {
  it("renders the title and body children", () => {
    render(
      <ChartCard title="Work Time">
        <div>body content</div>
      </ChartCard>,
    );
    expect(
      screen.getByRole("heading", { name: "Work Time" }),
    ).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("renders the optional meta, control, and legend slots when provided", () => {
    render(
      <ChartCard
        title="Heatmap"
        meta="Hour × Day"
        control={<button type="button">period</button>}
        legend={<span>legend row</span>}
      >
        <div>body</div>
      </ChartCard>,
    );
    expect(screen.getByText("Hour × Day")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "period" })).toBeInTheDocument();
    expect(screen.getByText("legend row")).toBeInTheDocument();
  });

  it("omits the meta/control header cluster when neither is given", () => {
    const { container } = render(
      <ChartCard title="Bare">
        <div>body</div>
      </ChartCard>,
    );
    // Only the heading lives in the header row; no extra control span.
    expect(container.querySelector("button")).toBeNull();
  });
});
