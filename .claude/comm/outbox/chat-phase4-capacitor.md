# Outbox — chat-phase4-capacitor

> 発信箱（書くのは本人のみ・読むのは全員）。並行ストリーム A 監査 / C initplan / D bcrypt / E web S8-S9 / phase3-electron への申し送りを含む。

## 2026-06-15 — Phase 4 Capacitor scaffold 完了 → draft PR #88

**ブランチ**: `claude/phase4-capacitor-scaffold-p93dex`（base=main・056c506 から）
**計画書**: `.claude/docs/vision/plans/2026-06-15-phase4-capacitor.md`
**PR**: https://github.com/sunbreak-pro/life-editor/pull/88 (draft)

### やったこと（🤖 自律スコープ）

- `mobile/` 新規: Capacitor 8 で `web/dist` を包み ios/ + android/ 生成・コミット（80 files）
- `capacitor.config.ts`: appId `com.lifeeditor.app` / appName `Life Editor` / `webDir: ../web/dist`
- `npx cap sync` が **ios/android 両方 exit 0**（Capacitor 8 iOS は SPM 採用＝CocoaPods 不要、Linux でも sync 完走）
- `shared/src/utils/platform.ts` に `isNativeMobile()` 追加（`window.Capacitor` runtime 読み・`@capacitor/*` import なし＝shared に mobile 固有 import 漏れなし）＋ barrel export
- Android safe-area: `styles.xml` に `fitsSystemWindows=true`（targetSdk36 edge-to-edge fallback）
- splash/icon は Capacitor 生成プレースホルダ
- 検証: web build / cap sync / shared build すべて exit 0。`frontend/` 0 changes・`web/src/` 0 changes

### ⚠️ @chat-(web S8-S9 stream E) への申し送り（要調整）

1. **Mobile 省略 Provider 配線**: `web/src/MainScreen.tsx` で `isNativeMobile()` を使い **AudioProvider / ShortcutConfigProvider** をネイティブ時に出し分けたい（現行 web 実在の省略 Provider はこの2つのみ。CalendarTags は DU-F 削除済 / ScreenLock・FileExplorer は web 未実装）。`isNativeMobile` は `@life-editor/shared` から import 可。**MainScreen は stream E 領域のため本レーンでは触らず申し送り**（ユーザー判断 2026-06-15）
2. **safe-area richer fix**: `web/index.html` の viewport に `viewport-fit=cover` を足し、CSS で `env(safe-area-inset-*)` を使うのが本筋（native の fitsSystemWindows は暫定 fallback）。これも stream E 領域

### 🛑 ユーザー Mac へハンドオフ（Phase 4 完了判定 = SSOT §Phase 4）

Linux 環境では iOS/Android ネイティブ build/run 不可。Mac で:
1. `cd web && npm run build && cd ../mobile && npx cap sync`
2. iOS Simulator: `npx cap open ios`（無料 Apple ID + 7日署名・自分の端末/Sim のみ）
3. Android AVD: `npx cap open android`
4. golden path: iOS/Android → Supabase ログイン（Email+Password）→ Tasks CRUD

通過後に計画書 COMPLETED→archive + PR #88 merge（🛑 ユーザー）。
</content>
