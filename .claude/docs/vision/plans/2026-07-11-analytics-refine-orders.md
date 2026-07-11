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
