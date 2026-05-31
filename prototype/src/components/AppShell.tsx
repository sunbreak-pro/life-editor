import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ShellProvider, useShell } from "../context/ShellContext";
import { C } from "../lib/theme";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";
import { SearchOverlay } from "./SearchOverlay";

/**
 * App-level layout (IA v3 — doc 12). Renders the invariant chrome (Header +
 * BottomTabBar + SearchOverlay) once and slots each section into `<Outlet/>`,
 * so the Header never remounts across section/slide changes.
 */
const SECTION_TITLES: Record<string, string> = {
  "/schedule": "予定",
  "/work": "作業",
  "/materials": "資料",
  "/settings": "設定",
  "/trash": "ゴミ箱",
  "/cross-search": "横断検索",
};

function sectionTitle(pathname: string): string {
  if (SECTION_TITLES[pathname]) return SECTION_TITLES[pathname];
  const prefix = Object.keys(SECTION_TITLES).find((p) =>
    pathname.startsWith(p),
  );
  return prefix ? SECTION_TITLES[prefix] : "Life Editor";
}

function ShellInner() {
  const { openSidebar, openSearch, searchOpen, closeSearch, closeSidebar } =
    useShell();
  const location = useLocation();

  // Reset transient overlays whenever the section changes so a drawer/search
  // left open on one section never bleeds into the next.
  useEffect(() => {
    closeSidebar();
    closeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: C.base, color: C.text }}
    >
      <AppHeader
        title={sectionTitle(location.pathname)}
        onMenu={openSidebar}
        onSearch={openSearch}
      />
      <main
        className="flex-1 min-h-0 overflow-hidden"
        style={{ position: "relative" }}
      >
        <Outlet />
      </main>
      <BottomTabBar />
      <SearchOverlay open={searchOpen} onClose={closeSearch} />
    </div>
  );
}

export function AppShell() {
  return (
    <ShellProvider>
      <ShellInner />
    </ShellProvider>
  );
}
