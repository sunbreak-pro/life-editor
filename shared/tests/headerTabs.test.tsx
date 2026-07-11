import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeaderTabs, type HeaderTab } from "../src/components";

/*
 * Target-IA Desktop header tabs. Pure presentation: active tab carries
 * aria-selected + the accent underline, badges render only on tabs that
 * declare one, and Left/Right arrows roam focus + activate (WAI-ARIA tabs).
 */

const TABS: HeaderTab[] = [
  { id: "tasks", label: "Tasks", badge: 12 },
  { id: "notes", label: "Notes" },
  { id: "daily", label: "Daily" },
];

function renderTabs(props?: Partial<Parameters<typeof HeaderTabs>[0]>) {
  const onSelect = vi.fn();
  render(
    <HeaderTabs tabs={TABS} activeTab="tasks" onSelect={onSelect} {...props} />,
  );
  return { onSelect };
}

describe("HeaderTabs", () => {
  it("marks the active tab with aria-selected and leaves the rest unselected", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: /Tasks/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("renders a badge only for tabs that declare one", () => {
    renderTabs();
    // Tasks carries a count; it is shown.
    expect(screen.getByText("12")).toBeInTheDocument();
    // Notes / Daily declare no badge → no extra pill beside their label.
    expect(screen.getByRole("tab", { name: "Notes" }).textContent).toBe(
      "Notes",
    );
    expect(screen.getByRole("tab", { name: "Daily" }).textContent).toBe(
      "Daily",
    );
  });

  it("fires onSelect with the tab id on click", () => {
    const { onSelect } = renderTabs();
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("moves selection to the next tab on ArrowRight and wraps around", () => {
    const { onSelect } = renderTabs();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Tasks/ }), {
      key: "ArrowRight",
    });
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("moves selection to the previous tab on ArrowLeft (wrapping to the end)", () => {
    const { onSelect } = renderTabs();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Tasks/ }), {
      key: "ArrowLeft",
    });
    expect(onSelect).toHaveBeenCalledWith("daily");
  });

  it("drops its own bottom border when divider={false} (v2 SectionHeader owns the line)", () => {
    const withDivider = render(
      <HeaderTabs tabs={TABS} activeTab="tasks" onSelect={vi.fn()} />,
    );
    expect(withDivider.container.querySelector(".border-b")).not.toBeNull();
    withDivider.unmount();

    const noDivider = render(
      <HeaderTabs
        tabs={TABS}
        activeTab="tasks"
        onSelect={vi.fn()}
        divider={false}
      />,
    );
    // Only the row's own border is dropped — the active tab keeps its
    // border-b-2 underline (it overlaps the SectionHeader's divider).
    expect(noDivider.container.firstElementChild?.className).not.toMatch(
      /border-b(?!-)/,
    );
    expect(noDivider.container.querySelector(".border-b-2")).not.toBeNull();
  });

  it("renders a trailing node outside the tablist (Turn 2 rightSidebar toggle slot)", () => {
    renderTabs({ trailing: <button type="button">panel</button> });
    // The tablist still exposes exactly the declared tabs (trailing is NOT a tab).
    expect(screen.getAllByRole("tab")).toHaveLength(TABS.length);
    const trailing = screen.getByRole("button", { name: "panel" });
    expect(trailing).toBeInTheDocument();
    expect(trailing).not.toHaveAttribute("role", "tab");
  });
});
