# HISTORY (chat-materials-refine)

### 2026-07-11 - Materials Notes/Tasks レイアウト反転（リスト = rightSidebar / 本文・詳細 = メイン）

#### 概要

Notes / Tasks を Daily 同型の「サイドバー = 一覧・メイン = 編集/詳細」に反転し、Tasks は看板をトグル（board モード）で温存。あわせて layout standard v1（#188）を merge し PageContainer adoption（#181 materials 分・Tags 込み）を実施。

#### 変更点

- **Notes 反転**: ノートツリー（検索/フォルダ/DnD/Trash 行）→ RightSidebarPortal、NoteDetailPanel（variant="main" 追加）+ RichTextEditor → メイン。wide mount で rightSidebar 自動オープン・未選択 EmptyState
- **Tasks layout-mode**: 新規 shared `TaskListPanel`（folder/status/tag グルーピング + 折りたたみ + 件数）を sidebar に、TaskDetailPanel をメインに（list 標準・localStorage `life-editor.tasks.layout-mode`）。board = 従来看板を完全維持
- **検証起点の修正**: folder ビューに Unfiled（root）バケット追加（buildFolderColumns additive + moveToRoot DnD 配線）/ wide→narrow 境界のドロワー残留 close / 件数バッジ aria-label / PageContainer 二重ラップ剥がし（Notes/Daily/Tags/KanbanView gutter）
- **品質ゲート**: role-qa 2 回 PASS（Blocking 0）・playwright 実ブラウザ 2 回 PASS（フル 14 項目 + 修正 5 項目）・shared 768 tests 緑
- **既知の残件**: 409 sync（items_meta on_conflict=id vs 複合制約・既存データ層バグ・Issue 起票はユーザー判断待ち）/ board での Unfiled 列への cross-column DnD は手動確認推奨
