import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ScheduleErrorCard,
  ScheduleLoadingCard,
  ScheduleRangeErrorBanner,
} from "../src/components";

/*
 * #296's quiet half — the retry banner that rides above a calendar which still
 * has rows on it.
 *
 * The fold that chooses between the loading card and the "could not load"
 * card drives both layouts through their own suite
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

/*
 * #2571: the two cards themselves, drawn in the prototype's shape — the
 * shared skeleton (#2620) while loading, the shared danger card on failure.
 * Which one shows stays pinned by web/tests/calendarLayouts.test.tsx.
 */
describe("ScheduleLoadingCard (#2571)", () => {
  it("is a named status region with bars instead of a printed line", () => {
    const { container } = render(<ScheduleLoadingCard label="読み込み中…" />);
    const status = screen.getByRole("status", { name: "読み込み中…" });
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("読み込み中…")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(8);
  });
});

describe("ScheduleErrorCard (#2571)", () => {
  it("says what failed beside a warning icon, on the danger surface", () => {
    render(<ScheduleErrorCard labels={LABELS} onRetry={vi.fn()} />);
    const card = screen.getByRole("alert");
    expect(card.className.split(" ")).toContain("border-lumen-danger");
    expect(card.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(LABELS.message)).toBeInTheDocument();
  });

  it("re-runs the range fetch when the retry is pressed", () => {
    const onRetry = vi.fn();
    render(<ScheduleErrorCard labels={LABELS} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: LABELS.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

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
