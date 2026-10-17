import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { connectTabBand } from "../src/connect/connectTabBand";
import { ConnectScreen } from "../src/connect/ConnectScreen";
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
 * The second case renders MainScreen's own band builder (connectTabBand)
 * through MainScreen's own header (TabBandHeader). The hub's "tags N / items
 * N" used to ride in the band's trailing slot; #2224 took it off, and that
 * case now pins that nothing is drawn there.
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

  it("draws the tabs and no tag / item totals beside them (#2224)", () => {
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
    });
    const { container } = render(
      <TabBandHeader band={band} controls={null} />,
    );
    screen.getByRole("tab", { name: "Tags" });
    expect(band.trailing).toBeUndefined();
    expect(container.textContent).not.toMatch(/tags \/ \d+ items/);
    expect(container.textContent).not.toMatch(/\d+ items/);
    fireEvent.click(screen.getByRole("tab", { name: "Goals & Todos" }));
    expect(onSelect).toHaveBeenCalledWith("goals");
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
      }) as ReactElement;

    // Tags: the hub inside its tag Provider.
    const tags = body(result.current) as ReactElement<{
      children: ReactElement;
    }>;
    expect(tags.props.children.type).toBe(ConnectScreen);

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
