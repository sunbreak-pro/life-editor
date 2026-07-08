import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../src/components";

/*
 * Brief-standard empty state. Pure presentation: message + optional icon +
 * optional accent CTA, all injected already-translated. The CTA renders only
 * when provided and forwards clicks to its handler.
 */
describe("EmptyState", () => {
  it("renders the message", () => {
    render(<EmptyState message="No tasks yet" />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("renders the injected icon", () => {
    render(
      <EmptyState
        message="Empty"
        icon={<svg data-testid="glyph" />}
      />,
    );
    expect(screen.getByTestId("glyph")).toBeInTheDocument();
  });

  it("renders no CTA button when cta is omitted", () => {
    render(<EmptyState message="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the CTA and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <EmptyState message="Empty" cta={{ label: "Add one", onClick }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add one" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
