import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("has no status role and full-width bars without label / widths", () => {
    const { container } = render(<SkeletonList rows={2} />);
    expect(screen.queryByRole("status")).toBeNull();
    const bars = container.querySelectorAll<HTMLElement>(".animate-pulse");
    bars.forEach((bar) => expect(bar.style.width).toBe(""));
  });

  it("announces itself as a named busy status when given a label", () => {
    const { container } = render(<SkeletonList label="読み込み中" />);
    const status = screen.getByRole("status", { name: "読み込み中" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).not.toHaveAttribute("aria-hidden");
    // The bars stay out of the accessibility tree under the named wrapper.
    expect(status.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("stays decorative when the label is empty", () => {
    const { container } = render(<SkeletonList label="" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the unlabelled markup exactly as before", () => {
    const { container } = render(<SkeletonList rows={1} />);
    const bar = container.querySelector(".animate-pulse") as HTMLElement;
    // No stray `width` from the widths prop when it is not passed.
    expect(bar.getAttribute("style")).toBe("height: 36px;");
  });

  it("applies widths per row, repeating from the start", () => {
    const { container } = render(
      <SkeletonList rows={5} widths={["82%", "64%"]} />,
    );
    const widths = Array.from(
      container.querySelectorAll<HTMLElement>(".animate-pulse"),
      (bar) => bar.style.width,
    );
    expect(widths).toEqual(["82%", "64%", "82%", "64%", "82%"]);
  });
});
