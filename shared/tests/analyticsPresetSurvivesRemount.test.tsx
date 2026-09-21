import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import {
  AnalyticsFilterProvider,
  dateRangeDays,
  useAnalyticsFilter,
  type DatePreset,
} from "../src/components/Analytics/AnalyticsFilterContext";

/*
 * #1865 — leaving Analytics and coming back kept the tab (shell state) and
 * silently reset the date range to 30 days (section-level provider state, gone
 * with the unmount). The shell now keeps the preset beside the tab and hands it
 * back through `initialPreset`; this pins the provider's half of that contract.
 */
function Probe(): React.JSX.Element {
  const { preset, dateRange, applyPreset } = useAnalyticsFilter();
  return (
    <div>
      <span data-testid="preset">{preset}</span>
      <span data-testid="days">{dateRangeDays(dateRange)}</span>
      <button onClick={() => applyPreset("7d")}>pick 7d</button>
    </div>
  );
}

/** Stands in for the shell: owns the preset, outlives the section. */
function Shell({ mounted }: { mounted: boolean }): React.JSX.Element {
  const [preset, setPreset] = useState<DatePreset>("30d");
  return (
    <div>
      <span data-testid="shell-preset">{preset}</span>
      {mounted ? (
        <AnalyticsFilterProvider
          initialPreset={preset}
          onPresetChange={setPreset}
        >
          <Probe />
        </AnalyticsFilterProvider>
      ) : null}
    </div>
  );
}

describe("the date-range preset survives leaving the section (#1865)", () => {
  it("reopens on the preset that was picked, range included", () => {
    const { rerender } = render(<Shell mounted />);
    expect(screen.getByTestId("preset").textContent).toBe("30d");

    fireEvent.click(screen.getByText("pick 7d"));
    expect(screen.getByTestId("shell-preset").textContent).toBe("7d");

    // Leave the section, then come back: the provider is a fresh mount.
    rerender(<Shell mounted={false} />);
    expect(screen.queryByTestId("preset")).toBeNull();
    rerender(<Shell mounted />);

    expect(screen.getByTestId("preset").textContent).toBe("7d");
    // The RANGE follows the preset too — a kept pill over a 30-day range
    // would be the same mislead in the other direction.
    expect(screen.getByTestId("days").textContent).toBe("7");
  });

  it("reports the reopened range to the host, so the fetch matches the pill", () => {
    const onDateRangeChange = vi.fn();
    render(
      <AnalyticsFilterProvider
        initialPreset="7d"
        onDateRangeChange={onDateRangeChange}
      >
        <Probe />
      </AnalyticsFilterProvider>,
    );

    expect(onDateRangeChange).toHaveBeenCalledTimes(1);
    expect(dateRangeDays(onDateRangeChange.mock.calls[0][0])).toBe(7);
  });

  it("still opens on 30 days for a host that keeps nothing", () => {
    cleanup();
    render(
      <AnalyticsFilterProvider>
        <Probe />
      </AnalyticsFilterProvider>,
    );

    expect(screen.getByTestId("preset").textContent).toBe("30d");
    expect(screen.getByTestId("days").textContent).toBe("30");
  });
});
