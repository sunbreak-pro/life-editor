import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sunrise, Sunset } from "lucide-react";
import { HeaderTabs, type HeaderTab } from "../src/components";

/*
 * Target-IA Desktop header tabs. Pure presentation: active tab carries
 * aria-selected + the accent underline, badges render only on tabs that
 * declare one, and Left/Right arrows roam focus + activate (WAI-ARIA tabs).
 */

const TABS: HeaderTab[] = [
  { id: "todos", label: "Todos", badge: 12 },
  { id: "notes", label: "Notes" },
  { id: "daily", label: "Daily" },
];

function renderTabs(props?: Partial<Parameters<typeof HeaderTabs>[0]>) {
  const onSelect = vi.fn();
  render(
    <HeaderTabs tabs={TABS} activeTab="todos" onSelect={onSelect} {...props} />,
  );
  return { onSelect };
}

describe("HeaderTabs", () => {
  it("marks the active tab with aria-selected and leaves the rest unselected", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: /Todos/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("draws the active tab in semibold and leaves the rest at the base weight (#2619)", () => {
    renderTabs();
    const active = screen.getByRole("tab", { name: /Todos/ });
    expect(active).toHaveClass("font-semibold");
    expect(active).not.toHaveClass("font-medium");
    for (const name of ["Notes", "Daily"]) {
      const tab = screen.getByRole("tab", { name });
      expect(tab).not.toHaveClass("font-semibold");
      expect(tab).not.toHaveClass("font-medium");
    }
  });

  it("renders a badge only for tabs that declare one", () => {
    renderTabs();
    // Todos carries a count; it is shown.
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
    fireEvent.keyDown(screen.getByRole("tab", { name: /Todos/ }), {
      key: "ArrowRight",
    });
    expect(onSelect).toHaveBeenCalledWith("notes");
  });

  it("moves selection to the previous tab on ArrowLeft (wrapping to the end)", () => {
    const { onSelect } = renderTabs();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Todos/ }), {
      key: "ArrowLeft",
    });
    expect(onSelect).toHaveBeenCalledWith("daily");
  });

  it("drops its own bottom border when divider={false} (v2 SectionHeader owns the line)", () => {
    const withDivider = render(
      <HeaderTabs tabs={TABS} activeTab="todos" onSelect={vi.fn()} />,
    );
    expect(withDivider.container.querySelector(".border-b")).not.toBeNull();
    withDivider.unmount();

    const noDivider = render(
      <HeaderTabs
        tabs={TABS}
        activeTab="todos"
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

  /*
   * #2508 — Analytics' five tabs wrapped 「概 / 要」 at 1280px and stacked one
   * character per line at 768px, running under the header's search field.
   * jsdom has no layout, so the classes that keep a label on one line and
   * scroll the overflow sideways are what this can pin; the positions are
   * checked in a real browser.
   */
  describe("overflow (#2508)", () => {
    const FIVE: HeaderTab[] = [
      { id: "overview", label: "概要" },
      { id: "tasks", label: "Todo" },
      { id: "work", label: "作業" },
      { id: "schedule", label: "スケジュール" },
      { id: "records", label: "記録" },
    ];

    function classesOf(el: Element | null | undefined): string[] {
      return (el?.getAttribute("class") ?? "").split(/\s+/);
    }

    it("keeps every tab label on one line and lets no tab shrink", () => {
      render(
        <HeaderTabs
          tabs={FIVE}
          activeTab="overview"
          onSelect={vi.fn()}
          divider={false}
        />,
      );
      for (const tab of screen.getAllByRole("tab")) {
        expect(classesOf(tab)).toEqual(
          expect.arrayContaining(["whitespace-nowrap", "shrink-0"]),
        );
      }
    });

    it("scrolls the tablist sideways and lets the row shrink below the tabs' width", () => {
      const { container } = render(
        <HeaderTabs
          tabs={FIVE}
          activeTab="overview"
          onSelect={vi.fn()}
          divider={false}
        />,
      );
      const tablist = screen.getByRole("tablist");
      expect(classesOf(tablist)).toEqual(
        expect.arrayContaining(["overflow-x-auto", "min-w-0"]),
      );
      // The row is a flex item of SectionHeader's left column: without
      // min-w-0 it keeps the tabs' full width and runs under the controls.
      expect(container.firstElementChild).toBe(tablist.parentElement);
      expect(classesOf(container.firstElementChild)).toContain("min-w-0");
    });

    it("gives the scroll container the pixel the active underline hangs below it", () => {
      render(
        <HeaderTabs
          tabs={FIVE}
          activeTab="overview"
          onSelect={vi.fn()}
          divider={false}
        />,
      );
      // Each tab sits -mb-px so its underline overlaps the divider; a scroll
      // container would clip that pixel unless it pads it in (pb-px) and
      // hangs by the same pixel itself (-mb-px).
      expect(classesOf(screen.getByRole("tablist"))).toEqual(
        expect.arrayContaining(["-mb-px", "pb-px"]),
      );
      expect(classesOf(screen.getByRole("tab", { name: "概要" }))).toContain(
        "-mb-px",
      );
    });

    it("still roams all five tabs with the arrow keys", () => {
      const onSelect = vi.fn();
      render(
        <HeaderTabs tabs={FIVE} activeTab="records" onSelect={onSelect} />,
      );
      fireEvent.keyDown(screen.getByRole("tab", { name: "記録" }), {
        key: "ArrowRight",
      });
      expect(onSelect).toHaveBeenLastCalledWith("overview");
      fireEvent.keyDown(screen.getByRole("tab", { name: "記録" }), {
        key: "ArrowLeft",
      });
      expect(onSelect).toHaveBeenLastCalledWith("schedule");
    });

    /*
     * Review of PR #2529: at 1280px 「記録」 started 23px clipped, and selecting
     * it with → left the strip's scrollLeft at 0. jsdom has no scrollIntoView,
     * so a stub records which tab was asked to come into view and how.
     */
    describe("brings the selected tab into view", () => {
      const original = Element.prototype.scrollIntoView;
      afterEach(() => {
        Element.prototype.scrollIntoView = original;
      });

      function stubScroll(): ReturnType<typeof vi.fn> {
        const spy = vi.fn();
        Element.prototype.scrollIntoView = spy;
        return spy;
      }

      it("on mount, so a band opened on a clipped tab starts with it visible", () => {
        const spy = stubScroll();
        render(
          <HeaderTabs tabs={FIVE} activeTab="records" onSelect={vi.fn()} />,
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.contexts[0]).toBe(
          screen.getByRole("tab", { name: "記録" }),
        );
        // nearest on both axes: scroll the strip only as far as needed and
        // leave the page's vertical position alone.
        expect(spy).toHaveBeenCalledWith({
          block: "nearest",
          inline: "nearest",
        });
      });

      it("when the selection moves (arrow key → parent re-renders)", () => {
        const spy = stubScroll();
        const { rerender } = render(
          <HeaderTabs tabs={FIVE} activeTab="schedule" onSelect={vi.fn()} />,
        );
        spy.mockClear();
        rerender(
          <HeaderTabs tabs={FIVE} activeTab="records" onSelect={vi.fn()} />,
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.contexts[0]).toBe(
          screen.getByRole("tab", { name: "記録" }),
        );
      });

      it("not on a re-render that keeps the same tab", () => {
        const spy = stubScroll();
        const { rerender } = render(
          <HeaderTabs tabs={FIVE} activeTab="records" onSelect={vi.fn()} />,
        );
        spy.mockClear();
        rerender(
          <HeaderTabs tabs={FIVE} activeTab="records" onSelect={vi.fn()} />,
        );
        expect(spy).not.toHaveBeenCalled();
      });

      it("does nothing when no tab matches activeTab", () => {
        const spy = stubScroll();
        render(
          <HeaderTabs tabs={FIVE} activeTab="missing" onSelect={vi.fn()} />,
        );
        expect(spy).not.toHaveBeenCalled();
      });
    });
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

describe("HeaderTabs — the glyph before the label (#2631)", () => {
  const WITH_ICONS: HeaderTab[] = [
    { id: "morning", label: "Morning", icon: <Sunrise /> },
    { id: "evening", label: "Evening", icon: <Sunset /> },
    { id: "plain", label: "Plain" },
  ];

  it("draws an aria-hidden glyph only on tabs that pass one, outside the name", () => {
    render(
      <HeaderTabs tabs={WITH_ICONS} activeTab="morning" onSelect={vi.fn()} />,
    );
    const morning = screen.getByRole("tab", { name: "Morning" });
    const evening = screen.getByRole("tab", { name: "Evening" });
    const plain = screen.getByRole("tab", { name: "Plain" });

    const glyph = morning.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(evening.querySelector("svg")).not.toBeNull();
    expect(plain.querySelector("svg")).toBeNull();
  });

  it("tints the selected tab's glyph with the accent and the rest tertiary", () => {
    render(
      <HeaderTabs tabs={WITH_ICONS} activeTab="morning" onSelect={vi.fn()} />,
    );
    const on = screen
      .getByRole("tab", { name: "Morning" })
      .querySelector("svg");
    const off = screen
      .getByRole("tab", { name: "Evening" })
      .querySelector("svg");
    // lucide draws in currentColor, so the tint sits on the wrapper.
    expect(on?.parentElement?.className).toContain("text-lumen-accent");
    expect(off?.parentElement?.className).toContain("text-lumen-text-tertiary");
  });
});
