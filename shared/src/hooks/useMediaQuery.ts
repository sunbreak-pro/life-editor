import { useEffect, useState } from "react";

/*
 * matchMedia wrapper (W5 app shell). Powers the AppShell's wide↔narrow
 * switch. Pure browser API (no SSR in the Web/Electron/Capacitor hosts),
 * but `window.matchMedia` is undefined under jsdom (vitest) — so the hook
 * falls back to `fallback` (default `true` = wide) when matchMedia is
 * unavailable, keeping the shell on its information-dense layout rather
 * than collapsing to the mobile tab bar in tests.
 *
 * No DataService / i18n here (§3.1 / §6.4) — this is a pure display hook.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const getMatches = (): boolean => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return fallback;
    }
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Sync once on mount/query-change in case the media state moved between
    // the initial render and the effect running.
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
