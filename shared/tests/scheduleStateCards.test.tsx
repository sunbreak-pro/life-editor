import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScheduleRangeErrorBanner } from "../src/components";

/*
 * #296's quiet half — the retry banner that rides above a calendar which still
 * has rows on it.
 *
 * Only this surface is pinned here. The loading card and the "could not load"
 * card are drawn by the two calendar layouts, and the fold that chooses
 * between them drives both through their own suite
 * (web/tests/calendarLayouts.test.tsx). The banner has no such route: the
 * layouts take it as an opaque `banner` node, and the host that builds it
 * (CalendarTab) is the one Schedule surface no test mounts —
 * rules/frontend.md §テスト環境の制約.
 *
 * So without this file the banner is markup nothing renders: deleting its
 * onClick leaves a dead retry button with every suite green, which is the
 * worst version of #296 — the user can see stale rows and has no way left to
 * ask for fresh ones.
 */

const LABELS = { message: "読み込めませんでした", retry: "再試行" };

describe("ScheduleRangeErrorBanner (#296)", () => {
  it("says what failed and offers the way out", () => {
    render(<ScheduleRangeErrorBanner labels={LABELS} onRetry={vi.fn()} />);
    expect(screen.getByText(LABELS.message)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: LABELS.retry }),
    ).toBeInTheDocument();
  });

  it("re-runs the range fetch when the retry is pressed", () => {
    const onRetry = vi.fn();
    render(<ScheduleRangeErrorBanner labels={LABELS} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: LABELS.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
