import type { VitePWAOptions } from "vite-plugin-pwa";

/*
 * The Service Worker build (#2334 — plan 2026-10-21-offline-cache.md P1c step
 * 1). A file of its own so `web/tests/pwaConfig.test.ts` can pin these choices.
 * web/vite.config.ts is the only reader: Desktop builds with its own
 * electron-vite config and never sees this plugin, which is why the app must not
 * import `virtual:pwa-register` (its build would fail on it).
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  strategies: "generateSW",
  /*
   * A new version waits until the user says so. Taking over by itself would
   * reload or swap files under a page where someone may be typing.
   */
  registerType: "prompt",
  // Registered from the bundle (src/pwa/serviceWorker.ts): the CSP is
  // `script-src 'self'`, and the check for the shells has to run first.
  injectRegister: false,
  // web/public/manifest.webmanifest is the one manifest, as it was before.
  manifest: false,
  workbox: {
    // Everything in web/dist, lazy chunks included. `_headers` has no extension.
    globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
    // A lazy chunk above the 2 MiB default would be left out without a word,
    // and the screen that needs it would not open offline.
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    // Vite names these by content, so a revision query would only re-download.
    dontCacheBustURLsMatching: /^assets\//,
    // Any navigation gets the app: `?legal=` is read by the page, and a redirect's
    // `#…` never reaches a Service Worker. The real URL stays in the address bar.
    navigateFallback: "index.html",
    // Same page either way, so old bundles do not pile up on the device.
    cleanupOutdatedCaches: true,
    /*
     * No `runtimeCaching`, on purpose. The worker answers only for the files
     * listed above and for navigations. Every Supabase request (REST, Auth,
     * Realtime, Storage) goes straight to the network, and the data on this
     * device lives in IndexedDB under its owner's id.
     */
  },
};
