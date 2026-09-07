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
  `deploy-web.yml` already uses. A build with those missing still _succeeds_ and
  produces a perfectly normal-looking installer whose window is blank, so the
  workflow has a `verify renderer bundle is not empty` step that fails the job
  when the configured Supabase host is absent from the emitted bundle.
- **Bump `desktop/package.json` first.** `version` is interpolated into
  `artifactName`, so the tag and the asset names have to agree.

You can rehearse that guard locally before spending a tag on it — the same two
commands the workflow runs, with a throwaway host:

```bash
cd desktop
VITE_SUPABASE_URL=https://probe.supabase.co npm run build
cd ..
grep -rqF probe.supabase.co desktop/out/renderer/assets/ && echo baked
```

Re-run `npm run build` with the variable unset and the grep stops matching while
the build still exits 0 — which is exactly the failure the guard exists for.
A `desktop/.env` works the same way as the exported variable (measured: despite
the renderer `root` pointing at `../web`, `envDir` still resolves to `desktop/`).

## Installing an unsigned build

Nothing here is code-signed ($0 policy — migration SSOT §8), so each OS puts a
warning in front of the first launch. This is expected, not a broken download.

**Windows**: SmartScreen shows "Windows protected your PC". Click
**More info** -> **Run anyway**. The installer is per-user and asks where to
install (`oneClick: false`). This stays until a code-signing certificate is
purchased (post-completion call).

**macOS**: worse than a warning — Gatekeeper refuses outright with **"Life
Editor is damaged and can't be opened"**. Nothing is damaged. Two ways past it,
both one-time:

1. Open the app once, then **System Settings -> Privacy & Security**, scroll to
   the blocked-app notice and press **Open Anyway**.
2. Or strip the quarantine flag from a terminal:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Life Editor.app"
   ```

**That refusal only fires when the download carries `com.apple.quarantine`**
(measured 2026-09-07). Gatekeeper evaluates a bundle because of that flag, so
with no flag there is no evaluation and the app opens silently. LaunchServices
attaches it — browsers, Mail — while `gh run download` and `curl` do not. Every
recipient of a Release download is on the flagged path, so the steps above stay
mandatory in the handoff note; a maintainer pulling a CI artifact will just
never see what they are describing.

What the flag exposes is not a _missing_ signature but a _broken_ one. Electron's
own binary ships a linker-produced ad-hoc signature, so `codesign -dv` on the
packaged app reports `Signature=adhoc` and `Sealed Resources=none`, and
`spctl -a -vv` rejects it with `code has no resources but signature indicates
they must be present`. Re-signing ad-hoc on purpose (`mac.identity: "-"`) does
not fix that either: an ad-hoc signature is only valid on the machine that
produced it, so it would trade one broken download for a confusing one. The real
fix is an Apple Developer Program membership ($99/year) for signing plus
notarization, which the $0 policy defers until after completion.

`electron-updater` is deliberately left as a no-op skeleton. Auto-updating an
unsigned binary means anyone who can spoof the update feed can push arbitrary
code onto the machine, so the feed gets enabled in the same change as signing —
never before it.

## Accepting a build on a real machine

A green workflow only proves the installer was _produced_. What it cannot see is
whether the thing it produced actually runs, so every release gets walked
through on a real machine before the draft is published. Take the installer from
the run's artifact (or the draft Release), never a local `npm run dist` build —
the point is to accept the exact bytes users will get.

Windows:

```bash
gh run download <run-id> -n desktop-windows -D ./accept
./accept/"Life Editor-<version>-x64-setup.exe" /S     # silent, per-user
```

macOS (walked through on Apple Silicon, 2026-09-07):

```bash
gh run download <run-id> -n desktop-macos -D ./accept
hdiutil attach "./accept/Life Editor-<version>-arm64.dmg" -nobrowse
cp -R "/Volumes/Life Editor <version>-arm64/Life Editor.app" /Applications/
hdiutil detach "/Volumes/Life Editor <version>-arm64"
open -a "/Applications/Life Editor.app"
```

Do not substitute a local `npm run build:mac` for this. Beyond accepting bytes
users will never receive, electron-builder's real DMG step needs several GB of
scratch space, and filling the disk takes the whole shell down with it. Also
note that an app already sitting at `/Applications/Life Editor.app` (an older
build, or the retired Tauri one) is not replaced — move it out first.

Then check, in order:

1. **The installed app is the version you meant.** Windows: `Life Editor
<version>` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`.
   macOS: `CFBundleShortVersionString` from
   `defaults read "/Applications/Life Editor.app/Contents/Info.plist"` — which
   also distinguishes this shell (`com.life-editor.app`, ~240 MB, has
   `Contents/Frameworks/Electron Framework.framework`) from the retired Tauri
   app (`com.lifeEditor.app.newlife`, ~26 MB, no Frameworks).
2. **The bundle is not hollow.** `resources/app.asar` contains the Supabase host
   the app is supposed to talk to. The workflow guard already checked this on
   the runner; this re-checks it survived packaging.
3. **Four processes, not one.** Electron starts as ~4 processes (main, GPU,
   renderer, utility). A shell that crashes on boot still leaves one alive for a
   moment, so "the process exists" is not a launch check — count them (#545).
4. **The window paints the sign-in card**, not a blank frame. A blank window is
   the signature of a build whose Supabase env went missing.
5. **A round trip reaches the server.** Submit a deliberately wrong
   address/password. The card must answer **"Email or password is incorrect"**,
   not "Authentication failed. Please wait a moment and try again." The
   difference is the whole test: `AuthScreen.tsx::errorKeyFor` only picks the
   first message when it matches Supabase's literal `Invalid login credentials`
   reply, and falls back to the second for anything it cannot recognise —
   including a request that never arrived. So the precise wording is the
   evidence that the packaged `file://` renderer really reached Supabase. Dev
   builds pass this trivially; packaged ones are where origin/CSP problems would
   first show up.
6. **Sign in for real and add / edit / delete a Todo.** This is the part that
   needs a human with an account, and it is what the acceptance ultimately
   certifies.

Two more that only macOS can answer, since Windows generates its icon at build
time and this is the one path where a committed `.icns` is used verbatim:

7. **The Dock icon is the app's own**, i.e. `resources/icon.png` rendered from
   `resources/icon.icns`, not a generic Electron placeholder.
8. **A tray icon sits in the menu bar.** That proves `extraResources` shipped
   the tray image and that the main process resolved it from
   `process.resourcesPath` — the prod half of a path that dev reads from the
   repo instead.

If you script steps 3-5 rather than eyeballing them, make the script
**DPI-aware** first (`SetProcessDpiAwarenessContext(-4)`). Windows lies to
DPI-unaware processes: on a 150 %-scaled display `GetWindowRect` reports a
3840x2088 window as 2560x1392 and `Cursor.Position` takes those same shrunken
coordinates, so screenshots look mysteriously off-centre and synthetic clicks
land a third of the screen away from the field you aimed at. Nothing is wrong
with the app when that happens.

On macOS, do not script them at all with screen-wide synthetic clicks
(`System Events` `click at {x, y}`). Those land wherever the foreground window
happens to be, and `activate` does not guarantee you are still it a moment
later; during the 2026-09-07 acceptance one such click went into an unrelated
app's checkout screen. Screenshots (`screencapture`) and process counts
(`pgrep -f "Life Editor"`) observe without touching anything, which covers steps
3, 4, 7 and 8. Steps 5 and 6 need credentials, so they belong to a human anyway.

## Constraints (Risk 1 — keep the shell thin)

- preload `contextBridge` expose functions: **<= 10** (currently 4).
- Single BrowserWindow. `nodeIntegration: false`, `contextIsolation: true`,
  `sandbox: true`.
- IPC payloads are serializable only — never pass functions across the bridge.
- Unsigned builds ($0 policy). Signing/notarization is a post-completion call.
