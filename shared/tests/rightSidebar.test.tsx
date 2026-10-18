import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  RightSidebar,
  RightSidebarPortal,
  RightSidebarToggle,
} from "../src/components";
import { RightSidebarProvider } from "../src/context";

/*
 * App Shell Turn 2 — Desktop push-in detail panel + portal plumbing. The panel
 * is hidden while closed, shows on open, the header toggle closes it (#1284
 * retired the in-panel X on Desktop), and the empty state gives way to
 * portalled content once a RightSidebarPortal registers (contentCount).
 */

const LABELS = {
  title: "Details",
  empty: "Nothing selected yet",
  resize: "Resize details panel",
};

function renderPanel(children?: React.ReactNode) {
  return render(
    <RightSidebarProvider>
      {/* The toggle opens AND closes the panel — since #1284 it is the
          panel's only close affordance on Desktop, so the cases below drive it
          in both directions. */}
      <RightSidebarToggle
        variant="panel"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <RightSidebar
        title={LABELS.title}
        emptyLabel={LABELS.empty}
        resizeLabel={LABELS.resize}
      />
      {children}
    </RightSidebarProvider>,
  );
}

describe("RightSidebar (Desktop panel)", () => {
  it("is hidden while closed and appears once opened", () => {
    renderPanel();
    // Closed: no panel landmark.
    expect(
      screen.queryByRole("complementary", { name: "Details" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(
      screen.getByRole("complementary", { name: "Details" }),
    ).toBeInTheDocument();
  });

  /*
   * #2279 — the panel opened with a "Details" row that said nothing the open
   * panel did not and pushed each section's first row down. The name stays
   * for assistive tech (the landmark's aria-label) and the well is the first
   * thing after the resize handle, 12px on every side.
   */
  it("draws no Details header row and starts with the well (#2279)", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const panel = screen.getByRole("complementary", { name: "Details" });
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    const well = screen.getByTestId("right-sidebar-well");
    // [resize handle, well] — nothing sits between the handle and the well.
    expect(panel.children[1]).toBe(well);
    expect(well).toHaveClass("p-3");
  });

  it("draws no close button of its own — the header toggle owns closing (#1284)", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    // With the panel open the header toggle is the ONLY button in the tree;
    // an in-panel X would be a second control for the same job. (The resize
    // handle is role=separator, so it is not counted here.)
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(
      screen.queryByRole("complementary", { name: "Details" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when no content is registered", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByText("Nothing selected yet")).toBeInTheDocument();
  });

  it("replaces the empty state with portalled content and restores it after unmount", () => {
    const { rerender } = renderPanel(
      <RightSidebarPortal>
        <p>todo detail body</p>
      </RightSidebarPortal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    // Content registered → empty state gone, portalled body shown.
    expect(screen.queryByText("Nothing selected yet")).not.toBeInTheDocument();
    expect(screen.getByText("todo detail body")).toBeInTheDocument();

    // Removing the portal cleans up registerContent (contentCount → 0). The
    // Provider stays mounted (panel still open), so the empty state returns
    // without re-toggling.
    rerender(
      <RightSidebarProvider>
        <RightSidebarToggle
          variant="panel"
          openLabel="Open details"
          closeLabel="Hide details"
        />
        <RightSidebar
          title={LABELS.title}
          emptyLabel={LABELS.empty}
          resizeLabel={LABELS.resize}
        />
      </RightSidebarProvider>,
    );
    expect(screen.getByText("Nothing selected yet")).toBeInTheDocument();
    expect(screen.queryByText("todo detail body")).not.toBeInTheDocument();
  });
});

describe("RightSidebarPortal (no Provider)", () => {
  it("renders nothing and does not throw when used outside a Provider", () => {
    render(
      <RightSidebarPortal>
        <p>orphan detail</p>
      </RightSidebarPortal>,
    );
    expect(screen.queryByText("orphan detail")).not.toBeInTheDocument();
  });
});
