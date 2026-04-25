import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SidebarLink,
  SidebarLinkUpdate,
  BrowserInfo,
} from "../types/sidebarLink";
import { getDataService } from "../services";
import { logServiceError } from "../utils/logError";

const DEFAULT_BROWSER_KEY = "defaultBrowser";

function newId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `sl-${Date.now().toString(36)}${rand}`;
}

export interface UseSidebarLinksValue {
  links: SidebarLink[];
  isLoading: boolean;
  browsers: BrowserInfo[];
  defaultBrowserId: string | null;
  setDefaultBrowserId: (id: string | null) => Promise<void>;
  createLink: (input: {
    kind: "url" | "app";
    name: string;
    target: string;
    emoji?: string | null;
  }) => Promise<SidebarLink | null>;
  updateLink: (id: string, updates: SidebarLinkUpdate) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  reorderLinks: (ids: string[]) => Promise<void>;
  openLink: (link: SidebarLink) => Promise<void>;
  refreshBrowsers: () => Promise<void>;
}

export function useSidebarLinks(): UseSidebarLinksValue {
  const [links, setLinks] = useState<SidebarLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [browsers, setBrowsers] = useState<BrowserInfo[]>([]);
  const [defaultBrowserId, setDefaultBrowserIdState] = useState<string | null>(
    null,
  );
  const linksRef = useRef(links);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  // Initial load: links, default browser preference, installed browsers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const svc = getDataService();
      try {
        const [fetchedLinks, browserList, savedBrowserId] = await Promise.all([
          svc.fetchSidebarLinks(),
          svc.listBrowsers().catch(() => [] as BrowserInfo[]),
          svc.getAppSetting(DEFAULT_BROWSER_KEY).catch(() => null),
        ]);
        if (cancelled) return;
        setLinks(fetchedLinks);
        setBrowsers(browserList);
        // Drop saved id if that browser is no longer installed (uninstalled
        // since last save) — falls through to system default on next click.
        if (
          savedBrowserId &&
          browserList.some((b) => b.id === savedBrowserId)
        ) {
          setDefaultBrowserIdState(savedBrowserId);
        }
      } catch (e) {
        logServiceError("SidebarLinks", "load", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBrowsers = useCallback(async () => {
    try {
      const list = await getDataService().listBrowsers();
      setBrowsers(list);
    } catch (e) {
      logServiceError("SidebarLinks", "refreshBrowsers", e);
    }
  }, []);

  const setDefaultBrowserId = useCallback(async (id: string | null) => {
    setDefaultBrowserIdState(id);
    try {
      if (id === null) {
        await getDataService().removeAppSetting(DEFAULT_BROWSER_KEY);
      } else {
        await getDataService().setAppSetting(DEFAULT_BROWSER_KEY, id);
      }
    } catch (e) {
      logServiceError("SidebarLinks", "setDefaultBrowser", e);
    }
  }, []);

  const createLink = useCallback(
    async (input: {
      kind: "url" | "app";
      name: string;
      target: string;
      emoji?: string | null;
    }): Promise<SidebarLink | null> => {
      try {
        const created = await getDataService().createSidebarLink({
          id: newId(),
          kind: input.kind,
          name: input.name,
          target: input.target,
          emoji: input.emoji ?? null,
        });
        setLinks((prev) => [...prev, created]);
        return created;
      } catch (e) {
        logServiceError("SidebarLinks", "create", e);
        return null;
      }
    },
    [],
  );

  const updateLink = useCallback(
    async (id: string, updates: SidebarLinkUpdate) => {
      const prev = linksRef.current.find((l) => l.id === id);
      // Optimistic UI: apply locally, rollback on failure.
      setLinks((list) =>
        list.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      );
      try {
        const updated = await getDataService().updateSidebarLink(id, updates);
        setLinks((list) => list.map((l) => (l.id === id ? updated : l)));
      } catch (e) {
        logServiceError("SidebarLinks", "update", e);
        if (prev) {
          setLinks((list) => list.map((l) => (l.id === id ? prev : l)));
        }
      }
    },
    [],
  );

  const deleteLink = useCallback(async (id: string) => {
    const prev = linksRef.current.find((l) => l.id === id);
    setLinks((list) => list.filter((l) => l.id !== id));
    try {
      await getDataService().deleteSidebarLink(id);
    } catch (e) {
      logServiceError("SidebarLinks", "delete", e);
      if (prev) setLinks((list) => [...list, prev]);
    }
  }, []);

  const reorderLinks = useCallback(async (ids: string[]) => {
    const idIndex = new Map(ids.map((id, i) => [id, i] as const));
    setLinks((list) =>
      [...list].sort(
        (a, b) =>
          (idIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (idIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      ),
    );
    try {
      await getDataService().reorderSidebarLinks(ids);
    } catch (e) {
      logServiceError("SidebarLinks", "reorder", e);
    }
  }, []);

  const openLink = useCallback(
    async (link: SidebarLink) => {
      const svc = getDataService();
      if (link.kind === "url") {
        await svc.systemOpenUrl(link.target, defaultBrowserId);
      } else {
        await svc.systemOpenApp(link.target);
      }
    },
    [defaultBrowserId],
  );

  return useMemo(
    () => ({
      links,
      isLoading,
      browsers,
      defaultBrowserId,
      setDefaultBrowserId,
      createLink,
      updateLink,
      deleteLink,
      reorderLinks,
      openLink,
      refreshBrowsers,
    }),
    [
      links,
      isLoading,
      browsers,
      defaultBrowserId,
      setDefaultBrowserId,
      createLink,
      updateLink,
      deleteLink,
      reorderLinks,
      openLink,
      refreshBrowsers,
    ],
  );
}
