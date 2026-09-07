import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarNarrowLayout } from "../src/schedule/CalendarNarrowLayout";
import type { CalendarNarrowLayoutProps } from "../src/schedule/CalendarNarrowLayout";

/*
 * #1558 — the narrow month steppers' 44px touch floor (the schedule half of
 * #1512, whose shared-chrome part landed in shared/tests/sharedTapTargets).
 *
 * jsdom has no layout (CLAUDE.md §7.1), so the 36×36 the audit measured cannot
 * be re-measured here; what is pinned is the CLASS CONTRACT that produces the
 * size. The floor is unprefixed because this component renders only under
 * `!isWide` — the Desktop steppers are CalendarDesktopLayout's toolbar — and
 * the second assertion is what keeps the painted box the size it was.
 *
 * `useTranslation` is stubbed to echo its key, and there is no jest-dom in
 * web/, so classes are read off `className` rather than through toHaveClass
 * (same convention as calendarLayouts.test.tsx).
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const props: CalendarNarrowLayoutProps = {
  header: {
    periodLabel: "August 2026",
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  },
  banner: null,
  state: { loading: false, error: false, onRetry: vi.fn() },
  month: {
    anchorDate: "2026-08-20",
    today: "2026-08-16",
    weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    items: [],
    onSelectDay: vi.fn(),
    formatDayLabel: (k) => k,
  },
};

describe("#1558 — the narrow month steppers meet the 44px touch floor", () => {
  it.each(["scheduleScreen.prev", "scheduleScreen.next"])(
    "floors %s in both directions",
    (name) => {
      render(<CalendarNarrowLayout {...props} />);
      const cls = screen.getByRole("button", { name }).className;
      expect(cls).toContain("min-h-11");
      expect(cls).toContain("min-w-11");
      // The painted box is untouched — only the hit area grew.
      expect(cls).toContain("size-8");
    },
  );
});
