# Plan: Service Error Handler Hook（S-5）

**Status:** PLANNED
**Created:** 2026-04-18
**Project:** /Users/newlife/dev/apps/life-editor
**Verdict source:** `.claude/archive/2026-04-18-deferred-items-reevaluation.md` Item 4 (S-5)
**Related requirements:** [`tier-2-supporting.md`](../docs/requirements/tier-2-supporting.md) §Toast Known Issues

---

## Context

`catch (e) { console.warn(...) }` が `TimerContext` 10 箇所以上、`SyncContext`, `MobileCalendarView` など分散。`ToastProvider` は両プラットフォームで存在するが活用されていない（silent failure）。§Toast Known Issues の保留 S-5 に記載済。

## Verdict

**Keep** — Value Proposition「ローカル SSOT が信頼できる（§3 V2）」を silent failure が直接損なうため。共通ヘルパで統一する価値は明確。

### 判定根拠

- V2「オフライン完全動作 + マルチデバイス同期」は**失敗が見える**ことが前提。silent failure は V2 と矛盾
- 2026-04-18 に SyncContext のみ toast 統合済み。残りも同じパターンで適用可能
- 共通ヘルパにすると i18n キーの統一（`errors.*`）も進む → §9.5 i18n 規約との整合

## 設計方針

- **フック形: `useServiceErrorHandler()`** が `{ handle: (err, key, opts?) => void }` を返す
- 引数: (err, i18n key, { silent?: boolean, rateLimitMs?: number })
- 既定: toast 表示 + console.error（dev） + rate limit 5 秒以内の同一 key 重複抑止
- silent オプション: 軽微な失敗（バックグラウンド backfill 等）は console のみ

## 境界（Non-goals）

- ❌ エラー自動リトライ（リトライはドメイン側の責務）
- ❌ Sentry / Crashlytics 等の外部レポート統合
- ❌ モーダルでの重大エラー告知（Modal は別途）

## Steps

- [ ] S1. `frontend/src/hooks/useServiceErrorHandler.ts` を新設（上記シグネチャ）
- [ ] S2. i18n `en.json` / `ja.json` に `errors.*` セクションを追加（timerStartFailed / syncFailed / routineUpdateFailed 等）
- [ ] S3. rate limit / dedup ロジックを実装（`useRef<Map<key, lastShownAt>>`）
- [ ] S4. 段階移行:
  - `TimerContext` の 10+ catch → `handle(e, 'errors.timer.xxx')` に置換
  - `SyncContext` の既存 toast 直呼び → ヘルパ経由に統一
  - `MobileCalendarView` 他の console.warn → `handle(e, 'errors.xxx', { silent: false })` へ
- [ ] S5. hook の単体テスト（rate limit / silent / i18n フォールバック）
- [ ] S6. Verification: 同じ操作を 10 回連打しても toast が 1 回しか出ないこと（rate limit 動作確認）

## Verification

- [ ] `useServiceErrorHandler` が作成され単体テスト pass
- [ ] TimerContext / SyncContext / MobileCalendarView の catch が全てヘルパ経由
- [ ] i18n `errors.*` キーが en/ja 両方に存在
- [ ] rate limit / silent の挙動が UI で確認できる
- [ ] §Toast Known Issues の保留 S-5 を「解消」に更新

## Files

| File                                                    | Operation | Notes                        |
| ------------------------------------------------------- | --------- | ---------------------------- |
| `frontend/src/hooks/useServiceErrorHandler.ts`          | Create    | 本 Plan の中心               |
| `frontend/src/hooks/useServiceErrorHandler.test.ts`     | Create    | 単体テスト                   |
| `frontend/src/i18n/locales/en.json`                     | Update    | `errors.*` セクション追加    |
| `frontend/src/i18n/locales/ja.json`                     | Update    | 同上                         |
| `frontend/src/context/TimerContext.tsx`                 | Update    | catch 10+ 箇所を hook 経由に |
| `frontend/src/context/SyncContext.tsx`                  | Update    | 既存 toast 直呼び統一        |
| `frontend/src/components/Layout/MobileCalendarView.tsx` | Update    | catch を hook 経由に         |
| `.claude/docs/requirements/tier-2-supporting.md`        | Update    | §Toast Known Issues 更新     |
