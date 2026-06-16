import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Capacitor config (Phase 4 — mobile wrapper).
 *
 * Like the Electron shell (desktop/, Phase 3), the Capacitor shells are thin
 * wrappers: ALL business logic lives in shared/ and the assembled app is the
 * web/ Vite build. Capacitor bundles `web/dist` into the native iOS/Android
 * projects, so `webDir` points at web/'s build output. Rebuild + re-bundle:
 *   cd web && npm run build      # produces web/dist (what Capacitor copies)
 *   cd mobile && npx cap sync    # copies web/dist into ios/ + android/
 *
 * No `server.url` is set: native shells load the bundled assets offline-of-host
 * (Supabase is still reached over the network at runtime). Auth is Email +
 * Password (Apple Sign-in is deferred to post-completion — migration SSOT §3).
 */
const config: CapacitorConfig = {
  appId: "com.lifeeditor.app",
  appName: "Life Editor",
  // Relative to this config's directory (mobile/). web/ is a sibling package,
  // so the build output resolves to <repo>/web/dist.
  webDir: "../web/dist",
};

export default config;
