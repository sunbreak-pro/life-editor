# MEMORY (chat-phase4-capacitor)

> 🧹 2026-06-27 chat-main 棚卸し: PR #88 は **MERGED** 済（gh 確認）。worktree/branch prune 済でレーン休眠。本ファイルを実態へ同期（ユーザー認可の cross-lane reconciliation）。

## 進行中

（なし）

## 直近の完了

- Phase 4 — Capacitor 包装（`mobile/`・iOS/Android シミュレータまで）✅（2026-06-15・**PR #88 merged**）— Capacitor 8 で `web/dist` を包み ios/+android/ 生成、`npx cap sync` 両 platform exit 0（SPM 採用で CocoaPods 不要・Linux でも完走）。Provider 配線は stream E 衝突回避で「アダプタ `isNativeMobile()` のみ・配線は申し送り」

## 予定

- 🛑 ネイティブ検証（Mac・merge 済の未確認分）: iOS Simulator / Android AVD / 実機 7日署名で起動 → Supabase ログイン → Tasks golden path
- Mobile 省略 Provider 配線（stream E coordination・`web/src/MainScreen.tsx` で `isNativeMobile()` 出し分け）。⚠️ connect-link-ui レーンが現在 `MainScreen.tsx` を編集中 — 配線時は要調整
- web/index.html に `viewport-fit=cover` + CSS `env(safe-area-inset-*)`（safe-area richer fix）
