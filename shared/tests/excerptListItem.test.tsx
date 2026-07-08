import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExcerptListItem } from "../src/components";

/*
 * Title + one-line-excerpt row. Clickable rows are full-width buttons that
 * expose aria-current when selected; read-only rows (no onClick) are static.
 */
describe("ExcerptListItem", () => {
  it("renders the title and excerpt", () => {
    render(<ExcerptListItem title="Groceries" excerpt="milk, eggs, bread" />);
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("milk, eggs, bread")).toBeInTheDocument();
  });

  it("renders as a button and fires onClick when interactive", () => {
    const onClick = vi.fn();
    render(<ExcerptListItem title="Groceries" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: /Groceries/ });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks the selected interactive row with aria-current", () => {
    render(<ExcerptListItem title="Groceries" selected onClick={() => {}} />);
    expect(
      screen.getByRole("button", { name: /Groceries/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("renders a static row (no button) when onClick is omitted", () => {
    render(<ExcerptListItem title="Groceries" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("renders the meta node", () => {
    render(
      <ExcerptListItem
        title="Pinned note"
        meta={<span data-testid="pin">pin</span>}
      />,
    );
    expect(screen.getByTestId("pin")).toBeInTheDocument();
  });
});
