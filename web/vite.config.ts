import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
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
