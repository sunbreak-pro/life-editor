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
