import { lazy } from "react";

/*
 * The code-split section bodies (#676 (a)).
 *
 * Two screens carry vendor stacks big enough to dominate the initial chunk:
 * Notes drags in the TipTap editor (core/react/starter-kit + extensions) and
 * Analytics drags in recharts. (Connect was the third, dragging in the d3
 * force/zoom stack, until #1152 retired the section.) Each is reachable only
 * through its own row of SECTION_DESCRIPTORS, so each is loaded with lazy()
 * and rendered behind a <Suspense> boundary there — which is what keeps those
 * bundles out of the first download. The web app's main entry point is a
 * public URL on a phone (D-20260807-main-1), so this is felt, not theoretical.
 *
 * They live in their own module because the descriptor table exports data, and
 * a file that mixes component and non-component exports breaks Fast Refresh
 * (react-refresh/only-export-components — a CI-gating error here).
 *
 * Both are NAMED exports, mapped to the `default` shape lazy() expects.
 * The lockstep guard is web/tests/lazySectionChunks.test.ts: it fails if any
 * of these ever gains a static `import … from` alongside the dynamic one.
 */

export const NotesView = lazy(() =>
  import("./notes/NotesView").then((m) => ({ default: m.NotesView })),
);

export const AnalyticsScreen = lazy(() =>
  import("./analytics/AnalyticsScreen").then((m) => ({
    default: m.AnalyticsScreen,
  })),
);

/*
 * IDLE WARM-UP (#1158 / #1038 案 C).
 *
 * The two declarations above keep the heavy stacks out of the first download,
 * and they pay for it once: the FIRST time the user opens Notes or Analytics,
 * the chunk is fetched while a one-line fallback sits in the page. Nothing
 * prefetched, so that wait is unavoidable — the request only starts when React
 * renders the boundary.
 *
 * So fetch them while nothing else is happening. `import()` populates the
 * module registry, and React.lazy's own `import()` of an already-loaded module
 * resolves from it without touching the network.
 *
 * WHY NOT AT MODULE TOP LEVEL: this file is reached during the entry chunk's
 * own parse, so a bare call there would put the warm-up requests in the same
 * queue as the app's first paint — the one thing #994 measured and #991 went
 * out of its way to protect. Two gates instead: the `load` event (the initial
 * download is done) and then idle (the main thread is free).
 *
 * WHAT IT ACTUALLY COSTS. It is not two chunks — Vite's dependency map fans
 * each of these out to what it statically imports, and the union is every
 * async chunk in the build: NotesView pulls RichTextEditor, and AnalyticsScreen
 * pulls CartesianChart plus the two chart widgets it shares with the briefing
 * panel. Measured on this build from vite's own gzip column, that union is
 * ~272 KB against a ~233 KB entry chunk — it costs MORE than the initial
 * download, and every
 * session pays it, including one that only reads the briefing. That is the
 * trade the Issue asks for, with three guards on it:
 *
 * - SEQUENTIAL, not Promise.all. `requestIdleCallback` measures MAIN-THREAD
 *   idleness, not bandwidth, so on a slow link it can fire while the section's
 *   own REST calls are still in flight. One extra request at a time is a
 *   queue this cannot saturate.
 * - Save-Data is honoured. A user who has asked the browser not to spend their
 *   bytes has not asked for speculative ones, and skipping costs them only the
 *   fallback line they get today.
 * - It does not fire while offline. A failed module fetch is REMEMBERED by the
 *   browser: the module map records the failure, and a later import() of the
 *   same URL rejects off that record without going back to the network (which
 *   is why Vite's own advice for `vite:preloadError` is "reload the page", not
 *   "retry"). Both import sites here resolve to the same URL, so a warm-up
 *   that ran through a tunnel would hand the user's later tap an instant
 *   rejection instead of the download it would have got. `navigator.onLine`
 *   is a weak signal — it only knows about the local interface — but it is
 *   free and it covers the case that actually happens on a phone.
 *
 * NO CLEANUP, deliberately — see the call site in MainScreen.
 *
 * The specifiers are repeated rather than shared with the lazy() calls above.
 * Rollup keys chunks by module id, so two dynamic imports of the same module
 * produce one chunk; factoring them into a shared loader const would instead
 * break web/tests/lazySectionChunks.test.ts, whose guard matches the literal
 * `lazy(() => import("<path>")` text. Each loader narrows to the same single
 * named export the lazy() site uses, so the reachable-export set — and
 * therefore the chunk — is identical either way.
 *
 * This code also runs inside the Electron shell (desktop builds this same
 * renderer). Harmless there — the chunks are on disk — so there is no platform
 * gate to add.
 */

/** How long to wait for a genuinely idle moment before forcing the warm-up. */
const IDLE_TIMEOUT_MS = 4000;
/*
 * Used where requestIdleCallback does not exist. That is not the edge case it
 * looks like: Safari has never shipped it on EITHER macOS or iOS — Technology
 * Preview only, checked against this repo's own caniuse-lite — and the phone's
 * route into this app is the public web URL (D-20260807-main-1). So on the
 * author's own two devices this fixed delay IS the schedule, and the rIC path
 * above belongs to Chromium and Firefox, the Electron shell included. jsdom
 * has none either, which is why the tests take this branch by default and stub
 * rIC to reach the other.
 */
const FALLBACK_DELAY_MS = 2000;

const SECTION_CHUNK_LOADERS: ReadonlyArray<() => Promise<unknown>> = [
  () => import("./notes/NotesView").then((m) => m.NotesView),
  () => import("./analytics/AnalyticsScreen").then((m) => m.AnalyticsScreen),
];

/**
 * Whether it is reasonable to spend bytes on chunks nobody has asked for yet.
 *
 * `navigator.connection` is not in lib.dom.d.ts, hence the local shape; absent
 * means "no preference", which is the warm case (Safari and Firefox implement
 * no connection object at all).
 */
function shouldWarmUp(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData === true) return false;
  return navigator.onLine;
}

async function loadAllChunks(): Promise<void> {
  for (const load of SECTION_CHUNK_LOADERS) {
    try {
      await load();
    } catch {
      // Swallowed so one bad chunk cannot cancel the other. NOT because it is
      // free: see the module-map note in the header — the boundary's own
      // import() of a URL that failed here will reject off that record rather
      // than retry. The offline gate is what keeps that rare.
    }
  }
}

/**
 * Memoised so the whole thing runs at most once per page. That is also the
 * StrictMode guard, and it has to be the guard: an effect cleanup that
 * cancelled the scheduled callback would be run by StrictMode's throwaway
 * first mount, and the second mount would find this promise already set and do
 * nothing — the warm-up would silently never fire in dev.
 */
let warmup: Promise<void> | null = null;

/** Fetch the code-split section bodies once the page is loaded and idle. */
export function prefetchLazySections(): Promise<void> {
  warmup ??= new Promise<void>((resolve) => {
    if (!shouldWarmUp()) {
      resolve();
      return;
    }
    const run = () => {
      void loadAllChunks().then(resolve);
    };
    const schedule = () => {
      // Reached through `window.` on purpose: TypeScript declares
      // requestIdleCallback as a bare global too, so a plain identifier
      // type-checks and then throws ReferenceError where it does not exist.
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
      } else {
        window.setTimeout(run, FALLBACK_DELAY_MS);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
  });
  return warmup;
}
