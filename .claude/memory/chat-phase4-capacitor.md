# MEMORY (chat-phase4-capacitor)

## 進行中

### 🔧 Phase 4 — Capacitor 包装（iOS / Android シミュレータまで）（着手日: 2026-06-15）

**対象**: `mobile/`（新規）・`shared/src/utils/platform.ts` + `shared/src/index.ts`（小アダプタ）・`.gitignore`
**計画書**: `.claude/docs/vision/plans/2026-06-15-phase4-capacitor.md`（IN-PROGRESS）

- 前回: —
- 現在: 自律スコープ scaffold 実装+検証完了。Capacitor 8 で `web/dist` を包み ios/ + android/ 生成、`npx cap sync` が両 platform で exit 0（iOS は Capacitor 8 の SPM 採用で CocoaPods 不要 → Linux でも sync 完走）。Provider 配線は stream E 衝突回避でユーザー判断「アダプタのみ・配線は申し送り」→ `isNativeMobile()` のみ提供。draft PR 作成予定（base=main）
- 次: 🛑 ユーザー Mac へハンドオフ — iOS Simulator / Android AVD / 実機 7日署名で起動 → Supabase ログイン → Tasks golden path。+ stream E と調整して `web/src/MainScreen.tsx` で `isNativeMobile()` を使い Audio/ShortcutConfig Provider を出し分け

## 直近の完了

（なし）

## 予定

- 🛑 ネイティブ検証（Mac）通過後に計画書を COMPLETED→archive + PR merge
- Mobile 省略 Provider 配線（stream E coordination・MainScreen）
- web/index.html に `viewport-fit=cover` + CSS `env(safe-area-inset-*)`（safe-area の richer fix・stream E territory）
</content>
