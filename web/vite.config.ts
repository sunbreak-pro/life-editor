import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // react / react-dom / react-i18next / i18next exist in BOTH
    // web/node_modules and shared/node_modules (shared keeps its own copies for
    // its own vitest suite). Because the `@life-editor/shared` alias below pulls
    // shared in FROM SOURCE, without dedupe vite resolves shared's bare imports
    // against shared/node_modules and web's against web/node_modules → two React
    // copies → "Invalid hook call / more than one copy of React" at runtime
    // (react-i18next's <I18nextProvider> useMemo hits a null dispatcher; the
    // shared components' useTranslation also miss the Provider's context).
    // Force a single instance of each — same reason the Electron renderer's
    // electron-vite config dedupes react/react-dom.
    dedupe: ["react", "react-dom", "react-i18next", "i18next"],
    alias: {
      // Consume the cross-platform layer from source (Phase 1).
      // Packaged build / publishing is decided in a later phase.
      "@life-editor/shared": fileURLToPath(
        new URL("../shared/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    // Establish a regression baseline so chunk bloat surfaces in CI output.
    chunkSizeWarningLimit: 600,
    /*
     * No manualChunks (#991).
     *
     * Naming a vendor as its own chunk splits the FILE, not the download.
     * Rollup still has to preload every chunk the entry graph reaches, so
     * `@tiptap → "editor"` produced a tidy 356 KB file that index.html then
     * listed under <link rel="modulepreload"> — the same bytes on the wire,
     * now in two requests. Worse, it hid the problem: the index chunk looked
     * smaller in the build output while the initial download had not moved.
     *
     * What actually moves bytes is a dynamic import boundary, and the ones
     * that matter are now in place: Notes / Analytics / Connect (#676 (a)),
     * the TipTap editor (notes/LazyRichTextEditor.tsx) and the briefing's two
     * recharts widgets (shared BriefingVizPanel). With those, rollup's own
     * chunking follows the boundaries instead of fighting them — vendors land
     * in whichever async chunk needs them, and a vendor two async chunks share
     * becomes a common chunk neither preloads.
     *
     * Measured on this branch: the initial download went from 2,090,518 B
     * across 5 preloaded files to 1,343,984 B in one — gzip 586,034 →
     * 360,518 B, a 38.5% cut. Removing manualChunks on its own was worth
     * ~0.1% (#797); it only pays off next to the boundaries.
     */
  },
});
