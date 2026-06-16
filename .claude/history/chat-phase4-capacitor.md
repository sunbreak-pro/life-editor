# HISTORY (chat-phase4-capacitor)

### 2026-06-15 - Phase 4 Capacitor 包装: mobile/ scaffold（自律スコープ）

#### 概要

移行 SSOT Phase 4。`shared/`（= `web/` ビルド）を Capacitor 8 で包み iOS / Android プロジェクトを生成する scaffold。Phase 3（Electron）と同型に、Capacitor は `web/dist`（web の Vite ビルド出力）を `webDir` として包む薄い包装。ネイティブ検証（Simulator / AVD / 実機 7日署名）は Linux 環境では不可のため 🛑 ユーザー Mac へハンドオフ。$0 厳守（無料 Apple ID + 7日署名・Apple Developer Program 不加入・Apple Sign-in 不実装＝Email+Password 流用）。

#### 変更点

- **mobile/ 新規**: Capacitor 8（@capacitor/core/cli/ios/android 8.4.0 + typescript）。`capacitor.config.ts` = `appId: com.lifeeditor.app` / `appName: Life Editor` / `webDir: ../web/dist`（web のビルド出力を指す・`server.url` なし＝バンドル資産をロード）。`npx cap add ios` / `npx cap add android` で native プロジェクト生成・コミット（80 files）
- **sync パイプライン**: `npx cap sync` が **ios/android 両方** で exit 0（"Sync finished in 0.093s"）。Capacitor 8 の iOS は **Swift Package Manager（Package.swift）採用で CocoaPods 不要** → Linux でも pod install なしに sync 完走。`mobile/package.json` に build:web / sync / open:ios / open:android スクリプト整備
- **isNativeMobile() アダプタ**: `shared/src/utils/platform.ts` に追加（`window.Capacitor?.isNativePlatform()` を読む runtime 検出。`@capacitor/*` を **import しない**＝shared に mobile 固有 import が漏れず DataService 境界不変）。`shared/src/index.ts` から export。`cd shared && npm run build` exit 0
- **Provider 配線は申し送り（ユーザー判断）**: Mobile 省略 Provider のうち現行 web 実在は Audio / ShortcutConfig の2つのみ（CalendarTags は DU-F 削除済 / ScreenLock / FileExplorer は web 未実装）。配線は `web/src/MainScreen.tsx`（並行 stream E = web S8-S9 領域）の編集が必要 → 衝突回避で「アダプタのみ提供・配線は stream E と調整」をユーザーが選択
- **Android safe-area**: targetSdk 36（edge-to-edge 強制）に対し `styles.xml` の AppTheme.NoActionBar に `android:fitsSystemWindows=true` を追加（native fallback・mobile/android/ 内で完結）。richer fix（viewport-fit=cover + CSS env() in web/index.html）は stream E coordination の申し送り
- **splash / icon**: Capacitor 生成のプレースホルダ（iOS AppIcon.appiconset / Splash.imageset、Android mipmap launcher + splash.png）をそのまま採用（「プレースホルダ可」）
- **.gitignore**: `mobile/node_modules/` 追加。derived 資産（ios/android の public/・生成 capacitor.config.json・build 出力・Pods）は Capacitor 生成の各 .gitignore が除外

#### 検証

- `cd web && npm run build` exit 0（web/dist 生成）
- `cd mobile && npx cap sync` exit 0（ios + android 両方・SPM で CocoaPods 不要）
- `cd shared && npm run build` exit 0（isNativeMobile 追加後も型崩れなし）
- スコープ: staged 80 files すべて `mobile/` `shared/` `.claude/` `.gitignore` 内。`frontend/` 0 changes・`web/src/` 0 changes（stream E 非干渉）・secrets 0

#### ハンドオフ（🛑 ユーザー Mac・Phase 4 完了判定）

1. `cd web && npm run build && cd ../mobile && npx cap sync`（Mac で iOS の SPM 解決）
2. iOS Simulator: `npx cap open ios` → Xcode 起動（無料 Apple ID + 7日署名・自分の端末/Simulator のみ）
3. Android AVD: `npx cap open android` → Android Studio
4. golden path: iOS / Android から Supabase ログイン（Email+Password）→ Tasks CRUD
5. Mobile 省略 Provider 配線（stream E と調整）+ web/index.html safe-area（viewport-fit=cover）
</content>
