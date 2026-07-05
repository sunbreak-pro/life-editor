---
Status: COMPLETED（Superseded — w4-analytics-connect に統合実装。#154 closeout・2026-07-05）
Created: 2026-06-14
Branch: claude/w4-connect
Owner-chat: w4-connect
Parent: ./2026-06-07-web-desktop-parity-roadmap.md
Previous: (W3 — PR #75 merged)
---

# Plan: W4 Connect（node graph @xyflow/react + backlink・web）

> 親ロードマップ §W4 の Connect レーン。Analytics レーン（`-w4-analytics.md`）と**並行**で進む。
> 衝突回避は coord outbox `.claude/comm/outbox/chat-w4-coord.md` を SSOT とする。

---

## Context

- **動機**: roadmap W4。Connect（旧 Tauri 32f/7500行・一部 Tauri 依存）= ノートグラフ + backlink。
  Notes/Daily は web 移植済 → items_meta + link 系から graph を構築し `@xyflow/react` で描画。
- **制約**: コスト $0（新テーブル不要見込み・既存 link/items_meta を参照）。**画面層 = 複雑→分割**
  （PC=node graph ドラッグ / Mobile=後続）。一部 Tauri 依存は web では落として再実装。ink-\* / i18n
  namespace `connect.*`。
- **Non-goals**: Analytics（別レーン）/ 既存 5 機能の改変 / 汎用 Database（凍結）/ 新規 DDL（必要なら
  coord に先連絡）。

---

## Scope (Touchable Paths)

```
web/src/connect/**                         # 新規（ConnectScreen + graph + backlink ビュー）
shared/src/services/connectGraph*.ts       # 新規（graph 構築ロジック・vitest 対象）
shared/src/types/connect.ts                # 新規
shared/src/i18n/locales/{en,ja}.json       # connect.* キーのみ追加（section.* はスキャフォールド済）
shared/src/index.ts                        # 自分の型/サービス export 追加のみ（末尾・近接回避）
.claude/docs/vision/plans/2026-06-14-web-parity-w4-connect.md
```

**不可侵**: `web/src/analytics/**`・`shared/src/**analytics**`・`web/src/MainScreen.tsx`（スキャフォールド
後は無接触）・`web/package.json`（スキャフォールド済）・`frontend/**`・既存 5 機能・`supabase/migrations/**`。

---

## Steps

| #   | Step                                                       | Gate    | Acceptance                                    |
| --- | ---------------------------------------------------------- | ------- | --------------------------------------------- |
| 0   | （coord）スキャフォールド merge 待ち（@xyflow/react dep + section 配線 + stub） | 🛑 人手 | main に ConnectScreen stub + @xyflow 存在     |
| 1   | graph 構築ロジックを `shared/src/services/connectGraph.ts` に + vitest | 🤖 自律 | `cd shared && npm run test` 緑                |
| 2   | `@xyflow/react` で node graph + backlink を `web/src/connect/` に | 🤖 自律 | `cd web && npm run build` exit 0 / eslint 0   |
| 3   | i18n `connect.*`（en/ja）+ index.ts export                 | 🤖 自律 | build 緑・キー欠落なし                        |
| 4   | グラフ表示・ノード遷移 E2E 目視                            | 👀 目視 | ノートグラフ描画・クリック遷移・backlink 表示 |
| 5   | PR 作成（draft）→ main merge                               | 🛑 人手 | PR レビュー & merge                           |

---

## Acceptance Criteria (機械検証可能)

- [ ] `cd web && npm run build` exit 0
- [ ] `cd web && npx eslint .` 0
- [ ] `cd shared && npm run build` exit 0 / `cd shared && npm run test` 全 pass
- [ ] `cd frontend && npm run build` exit 0（旧 Tauri 非破壊）
- [ ] PR diff が共有 3 ファイル（MainScreen / package.json / locales の section ブロック）に**触れていない**

---

## Risks / Known Issues 参照

- `@xyflow/react` のサイズ + Canvas/DOM 描画 → lazy import 推奨（Notes と同様の code-split）。
- 大規模グラフのパフォーマンス → ノード数上限 / 近傍のみ展開を検討。
- 旧 Connect の Tauri 依存箇所 → web では DataService 経由に置換（直接 invoke 禁止・§3.1）。

---

## References

- 親: `./2026-06-07-web-desktop-parity-roadmap.md` §W4
- coord: `.claude/comm/outbox/chat-w4-coord.md`
- 旧実装の仕様参照元（コードは移植しない）: `frontend/src/components/Connect/**`
