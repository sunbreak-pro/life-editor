import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SkeletonList } from "../src/components";

/*
 * Same-shape loading skeleton (no spinner). Renders `rows` pulsing bars and
 * is decorative (aria-hidden) so it never leaks into the accessibility tree.
 */
describe("SkeletonList", () => {
  it("renders 3 rows by default", () => {
    const { container } = render(<SkeletonList />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders the requested number of rows", () => {
    const { container } = render(<SkeletonList rows={5} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
  });

  it("renders nothing for non-positive row counts", () => {
    const { container } = render(<SkeletonList rows={0} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<SkeletonList />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom row height", () => {
    const { container } = render(<SkeletonList rows={1} rowHeight={48} />);
    const bar = container.querySelector(".animate-pulse") as HTMLElement;
    expect(bar.style.height).toBe("48px");
  });
});
