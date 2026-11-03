import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppCard, type AppCardLabels, type AppsListEntry } from "../src/components";

/*
 * #2510 — the Apps card's URL link was 20px tall on a phone (`text-xs` with no
 * floor), under the 44px touch minimum.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so this pins the CLASS CONTRACT that
 * produces the height; the measured 44px is the separate browser check. The
 * floor is `max-md:` only, so the Desktop card keeps its text-height link.
 */

const LABELS: AppCardLabels = {
  lastRecord: (days) => `Last record: ${days} days ago`,
  recordsLast30Days: (count) => `${count} in the last 30 days`,
  noRecords: "No records yet",
  showRecords: "Show records",
  edit: "Edit",
  delete: "Delete",
  openUrl: (name) => `Open ${name}`,
};

const APP: AppsListEntry = {
  slug: "sample-app",
  name: "Sample app",
  url: "https://example.com/",
  icon: null,
  description: null,
  lastRecordAt: null,
  recordsLast30Days: 0,
};

function renderCard() {
  return render(
    <AppCard
      app={APP}
      labels={LABELS}
      now={Date.parse("2026-11-02T00:00:00Z")}
      onShowRecords={vi.fn()}
    />,
  );
}

describe("AppCard URL link tap target (#2510)", () => {
  it("floors the link at 44px on a phone only", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Open Sample app" });
    const classes = link.className.split(/\s+/);
    expect(classes).toContain("max-md:min-h-11");
    // No bare floor: Desktop keeps the text-height link.
    expect(classes.some((c) => /^min-h-/.test(c))).toBe(false);
    // The text keeps its size; only the box grows.
    expect(classes).toContain("text-xs");
    expect(classes).toContain("items-center");
  });

  it("keeps the link out of the action row, so its box cannot cover the records button", () => {
    renderCard();
    const link = screen.getByRole("link", { name: "Open Sample app" });
    const button = screen.getByRole("button", { name: "Show records" });
    // Neither contains the other, and they sit in different flow rows.
    expect(link.contains(button)).toBe(false);
    expect(button.contains(link)).toBe(false);
    expect(link.parentElement).not.toBe(button.parentElement);
    expect(link.parentElement?.contains(button)).toBe(false);
  });
});
