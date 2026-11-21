import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarListControls } from "../src/components";

/*
 * #2794 — the drawer's sort button text is 14px on narrow (max-md:text-sm) and
 * keeps Desktop's 12.5px. jsdom has no layout or media queries, so the
 * classes themselves are what can be pinned.
 */

describe("SidebarListControls text size (#2794)", () => {
  it("raises the sort button to text-sm on narrow and keeps 12.5px on Desktop", () => {
    render(
      <SidebarListControls
        modes={[{ id: "updatedAt", label: "Updated" }]}
        activeModeId="updatedAt"
        onModeChange={() => {}}
        sortLabel="Sort"
        modeGroupLabel="Sort by"
        directionGroupLabel="Order"
        directions={[
          { id: "desc" as const, label: "Newest first" },
          { id: "asc" as const, label: "Oldest first" },
        ]}
        direction="desc"
        onDirectionChange={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: "Sort" });
    expect(button).toHaveClass("text-[12.5px]", "max-md:text-sm");
  });
});
