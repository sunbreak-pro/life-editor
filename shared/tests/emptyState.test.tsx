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
    render(<EmptyState message="No todos yet" />);
    expect(screen.getByText("No todos yet")).toBeInTheDocument();
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

  // #2806: the spoken name can differ from the visible text; omitted, the
  // visible text is the name.
  it("names the CTA by ariaLabel while the visible text stays", () => {
    render(
      <EmptyState
        message="Empty"
        cta={{ label: "Note", ariaLabel: "Create note", onClick: () => {} }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Create note" });
    expect(btn.textContent).toBe("Note");
    expect(screen.queryByRole("button", { name: "Note" })).toBeNull();
  });

  it("names the CTA by its visible text when ariaLabel is omitted", () => {
    render(
      <EmptyState
        message="Empty"
        cta={{ label: "Add one", onClick: () => {} }}
      />,
    );
    const btn = screen.getByRole("button", { name: "Add one" });
    expect(btn.hasAttribute("aria-label")).toBe(false);
  });
});
