import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageContainer } from "../src/components";

/*
 * Layout Standard v1 (Issue #180) page frame. These assert the width-token
 * contract directly on the emitted class names: Tailwind resolves the
 * max-w-lumen-* / px-lumen-gutter utilities only if the tokens.css namespaces
 * are right, but at the DOM level here we just verify PageContainer applies the
 * intended classes per variant (the CSS emit itself is checked at build time).
 */

describe("PageContainer", () => {
  it("uses the reading column (max-w-lumen-reading) for width='reading'", () => {
    const { container } = render(
      <PageContainer width="reading">
        <p>body</p>
      </PageContainer>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(container.querySelector(".max-w-lumen-reading")).not.toBeNull();
    expect(container.querySelector(".max-w-lumen-data")).toBeNull();
  });

  it("uses the wide data column (max-w-lumen-data) for width='data'", () => {
    // data is the only regression foothold until #181 wires an in-app consumer.
    const { container } = render(
      <PageContainer width="data">
        <p>body</p>
      </PageContainer>,
    );
    expect(container.querySelector(".max-w-lumen-data")).not.toBeNull();
    expect(container.querySelector(".max-w-lumen-reading")).toBeNull();
  });

  it("keeps the gutter + scroll wrapper but drops max-w for width='full'", () => {
    // v2 §5: a document surface whose width tab is "wide" — full width,
    // still a normal gutter-padded scrolled column (unlike fluid).
    const { container } = render(
      <PageContainer width="full">
        <p>body</p>
      </PageContainer>,
    );
    expect(container.querySelector(".max-w-lumen-reading")).toBeNull();
    expect(container.querySelector(".max-w-lumen-data")).toBeNull();
    expect(container.querySelector(".overflow-y-auto")).not.toBeNull();
    expect(container.querySelector(".px-lumen-gutter")).not.toBeNull();
  });

  it("passes fluid children through with no centering wrapper", () => {
    const { container } = render(
      <PageContainer width="fluid">
        <p>body</p>
      </PageContainer>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(container.querySelector(".max-w-lumen-reading")).toBeNull();
    expect(container.querySelector(".max-w-lumen-data")).toBeNull();
    // fluid drops the self-scroll wrapper too — the body sits in a bare flex-1.
    expect(container.querySelector(".overflow-y-auto")).toBeNull();
  });

  it("renders the header frame only when a header is given", () => {
    const withHeader = render(
      <PageContainer width="fluid" header={<nav>tabs</nav>}>
        <p>body</p>
      </PageContainer>,
    );
    expect(screen.getByText("tabs")).toBeInTheDocument();
    expect(withHeader.container.querySelector(".border-b")).not.toBeNull();
    withHeader.unmount();

    const noHeader = render(
      <PageContainer width="fluid">
        <p>body</p>
      </PageContainer>,
    );
    expect(noHeader.container.querySelector(".border-b")).toBeNull();
  });

  /*
   * #2216 — the narrow band is a tight strip closed by a hairline: ~12px
   * sides and ~4px top / bottom (px-2.5 py-1 at the 18px root), with the
   * divider dropped again at md:, where the band never renders. The frame is
   * the band's direct parent.
   */
  it("frames the narrow band tightly and closes it with a divider (#2216)", () => {
    render(
      <PageContainer width="wide" header={<nav>tabs</nav>}>
        <p>body</p>
      </PageContainer>,
    );
    const frame = screen.getByText("tabs").parentElement!;
    for (const cls of [
      "px-2.5",
      "py-1",
      "border-b",
      "border-lumen-border",
      "md:border-b-0",
    ]) {
      expect(frame.classList.contains(cls)).toBe(true);
    }
    // The old 16px gutter + top-only padding are gone from the band.
    expect(frame.classList.contains("px-lumen-gutter")).toBe(false);
    expect(frame.classList.contains("pt-2")).toBe(false);
  });
});
