# desktop/ — Electron shell

Thin Electron wrapper around the **web** app. Phase 3 of the cross-platform
migration (`.claude/2026-05-04-cross-platform-migration.md` §Phase 3).

## What this is (and isn't)

- This package is a **shell only**: BrowserWindow, native Menu, a tiny IPC
  bridge, `electron-store` for window/theme prefs, and an `electron-updater`
  skeleton (Phase 5 wires the real feed). **No business/UI logic lives here.**
- The renderer reuses `web/` verbatim. `electron.vite.config.ts` points the
  renderer `root` at `../web`, so `web/index.html` -> `web/src/main.tsx` runs
  unchanged and all renderer deps (react / tiptap / dnd-kit / supabase) resolve
  from `web/node_modules`. This structurally avoids a duplicated React.

## Env (Supabase keys)

The renderer reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
(see `shared/src/import-meta.d.ts`). `electron.vite.config.ts` sets
`envPrefix: 'VITE_'` so Vite injects them at dev/build time.

Create `desktop/.env` (gitignored at repo root) with:

```
VITE_SUPABASE_URL=<your supabase project url>
VITE_SUPABASE_ANON_KEY=<your supabase anon key>
```

Vite loads `.env` and `.env.local` alike, so either filename works (the shared
client's "missing env" error mentions `.env.local`; both are equivalent here).
**Never commit real keys.**

## Commands

```bash
cd desktop
npm install          # also runs electron-builder install-app-deps
npm run dev          # electron-vite dev (launches Electron + dev server)
npm run build        # electron-vite build (bundles main/preload/renderer)
npm run dist         # build + electron-builder (creates installers in release/)
npm run build:mac    # macOS arm64 + x64 .dmg (unsigned)
npm run build:win    # Windows x64 NSIS installer (unsigned)
```

## Windows build

```bash
cd desktop
npm install
npm run build:win    # -> release/Life Editor Setup <version>.exe
```

- The app icon is generated from `resources/icon.png` at build time
  (electron-builder converts it to a multi-size `.ico`; no `.ico` is committed).
- **SmartScreen**: the installer is unsigned ($0 policy), so Windows shows
  "Windows protected your PC" on first run. Click "More info" -> "Run anyway".
  This stays until a code-signing cert is purchased (post-completion call,
  see migration SSOT §8).

## Constraints (Risk 1 — keep the shell thin)

- preload `contextBridge` expose functions: **<= 10** (currently 4).
- Single BrowserWindow. `nodeIntegration: false`, `contextIsolation: true`,
  `sandbox: true`.
- IPC payloads are serializable only — never pass functions across the bridge.
- Unsigned builds ($0 policy). Signing/notarization is a post-completion call.
