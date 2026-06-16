import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MasterDetail } from "../src/components";

/*
 * W6 Master-Detail — responsive list+detail primitive. The wide↔narrow
 * switch is driven by useMediaQuery; we mock matchMedia to pin each layout
 * (jsdom otherwise has no matchMedia → the hook's wide fallback). Mirrors
 * the appShell.test.tsx / useMediaQuery.test.ts mock pattern.
 */

function mockMatchMedia(matches: boolean) {
  // @ts-expect-error — minimal MediaQueryList stub for tests.
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function renderMD(props?: Partial<Parameters<typeof MasterDetail>[0]>) {
  const onCloseDetail = vi.fn();
  render(
    <MasterDetail
      master={<p>master list</p>}
      detail={<p>detail editor</p>}
      detailOpen={false}
      onCloseDetail={onCloseDetail}
      emptyDetail={<span>nothing selected</span>}
      detailTitle="Note"
      closeLabel="Close note"
      {...props}
    />,
  );
  return { onCloseDetail };
}

afterEach(() => {
  // @ts-expect-error — clear the stub between tests.
  delete window.matchMedia;
});

describe("MasterDetail (wide)", () => {
  it("renders master and detail slots together when a row is selected", () => {
    mockMatchMedia(true);
    renderMD({ detailOpen: true });
    expect(screen.getByText("master list")).toBeInTheDocument();
    expect(screen.getByText("detail editor")).toBeInTheDocument();
    // selected → the empty placeholder is NOT shown
    expect(screen.queryByText("nothing selected")).not.toBeInTheDocument();
  });

  it("shows the empty placeholder in the right pane when nothing is selected", () => {
    mockMatchMedia(true);
    renderMD({ detailOpen: false });
    expect(screen.getByText("master list")).toBeInTheDocument();
    expect(screen.getByText("nothing selected")).toBeInTheDocument();
    expect(screen.queryByText("detail editor")).not.toBeInTheDocument();
  });
});

describe("MasterDetail (narrow)", () => {
  it("keeps master visible and opens the detail sheet on selection", () => {
    mockMatchMedia(false);
    const { onCloseDetail } = renderMD({ detailOpen: true });

    expect(screen.getByText("master list")).toBeInTheDocument();
    const sheet = screen.getByRole("dialog", { name: "Note" });
    expect(within(sheet).getByText("detail editor")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Close note" }));
    expect(onCloseDetail).toHaveBeenCalledTimes(1);
  });

  it("does not render the detail sheet while nothing is selected", () => {
    mockMatchMedia(false);
    renderMD({ detailOpen: false });
    expect(screen.getByText("master list")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("detail editor")).not.toBeInTheDocument();
  });
});
