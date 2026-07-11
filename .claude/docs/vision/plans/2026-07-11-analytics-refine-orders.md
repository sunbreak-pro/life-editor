---
Status: IN PROGRESS
Created: 2026-07-11
Branch: claude/analytics-refine
Owner-chat: analytics-refine
Parent: 2026-07-11-layout-standard-v2.md
---

# Plan: analytics-refine orders — 担当 Issue + Layout Standard v2 adoption

> analytics-refine worktree の作業台帳。共通仕様の正本 = [親計画](./2026-07-11-layout-standard-v2.md)（転記しない）。担当の一次情報は常に `gh issue list -R sunbreak-pro/life-editor --label section:analytics --state open` + `--label shared-fix`（本計画は 2026-07-11 時点のスナップショット + セクション固有メモ）。

boot 行:

```text
計画書 .claude/docs/vision/plans/2026-07-11-analytics-refine-orders.md に従い、「今すぐ着手可」から実行してください。
```

---

## 今すぐ着手可（v2 部品を待たない）

- **#182 Today カードの窮屈な表示**（type:bug・sev:minor）: **#180 の 1000px clamp 解消（AnalyticsView 追随）で根本対処済みの見込み** — main を取り込んで実測し、直っていれば確認コメントを添えて close、残っていれば追修正
- **#181 analytics 行（v1 adoption）**: #180 が AnalyticsView を先行追随済み（#180 Worklog 参照）→ 表示確認のみで #181 の自分の行をチェック

## Layout Standard v2 adoption（v2 共通部品 merge 後 — 親計画 Step 4 以降）

- **rightSidebar トグル新設**: analytics は現在 rightSidebar 無効の 2 セクションの片方（親計画 §3）。トグルは shell が常設する → analytics 側の作業は表示確認と、**パネル中身の定義（未定のままで OK — 将来タグ別・期間別の集計フィルタ等の候補メモを残す程度で可）**
- 標準セクションヘッダーへの統合確認（現構成 = h2 タイトル + 期間セレクタ + HeaderTabs）
- **幅切替タブ**: 初期値と data 列の扱いは親計画 §5 の表が正（analytics は推論値 — 表の注記参照。生値はトークンが正）。wide / narrow 両状態でカード列の折返し確認（#182 の再発監視を兼ねる）

## 後続: life-tags（[兄弟計画](./2026-07-11-life-tags-unification.md)参照・着手は合図待ち）

- タグ別集計は候補としてあり得るが未定 — 兄弟計画の詳細設計後に判断

---

## Scope (Touchable Paths)

```
shared/src/components/Analytics/**   ← analytics は shared 側に実体。shell 部品（AppShell / MainScreen / HeaderTabs / RightSidebar 系 / 標準ヘッダー）は編集禁止（単一書込者 = layout-standard）
web/src/**                           ← analytics 配線部分のみ
.claude/docs/vision/plans/2026-07-11-analytics-refine-orders.md
```

## Steps

| #   | Step                          | Gate    | Acceptance                                |
| --- | ----------------------------- | ------- | ----------------------------------------- |
| 1   | #182 実測 → close or 追修正   | 🤖      | Issue コメント + （修正時）PR             |
| 2   | #181 analytics 行の確認・消化 | 🤖      | #181 チェック                             |
| 3   | v2 adoption（部品 merge 後）  | 🤖 + 👀 | v2 adoption Issue の analytics 行チェック |

## Acceptance Criteria

- [ ] `cd shared && npm run build && npm run test` / `cd web && npm run build` pass
- [ ] 担当 Issue（#182 / #181・v2 adoption の analytics 行）が close またはチェック済み
- [ ] 完了時: 本計画 Status 更新 + per-chat memory 更新（DoD）

---

## Worklog

- 2026-07-11 (chat-analytics-refine, v2 adoption 第 1 便): #196（v2 共通部品）merge を確認しゲート解除 → in-scope 分を実施。**AnalyticsView の内部 h2 タイトル行を撤去**（shell SectionHeader の「分析」と二重だった過渡事象 — #196 既知リスト記載分）。期間セレクタは HeaderTabs の `trailing` スロットへ移設し 1 行化。**残タスク（shell 協調が必要・outbox で layout-standard へ提案済み）**: (a) タブ帯の SectionHeader 統合（v2 §1 の tab-band-as-title。MainScreen のタブ state lift が必要 — materials 方式）/ (b) narrow 時の二重 gutter・二重スクロール（PageContainer reading × AnalyticsView 内部 chrome の重なり。wide→data variant 化 + 内部 chrome 撤去の協調パスを提案）。**runtime 検証は chat-main へ依頼**（playwright 起動は chat-main のみの 2026-07-11 決定に従う）。v2 adoption Issue は未起票（起票され次第 analytics 行を追随）。パネル中身はプレースホルダー継続（候補メモ = タグ別・期間別集計フィルタ）
- 2026-07-11 (chat-analytics-refine): main 取り込み（#180 反映）→ #182 実測。**構造 DoD は PASS**（Today カード実測 324.33px = 1000px カラム有効。clamp 残存なら 248px のはず）。ただし **ja の値文字列（分を含む 6 文字以上・例「2時間30分」）が 86.4px セルに対し約 90px 必要で 2 行に折返し** — #182 の cramped 症状は desktop ja で未解消と判定（en / mobile は 1 行 OK）。実測手法: 認証ゲート（AuthCard）で通常の playwright 巡回が不可のため、vite dev の実 TSX を dynamic import + 実 CSS 上で mount する component-graph 計測（スクリプト = セッション scratchpad `harness.mjs` / raw = `result.json`）。追修正: TodayDashboard の入れ子 3 列 grid を廃し、隣接 WeeklySummary と同一の縦積み SummaryRow（ラベル左・値右）へ統一（`SummaryRow.tsx` に共通化・Issue #182 修正方向 2 の委任範囲）。テスト直接参照なし。
