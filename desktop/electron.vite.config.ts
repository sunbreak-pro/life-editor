import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The renderer reuses the already-assembled web app verbatim. `shared/` is the
// library layer (providers / hooks / design system / DataService / i18n); the
// composed App (App -> MainScreen -> views, AuthScreen) lives in `web/src/`.
// Pointing the renderer `root` at `../web` makes every renderer module — web/src
// plus its deps (tiptap / dnd-kit / supabase / react) — resolve from a single
// place (web/node_modules), which structurally avoids a duplicated React (the
// classic hooks-breaking bug) and keeps desktop free of web's runtime deps.
const webRoot = resolve(__dirname, "../web");
const sharedSrc = resolve(__dirname, "../shared/src/index.ts");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // package.json is "type": "module", so electron-vite would emit the
      // preload as ESM (index.mjs). But a sandboxed preload (sandbox: true)
      // must be CommonJS at runtime. Force a CJS .js output so the security
      // baseline stays on and main can load ../preload/index.js.
      rollupOptions: {
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    // Use web/index.html -> web/src/main.tsx unchanged.
    root: webRoot,
    // web/vite.config.ts is NOT auto-merged by electron-vite, so the same
    // plugins must be declared explicitly here.
    plugins: [react(), tailwindcss()],
    resolve: {
      // Resolve the shared library from source (mirrors web/vite.config.ts).
      alias: {
        "@life-editor/shared": sharedSrc,
      },
      // Guarantee a single React/ReactDOM instance across the renderer graph.
      dedupe: ["react", "react-dom"],
    },
    // electron-vite defaults to the RENDERER_VITE_ prefix; the web app reads the
    // VITE_ vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), so override it to
    // keep parity with web. Keys are injected from desktop/.env at build/dev
    // time and are never committed.
    envPrefix: "VITE_",
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      rollupOptions: {
        input: resolve(webRoot, "index.html"),
      },
    },
  },
});
