import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { ConnectHeaderCounts } from "../src/connect/ConnectHeaderCounts";
import { connectTabBand } from "../src/connect/connectTabBand";
import { GoalsTodosScreen } from "../src/connect/GoalsTodosScreen";
import { TabBandHeader } from "../src/MainScreen";
import { useShellNavigation } from "../src/hooks/useShellNavigation";
import { SECTION_DESCRIPTORS } from "../src/sectionDescriptors";
import { stubDataService } from "./helpers";

/*
 * Connect's タグ / 目標と Todo tabs (#2108). Pinned on the pieces rather than
 * through MainScreen, which needs a session and the whole Provider chain
 * (rules/frontend.md §テスト環境の制約).
 *
 * The risk the plan names: a tab band REPLACES the section header's title row,
 * and the hub's "tags N / items N" was that row's subtitle — so tab-ifying
 * the section would silently drop it. The counts now ride in the band's
 * trailing slot; the second case renders MainScreen's own band builder
 * (connectTabBand) through MainScreen's own header (TabBandHeader).
 */

beforeEach(() => {
  localStorage.clear();
});

describe("Connect tabs (#2108)", () => {
  it("gives Connect a header tab band at both widths", () => {
    const connect = SECTION_DESCRIPTORS.connect;
    expect(connect.tabBand).toBe("connect");
    expect(connect.narrowHeader).toBe("tabs+hamburger");
  });

  it("keeps the hub's counts visible beside the tab band", () => {
    // The band MainScreen builds, drawn by the header MainScreen draws.
    const onSelect = vi.fn();
    const band = connectTabBand({
      defs: [
        { id: "tags", label: "Tags" },
        { id: "goals", label: "Goals & Todos" },
      ],
      active: "tags",
      onSelect,
      label: "Connect views",
      counts: { tags: 14, items: 150 },
    });
    render(<TabBandHeader band={band} controls={null} />);
    screen.getByRole("tab", { name: "Tags" });
    screen.getByText("14 tags / 150 items");
    fireEvent.click(screen.getByRole("tab", { name: "Goals & Todos" }));
    expect(onSelect).toHaveBeenCalledWith("goals");
  });

  it("draws no count before the hub has reported one", () => {
    const { container } = render(<ConnectHeaderCounts counts={null} />);
    expect(container.textContent).toBe("");
  });

  it("mounts the tag hub on Tags and the goal tree on Goals & Todos", () => {
    const { result } = renderHook(() => useShellNavigation());
    expect(result.current.connectTab).toBe("tags");
    const body = (nav: typeof result.current) =>
      SECTION_DESCRIPTORS.connect.body({
        ds: stubDataService(),
        nav,
        narrowTabRow: undefined,
        loadingFallback: null,
        onConnectCounts: () => undefined,
      }) as ReactElement;

    // Tags: the hub inside its tag Provider, still reporting its counts.
    const tags = body(result.current) as ReactElement<{
      children: ReactElement<{ onCountsChange?: unknown }>;
    }>;
    expect(typeof tags.props.children.props.onCountsChange).toBe("function");

    act(() => result.current.setConnectTab("goals"));
    expect(body(result.current).type).toBe(GoalsTodosScreen);
  });

  it("lands nav:tags on the Tags tab whichever tab was open", () => {
    const { result } = renderHook(() => useShellNavigation());
    act(() => result.current.setConnectTab("goals"));
    act(() => result.current.handleNavigate("nav:tags"));
    expect(result.current.section).toBe("connect");
    expect(result.current.connectTab).toBe("tags");
  });
});
