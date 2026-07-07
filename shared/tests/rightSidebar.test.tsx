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
 * is hidden while closed, shows on open, X closes it, and the empty state gives
 * way to portalled content once a RightSidebarPortal registers (contentCount).
 */

const LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
  resize: "Resize details panel",
};

function renderPanel(children?: React.ReactNode) {
  return render(
    <RightSidebarProvider>
      {/* Toggle opens the panel; the panel reads the same context. The toggle's
          open-state label is distinct from the panel's X so name queries stay
          unambiguous. */}
      <RightSidebarToggle
        variant="panel"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <RightSidebar
        title={LABELS.title}
        closeLabel={LABELS.close}
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
    // Closed: no title, no close button.
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close details" }),
    ).toBeInTheDocument();
  });

  it("closes when the X button is clicked", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(screen.queryByText("Details")).not.toBeInTheDocument();
  });

  it("shows the empty state when no content is registered", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByText("Nothing selected yet")).toBeInTheDocument();
  });

  it("replaces the empty state with portalled content and restores it after unmount", () => {
    const { rerender } = renderPanel(
      <RightSidebarPortal>
        <p>task detail body</p>
      </RightSidebarPortal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    // Content registered → empty state gone, portalled body shown.
    expect(screen.queryByText("Nothing selected yet")).not.toBeInTheDocument();
    expect(screen.getByText("task detail body")).toBeInTheDocument();

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
          closeLabel={LABELS.close}
          emptyLabel={LABELS.empty}
          resizeLabel={LABELS.resize}
        />
      </RightSidebarProvider>,
    );
    expect(screen.getByText("Nothing selected yet")).toBeInTheDocument();
    expect(screen.queryByText("task detail body")).not.toBeInTheDocument();
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
