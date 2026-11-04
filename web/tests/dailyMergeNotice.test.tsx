import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { DailyMergeNotice } from "../src/components/DailyMergeNotice";
import { publishDailyMerge } from "../../shared/src/state/dailyMerges";

/* #2336 — the notice after a send merged a day. */

const showToast = vi.hoisted(() => vi.fn());

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        `${key}|${String(opts?.date)}`,
    }),
    useToast: () => ({ showToast }),
  };
});

const merge = (settled: boolean) =>
  publishDailyMerge({
    date: "2026-11-02",
    body: "{}",
    updatedAt: "2026-11-02T00:00:00.000Z",
    settled,
  });

beforeEach(() => showToast.mockClear());

describe("DailyMergeNotice", () => {
  it("says so once the entry has left the box, naming the day", () => {
    render(<DailyMergeNotice />);
    merge(false);
    expect(showToast).not.toHaveBeenCalled();
    merge(true);
    expect(showToast).toHaveBeenCalledExactlyOnceWith(
      "info",
      "offline.dailyMerged|2026/11/02",
      { durationMs: 10_000 },
    );
  });

  it("stops listening when it unmounts", () => {
    const { unmount } = render(<DailyMergeNotice />);
    unmount();
    merge(true);
    expect(showToast).not.toHaveBeenCalled();
  });
});
