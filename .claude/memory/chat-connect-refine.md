# MEMORY (chat-connect-refine)

## 進行中

### ⏸️ Layout Standard v2 adoption（#206・着手日: 2026-07-11）

**対象**: `shared/src/components/Connect/ConnectGraphView.tsx`, `ConnectGraphActions.tsx`(新規), `ConnectSidebarPanel.tsx`, `ConnectHeader.tsx`(削除)
**計画書**: `.claude/docs/vision/plans/2026-07-11-connect-refine-orders.md`

- 前回: #181 connect 行（v1 gutter）を #194 で main merge 済
- 現在: v2 adoption コード完了。#196 由来の二重ヘッダー（標準 SectionHeader + body 内 ConnectHeader）を解消 = 自前 ConnectHeader 撤去し、graph アクション（件数/フィルタ解除/reheat/fit）を rightSidebar settings タブへ集約（ユーザー決定）。検証: shared build 緑 / web build 緑 / role-qa PASS(Blocker 0) / shared test は過負荷 flaky 6件のみ(単体再実行 69/69 pass・Connect 無関係)。**commit/PR はユーザー承認待ち**
- 次: 承認 → commit → PR(#206) → merge 後 chat-main で実ブラウザ確認 → orders 計画 Status 更新

## 直近の完了

- #181 connect 行（Layout Standard v1 adoption・rem→px lumen gutter）✅（2026-07-11・main merge #194）

## 予定

- life-tags 統一計画 Step 2 のレビュー参加（合図待ち）
