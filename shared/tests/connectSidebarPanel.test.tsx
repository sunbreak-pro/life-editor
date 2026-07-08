import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConnectSidebarPanel } from "../src/components/Connect/ConnectSidebarPanel";
import type { ConnectGraphLabels } from "../src/components/Connect/labels";

/*
 * ConnectSidebarPanel is the rightSidebar 2-tab container. It owns no state
 * (the tab lives in ConnectGraphView) — it renders the tab row, shows the
 * active tab's content, surfaces the backlink count badge, and emits tab
 * changes. These tests pin those contracts.
 */
const labels = {
  title: "Connect",
  settingsTab: "Graph settings",
  backlinksTab: "Backlinks",
} as unknown as ConnectGraphLabels;

describe("ConnectSidebarPanel", () => {
  it("shows the settings content when the settings tab is active", () => {
    render(
      <ConnectSidebarPanel
        labels={labels}
        activeTab="settings"
        onTabChange={vi.fn()}
        backlinkCount={3}
        settingsContent={<div>SETTINGS_BODY</div>}
        backlinksContent={<div>BACKLINKS_BODY</div>}
      />,
    );
    expect(screen.getByText("SETTINGS_BODY")).toBeTruthy();
    expect(screen.queryByText("BACKLINKS_BODY")).toBeNull();
    // Badge reflects the backlink count.
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows the backlinks content when the backlinks tab is active", () => {
    render(
      <ConnectSidebarPanel
        labels={labels}
        activeTab="backlinks"
        onTabChange={vi.fn()}
        backlinkCount={0}
        settingsContent={<div>SETTINGS_BODY</div>}
        backlinksContent={<div>BACKLINKS_BODY</div>}
      />,
    );
    expect(screen.getByText("BACKLINKS_BODY")).toBeTruthy();
    expect(screen.queryByText("SETTINGS_BODY")).toBeNull();
  });

  it("emits onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(
      <ConnectSidebarPanel
        labels={labels}
        activeTab="settings"
        onTabChange={onTabChange}
        backlinkCount={2}
        settingsContent={<div>SETTINGS_BODY</div>}
        backlinksContent={<div>BACKLINKS_BODY</div>}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Backlinks/ }));
    expect(onTabChange).toHaveBeenCalledWith("backlinks");
  });
});
