import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalyticsEmptyState } from "../src/components/Analytics/AnalyticsEmptyState";

/*
 * AnalyticsEmptyState replaces the old one-line "no data" text with a designed empty:
 * icon badge + heading + guidance sentence (design-analytics-v2).
 */
describe("AnalyticsEmptyState", () => {
  it("renders the icon, title, and guidance description", () => {
    render(
      <AnalyticsEmptyState
        icon={<svg data-testid="empty-icon" />}
        title="No work sessions yet"
        description="Start your first pomodoro to see analytics."
      />,
    );
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
    expect(screen.getByText("No work sessions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Start your first pomodoro to see analytics."),
    ).toBeInTheDocument();
  });
});
