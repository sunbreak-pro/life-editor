---
Status: Draft
Created: 2026-06-14
Branch: claude/w4-analytics
Owner-chat: w4-analytics
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: (W3 — PR #75 merged)
---

# Plan: W4 Analytics（集計 + recharts・web）

> 親ロードマップ §W4 の Analytics レーン。Connect レーン（`-w4-connect.md`）と**並行**で進む。
> 衝突回避は coord outbox `.claude/comm/outbox/chat-w4-coord.md` を SSOT とする。

---

## Context

- **動機**: web は Desktop 同等化（roadmap W4）の最後の一歩。Analytics（旧 Tauri 31f/3200行）は
  Tauri 依存ゼロ → 集計ロジックを共有層、描画を recharts で web に新規実装。
- **制約**: コスト $0（新テーブル不要見込み・既存 items_meta/payload を集計）。**画面層 = 複雑→分割寄り**
  （複数タブ。PC 中心。Mobile は後続）。notion-\* トークン厳守・i18n-first（namespace `analytics.*`）。
- **Non-goals**: Connect（別レーン）/ 既存 5 機能の改変 / 汎用 Database（凍結）/ 新規 DDL（必要なら
  coord に先連絡）。

---

## Scope (Touchable Paths)

```
web/src/analytics/**                       # 新規（AnalyticsScreen + タブ + チャート）
shared/src/services/analyticsAggregation*.ts   # 新規（集計ロジック・vitest 対象）
shared/src/types/analytics.ts              # 新規
shared/src/i18n/locales/{en,ja}.json       # analytics.* キーのみ追加（section.* はスキャフォールド済）
shared/src/index.ts                        # 自分の型/サービス export 追加のみ（末尾・近接回避）
.claude/docs/vision/plans/2026-06-14-web-parity-w4-analytics.md
```

**不可侵**: `web/src/connect/**`・`shared/src/**connect**`・`web/src/MainScreen.tsx`（スキャフォールド
後は無接触）・`web/package.json`（スキャフォールド済）・`frontend/**`・既存 5 機能・`supabase/migrations/**`。

---

## Steps

| #   | Step                                                     | Gate    | Acceptance                                   |
| --- | -------------------------------------------------------- | ------- | -------------------------------------------- |
| 0   | （coord）スキャフォールド merge 待ち（recharts dep + section 配線 + stub） | 🛑 人手 | main に AnalyticsScreen stub + recharts 存在 |
| 1   | 集計ロジックを `shared/src/services/analyticsAggregation.ts` に + vitest | 🤖 自律 | `cd shared && npm run test` 緑               |
| 2   | recharts で複数タブ UI を `web/src/analytics/` に実装    | 🤖 自律 | `cd web && npm run build` exit 0 / eslint 0  |
| 3   | i18n `analytics.*`（en/ja）+ index.ts export             | 🤖 自律 | build 緑・キー欠落なし                       |
| 4   | 主要集計の描画 E2E 目視                                  | 👀 目視 | 集計タブが web で描画・切替                   |
| 5   | PR 作成（draft）→ main merge                             | 🛑 人手 | PR レビュー & merge                          |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npx eslint .` 0
- [ ] `cd shared && npm run build` exit 0 / `cd shared && npm run test` 全 pass
- [ ] `cd frontend && npm run build` exit 0（旧 Tauri 非破壊）
- [ ] PR diff が共有 3 ファイル（MainScreen / package.json / locales の section ブロック）に**触れていない**

---

## Risks / Known Issues 参照

- recharts のバンドルサイズ → 必要なら lazy import（MainScreen の NotesView 同様）。
- 集計の重さ → 大量データ時の計算は shared 側で memo / 範囲指定。

---

## References

- 親: `./2026-06-07-web-desktop-parity-roadmap.md` §W4
- coord: `.claude/comm/outbox/chat-w4-coord.md`
- 旧実装の仕様参照元（コードは移植しない）: `frontend/src/components/Analytics/**`
