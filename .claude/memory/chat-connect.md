# MEMORY (chat-connect)

## 進行中

### 🔧 Connect リンク作成・削除 UI（STEP 2 機能ギャップ埋め）（着手日: 2026-06-27）

**対象**: `shared/src/components/Connect/{SelectedNodeCard,ConnectGraphView}.tsx` / `shared/src/components/Connect/graph/buildGraphModel.ts` / `web/src/connect/ConnectScreen.tsx` / `shared/tests/{connectGraphModel,selectedNodeCard}.test.tsx`
**worktree/branch**: `.claude/worktrees/connect-link-ui` / `feat/connect-link-ui`（commit `b2f9781e`・base origin/main）

- 前回: —
- 現在: 実装完了・**PR #107 open**（base main・未 merge）。閲覧専用だった Connect グラフに、ノード選択→`SelectedNodeCard` で相手を datalist 検索追加・outgoing 行の × 削除を実装。connections は `WikiTagsUnifiedProvider` cache 由来で自動再描画。DDL/DataService 拡張なし（既存 `createItemLink`/`deleteItemLink`/`wiki_tag_connections`）。重複リンクは候補除外+submit ガードの二段防止。role-pm→engineer→qa(APPROVE-with-nits・Blocking ゼロ)。検証: shared 512 pass / shared tsc -b 0 / web build exit 0
- 次: 👀 実機目視（env あり・ノード選択→追加/削除・自動再描画）→ 🛑 PR #107 merge（ユーザー判断）→ merge 後: worktree `connect-link-ui` prune + branch 削除

## 直近の完了

（なし）

## 予定

- Connect リンク UI follow-up（#107 後続）: ①mutation 失敗時の UI フィードバック（無効 id 貼付・toast 配線）②byLabel/raw 貼付経路のテスト追加・冗長な optional chaining 整理
