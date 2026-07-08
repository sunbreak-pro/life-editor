import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileDrawer, RightSidebarToggle } from "../src/components";
import { RightSidebarProvider } from "../src/context";

/*
 * App Shell Turn 2 — Mobile left drawer. Same detail content as the Desktop
 * panel, portalled to <body>; opens via the hamburger toggle and closes on
 * Escape / scrim click. Modal semantics (role=dialog + aria-modal).
 */

const LABELS = {
  title: "Details",
  close: "Close details",
  empty: "Nothing selected yet",
};

function renderDrawer() {
  return render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant="hamburger"
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <MobileDrawer
        title={LABELS.title}
        closeLabel={LABELS.close}
        emptyLabel={LABELS.empty}
      />
    </RightSidebarProvider>,
  );
}

describe("MobileDrawer", () => {
  it("is closed initially and opens the modal dialog on toggle", () => {
    renderDrawer();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when the scrim (backdrop) is clicked", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    const scrim = dialog.parentElement as HTMLElement;
    fireEvent.mouseDown(scrim);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close when the drawer body itself is clicked", () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    const dialog = screen.getByRole("dialog", { name: "Details" });
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
