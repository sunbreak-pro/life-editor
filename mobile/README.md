# mobile/ — Capacitor shell (Phase 4)

Thin Capacitor 8 wrapper that packages the **web/ Vite build** (`web/dist`) as
native iOS / Android apps. Like `desktop/` (Electron, Phase 3), this is a thin
shell: **all business logic lives in `shared/`**, and the assembled app is
`web/`. See `.claude/2026-05-04-cross-platform-migration.md` §Phase 4 and
`.claude/docs/vision/plans/2026-06-15-phase4-capacitor.md`.

## What Capacitor wraps

`capacitor.config.ts` sets `webDir: "../web/dist"`. `cap copy`/`cap sync` copies
that build output into `ios/App/App/public` and
`android/app/src/main/assets/public` (both gitignored — they are regenerated).

```
shared/  (React + TS — business logic, design system, DataService)
  └─ web/  (Vite app that assembles shared → web/dist)
        └─ mobile/  (Capacitor → ios/ + android/ wrap web/dist)
```

## Build / sync pipeline

```bash
# 1. produce the web bundle Capacitor copies
cd web && npm run build              # → web/dist

# 2. copy it into the native projects (run from mobile/)
cd ../mobile && npx cap sync         # copies web/dist + updates ios + android
```

`npx cap sync` runs on Linux for **both** platforms: Capacitor 8 iOS uses Swift
Package Manager (Package.swift), so no CocoaPods / `pod install` is required to
sync. The native **build + run** still needs macOS tooling (see handoff).

## Config

| Key       | Value                |
| --------- | -------------------- |
| `appId`   | `com.lifeeditor.app` |
| `appName` | `Life Editor`        |
| `webDir`  | `../web/dist`        |

No `server.url` — native shells load the bundled assets and reach Supabase over
the network at runtime. Auth = Email + Password (Apple Sign-in deferred to
post-completion, migration SSOT §3).

## 🛑 Native build / run — macOS handoff ($0, simulator-only)

This repo was scaffolded on Linux; the iOS/Android native toolchains are
macOS-only. On a Mac:

```bash
cd web && npm run build && cd ../mobile && npx cap sync

# iOS (free Apple ID + 7-day signing, simulator + own iPhone only)
npx cap open ios        # opens Xcode → run on Simulator / device

# Android (Android Studio AVD)
npx cap open android    # opens Android Studio → run on AVD / device
```

- **iOS**: needs Xcode. Free Apple ID + 7-day signing for own device only.
  **No** Apple Developer Program ($99/yr) — friend distribution is post-completion.
- **Android**: needs Android Studio + SDK (compileSdk/targetSdk 36).

## Notes

- The 5 **Mobile 省略 Provider** (CLAUDE.md §2 — Audio / ScreenLock /
  FileExplorer / CalendarTags / ShortcutConfig) are gated via
  `isNativeMobile()` (`shared/src/utils/platform.ts`). The host wiring in
  `web/src/MainScreen.tsx` is a stream-E-coordinated follow-up (see plan).
- Android safe-area: a `fitsSystemWindows` fallback in `styles.xml` handles the
  targetSdk-36 edge-to-edge enforcement; the richer `viewport-fit=cover` fix
  belongs in `web/index.html` (stream E).
- Splash / launcher icons are the Capacitor-generated placeholders.
