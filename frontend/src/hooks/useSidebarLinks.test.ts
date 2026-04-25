import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSidebarLinks } from "./useSidebarLinks";
import type { SidebarLink, BrowserInfo } from "../types/sidebarLink";

const mockLink = (overrides: Partial<SidebarLink> = {}): SidebarLink => ({
  id: "sl-1",
  kind: "url",
  name: "Anthropic",
  target: "https://www.anthropic.com",
  emoji: null,
  sortOrder: 0,
  isDeleted: false,
  deletedAt: null,
  version: 1,
  createdAt: "2026-04-25T00:00:00.000Z",
  updatedAt: "2026-04-25T00:00:00.000Z",
  ...overrides,
});

const browsers: BrowserInfo[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    path: "/Applications/Google Chrome.app",
  },
  { id: "safari", name: "Safari", path: "/Applications/Safari.app" },
];

const fetchSidebarLinks = vi.fn();
const listBrowsers = vi.fn();
const listApplications = vi.fn();
const getAppSetting = vi.fn();
const setAppSetting = vi.fn();
const removeAppSetting = vi.fn();
const createSidebarLink = vi.fn();
const updateSidebarLink = vi.fn();
const deleteSidebarLink = vi.fn();
const reorderSidebarLinks = vi.fn();
const systemOpenUrl = vi.fn();
const systemOpenApp = vi.fn();

vi.mock("../services", () => ({
  getDataService: () => ({
    fetchSidebarLinks,
    listBrowsers,
    listApplications,
    getAppSetting,
    setAppSetting,
    removeAppSetting,
    createSidebarLink,
    updateSidebarLink,
    deleteSidebarLink,
    reorderSidebarLinks,
    systemOpenUrl,
    systemOpenApp,
  }),
}));

describe("useSidebarLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSidebarLinks.mockResolvedValue([]);
    listBrowsers.mockResolvedValue(browsers);
    getAppSetting.mockResolvedValue(null);
    setAppSetting.mockResolvedValue(undefined);
    removeAppSetting.mockResolvedValue(undefined);
    systemOpenUrl.mockResolvedValue(undefined);
    systemOpenApp.mockResolvedValue(undefined);
  });

  it("loads links / browsers / saved default browser on mount", async () => {
    const initial = [mockLink({ id: "sl-init", name: "Init" })];
    fetchSidebarLinks.mockResolvedValue(initial);
    getAppSetting.mockResolvedValue("safari");

    const { result } = renderHook(() => useSidebarLinks());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.links).toEqual(initial);
    expect(result.current.browsers).toEqual(browsers);
    expect(result.current.defaultBrowserId).toBe("safari");
  });

  it("drops saved browser id when that browser is no longer installed", async () => {
    // User had Firefox saved, but Firefox is no longer in /Applications.
    // Hook should fall through to system default rather than try to launch
    // a non-existent app.
    getAppSetting.mockResolvedValue("firefox");

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.defaultBrowserId).toBeNull();
  });

  it("createLink appends the new link to state on success", async () => {
    const created = mockLink({ id: "sl-new", name: "New" });
    createSidebarLink.mockResolvedValue(created);

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createLink({
        kind: "url",
        name: "New",
        target: "https://new.example",
      });
    });

    expect(result.current.links).toHaveLength(1);
    expect(result.current.links[0]?.id).toBe("sl-new");
  });

  it("openLink('url') routes through systemOpenUrl with defaultBrowserId", async () => {
    getAppSetting.mockResolvedValue("chrome");
    const link = mockLink({ kind: "url", target: "https://x.example" });

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.openLink(link);
    });

    expect(systemOpenUrl).toHaveBeenCalledWith("https://x.example", "chrome");
    expect(systemOpenApp).not.toHaveBeenCalled();
  });

  it("openLink('app') routes through systemOpenApp", async () => {
    const link = mockLink({
      kind: "app",
      target: "/Applications/Slack.app",
    });

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.openLink(link);
    });

    expect(systemOpenApp).toHaveBeenCalledWith("/Applications/Slack.app");
    expect(systemOpenUrl).not.toHaveBeenCalled();
  });

  it("setDefaultBrowserId(null) removes the saved preference", async () => {
    getAppSetting.mockResolvedValue("chrome");

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.setDefaultBrowserId(null);
    });

    expect(removeAppSetting).toHaveBeenCalledWith("defaultBrowser");
    expect(result.current.defaultBrowserId).toBeNull();
  });

  it("deleteLink rolls back state if the data service rejects", async () => {
    const initial = [mockLink({ id: "sl-1" }), mockLink({ id: "sl-2" })];
    fetchSidebarLinks.mockResolvedValue(initial);
    deleteSidebarLink.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useSidebarLinks());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteLink("sl-1");
    });

    expect(result.current.links.map((l) => l.id).sort()).toEqual([
      "sl-1",
      "sl-2",
    ]);
  });
});
