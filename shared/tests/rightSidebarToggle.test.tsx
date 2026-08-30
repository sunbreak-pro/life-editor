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

  /*
   * #1284 — the panel variant's glyph flips with the state, the way the left
   * sidebar's collapse button always has. Nothing else in the suite can see
   * that: the label and aria-expanded were already flipping, so a static glyph
   * kept every assertion above green. lucide stamps its icon name onto the
   * svg's class list, which is the only handle jsdom offers here (it has no
   * layout, so nothing about the drawn shape is observable).
   */
  it("(panel) flips the glyph with the state, mirroring the left sidebar", () => {
    renderToggle("panel");
    const btn = screen.getByRole("button", { name: "Open details" });
    const glyph = () => btn.querySelector("svg")?.getAttribute("class") ?? "";

    expect(glyph()).toContain("lucide-panel-right-open");
    fireEvent.click(btn);
    expect(glyph()).toContain("lucide-panel-right-close");
    fireEvent.click(btn);
    expect(glyph()).toContain("lucide-panel-right-open");
  });

  it("(hamburger) keeps one glyph — the drawer covers the button", () => {
    // Mobile behaviour must not change (#1284): the drawer is modal and sits
    // over this control, so there is no open state for it to reflect.
    renderToggle("hamburger");
    const btn = screen.getByRole("button", { name: "Open details" });
    const glyph = () => btn.querySelector("svg")?.getAttribute("class") ?? "";

    expect(glyph()).toContain("lucide-panel-right");
    fireEvent.click(btn);
    expect(glyph()).toContain("lucide-panel-right");
    expect(glyph()).not.toContain("lucide-panel-right-close");
  });
});
