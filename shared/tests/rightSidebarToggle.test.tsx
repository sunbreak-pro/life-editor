import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RightSidebar, RightSidebarToggle } from "../src/components";
import { RightSidebarProvider } from "../src/context";

/*
 * App Shell Turn 2 — the open/close toggle. Both variants expose aria-expanded
 * tracking the panel state and flip it via the shared context (toggle()).
 */

function renderToggle(variant: "panel" | "hamburger") {
  return render(
    <RightSidebarProvider>
      <RightSidebarToggle
        variant={variant}
        openLabel="Open details"
        closeLabel="Hide details"
      />
      <RightSidebar
        title="Details"
        closeLabel="Close details"
        emptyLabel="Nothing selected yet"
        resizeLabel="Resize details panel"
      />
    </RightSidebarProvider>,
  );
}

describe("RightSidebarToggle", () => {
  it.each(["panel", "hamburger"] as const)(
    "(%s) reflects the closed state via aria-expanded=false initially",
    (variant) => {
      renderToggle(variant);
      expect(
        screen.getByRole("button", { name: "Open details" }),
      ).toHaveAttribute("aria-expanded", "false");
    },
  );

  it.each(["panel", "hamburger"] as const)(
    "(%s) toggles the panel open (aria-expanded=true) on click",
    (variant) => {
      renderToggle(variant);
      const btn = screen.getByRole("button", { name: "Open details" });
      fireEvent.click(btn);
      expect(btn).toHaveAttribute("aria-expanded", "true");
      // The aria-label flips to the close action while open.
      expect(btn).toHaveAccessibleName("Hide details");
      // The panel is now visible (shared context).
      expect(screen.getByText("Details")).toBeInTheDocument();
      // Clicking again toggles it back closed, label back to the open action.
      fireEvent.click(btn);
      expect(btn).toHaveAttribute("aria-expanded", "false");
      expect(btn).toHaveAccessibleName("Open details");
    },
  );
});
