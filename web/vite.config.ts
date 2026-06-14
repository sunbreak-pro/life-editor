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
    rollupOptions: {
      output: {
        // Split heavy vendors out of the index chunk. Only packages that
        // actually exist in package.json are referenced here.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/")) {
            return "react-vendor";
          }
          if (id.includes("/@dnd-kit/")) return "dnd";
          // @tiptap/* bundles ProseMirror (@tiptap/pm), the heaviest group.
          if (id.includes("/@tiptap/")) return "editor";
          if (id.includes("/@supabase/")) return "supabase";
          return undefined;
        },
      },
    },
  },
});
