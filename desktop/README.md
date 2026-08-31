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
npm run build:win    # -> release/Life Editor-<version>-x64-setup.exe
```

The app icon is generated from `resources/icon.png` at build time
(electron-builder converts it to a multi-size `.ico`; no `.ico` is committed).

## macOS build

```bash
cd desktop
npm install
npm run build:mac    # -> release/Life Editor-<version>-arm64.dmg (+ -x64.dmg)
```

The app icon comes from `resources/icon.icns` (committed; `mac.icon` points at
it). Unlike Windows there is no conversion step — electron-builder copies the
`.icns` straight into the bundle.

`electron-builder.yml` declares both `arm64` and `x64`, but only **arm64 is an
accepted build**. The release runner is Apple Silicon, so an x64 `.dmg` is a
cross-build that nothing ever launches before it reaches a user; the release
workflow therefore uploads it as a plain artifact and keeps it off the GitHub
Release. Whether to ship Intel builds at all is an open call
(`D-20260830-main-1`).

## Releasing (distribution)

Installers are **not** built by `ci.yml` — that workflow stops at
`electron-vite build`, because NSIS does not run on the Linux runner and paying
for an OS matrix on every PR buys nothing. Packaging lives in its own workflow:
[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml).

```
git tag desktop-v<version>      # must match desktop/package.json version
git push origin desktop-v<version>
```

That runs the per-OS `build` jobs (installer + upload-artifact), then a
`release` job that collects every artifact into a **draft** GitHub Release.
Publishing the draft is a deliberate human step — either the "Publish release"
button or `gh release edit desktop-v<version> --draft=false`.

`workflow_dispatch` runs the same build without creating a Release, which is the
way to check a workflow change without minting a version.

Two things are worth knowing before you cut a tag:

- **The Supabase URL and anon key are baked into the bundle at build time**
  (Vite rewrites `import.meta.env` into string literals — there is no runtime
  hook to read them later). The workflow injects them from the repository
  secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, the same two
  `deploy-web.yml` already uses. A build with those missing still *succeeds* and
  produces a perfectly normal-looking installer whose window is blank, so the
  workflow has a `verify renderer bundle is not empty` step that fails the job
  when the configured Supabase host is absent from the emitted bundle.
- **Bump `desktop/package.json` first.** `version` is interpolated into
  `artifactName`, so the tag and the asset names have to agree.

## Installing an unsigned build

Nothing here is code-signed ($0 policy — migration SSOT §8), so each OS puts a
warning in front of the first launch. This is expected, not a broken download.

**Windows**: SmartScreen shows "Windows protected your PC". Click
**More info** -> **Run anyway**. The installer is per-user and asks where to
install (`oneClick: false`). This stays until a code-signing certificate is
purchased (post-completion call).

**macOS**: worse than a warning — Gatekeeper refuses outright with **"Life
Editor is damaged and can't be opened"**. Nothing is damaged. Since Big Sur,
macOS requires a signature to *exist* on arm64 binaries, and `identity: null`
means there is none, so the quarantine check has nothing to evaluate and fails
closed. Two ways past it, both one-time:

1. Open the app once, then **System Settings -> Privacy & Security**, scroll to
   the blocked-app notice and press **Open Anyway**.
2. Or strip the quarantine flag from a terminal:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Life Editor.app"
   ```

Ad-hoc signing (`mac.identity: "-"`) is *not* a fix for this: an ad-hoc
signature is only valid on the machine that produced it, so it would trade one
broken download for a confusing one. The real fix is an Apple Developer Program
membership ($99/year) for signing plus notarization, which the $0 policy defers
until after completion.

`electron-updater` is deliberately left as a no-op skeleton. Auto-updating an
unsigned binary means anyone who can spoof the update feed can push arbitrary
code onto the machine, so the feed gets enabled in the same change as signing —
never before it.

## Constraints (Risk 1 — keep the shell thin)

- preload `contextBridge` expose functions: **<= 10** (currently 4).
- Single BrowserWindow. `nodeIntegration: false`, `contextIsolation: true`,
  `sandbox: true`.
- IPC payloads are serializable only — never pass functions across the bridge.
- Unsigned builds ($0 policy). Signing/notarization is a post-completion call.
