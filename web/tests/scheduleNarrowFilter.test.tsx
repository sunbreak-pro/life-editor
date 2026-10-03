import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CalendarNarrowLayout } from "../src/schedule/CalendarNarrowLayout";
import type {
  CalendarNarrowFilter,
  CalendarNarrowLayoutProps,
} from "../src/schedule/CalendarNarrowLayout";

/*
 * #2079 — the tag filter's entry in narrow's month header. Desktop has had it
 * in the toolbar since #1173 / #1639; on a phone there was no way to open the
 * panel at all. The button opens the same panel (the host's setter), lights
 * while a filter is on, carries the count, and meets the 44px touch floor.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderWith(filter?: Partial<CalendarNarrowFilter>) {
  const onOpen = vi.fn();
  const props: CalendarNarrowLayoutProps = {
    header: {
      periodLabel: "October 2026",
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onToday: vi.fn(),
      filter: {
        onOpen,
        active: false,
        count: 0,
        label: "Filter by tag",
        ...filter,
      },
    },
    banner: null,
    state: { loading: false, error: false, onRetry: vi.fn() },
    month: {
      anchorDate: "2026-10-03",
      today: "2026-10-03",
      weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      items: [],
      onSelectDay: vi.fn(),
      formatDayLabel: (k) => k,
    },
  };
  render(<CalendarNarrowLayout {...props} />);
  return { onOpen };
}

describe("#2079 — narrow's tag filter button", () => {
  it("opens the filter panel", () => {
    const { onOpen } = renderWith();
    fireEvent.click(screen.getByRole("button", { name: "Filter by tag" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("meets the 44px touch floor", () => {
    renderWith();
    const cls = screen.getByRole("button", { name: "Filter by tag" }).className;
    expect(cls).toContain("min-h-11");
    expect(cls).toContain("min-w-11");
  });

  it("is off and badge-less with no filter", () => {
    renderWith();
    const btn = screen.getByRole("button", { name: "Filter by tag" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.querySelector("[data-filter-count]")).toBeNull();
  });

  it("lights up and shows the count while a filter is on", () => {
    renderWith({ active: true, count: 2, label: "Filtered by 2 tags" });
    const btn = screen.getByRole("button", { name: "Filtered by 2 tags" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.className).toContain("border-lumen-accent");
    expect(btn.querySelector("[data-filter-count]")?.textContent).toBe("2");
  });

  it("draws no button when the host passes no filter", () => {
    render(
      <CalendarNarrowLayout
        header={{
          periodLabel: "October 2026",
          onPrev: vi.fn(),
          onNext: vi.fn(),
          onToday: vi.fn(),
        }}
        banner={null}
        state={{ loading: false, error: false, onRetry: vi.fn() }}
        month={{
          anchorDate: "2026-10-03",
          today: "2026-10-03",
          weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          items: [],
          onSelectDay: vi.fn(),
          formatDayLabel: (k) => k,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /filter/i })).toBeNull();
  });
});
