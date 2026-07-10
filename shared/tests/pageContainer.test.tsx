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

  it("renders the standard gutter header row only when a header is given", () => {
    // fluid body carries no gutter, so px-lumen-gutter isolates the header slot.
    const withHeader = render(
      <PageContainer width="fluid" header={<nav>tabs</nav>}>
        <p>body</p>
      </PageContainer>,
    );
    expect(screen.getByText("tabs")).toBeInTheDocument();
    expect(
      withHeader.container.querySelector(".px-lumen-gutter"),
    ).not.toBeNull();
    withHeader.unmount();

    const noHeader = render(
      <PageContainer width="fluid">
        <p>body</p>
      </PageContainer>,
    );
    expect(noHeader.container.querySelector(".px-lumen-gutter")).toBeNull();
  });
});
