# HISTORY (chat-materials-refine)

### 2026-07-11 - #118 パスワード PBKDF2 ハッシュ化（draft PR #195）+ #181 materials 行消化

#### 概要

Notes/Daily パスワードの平文保存を PBKDF2-HMAC-SHA256（Web Crypto・client-side）に置換し、legacy 平文は unlock 成功時の lazy rehash で移行する実装を draft PR #195 として提出。#181（layout v1 adoption）の materials 行は再実測で PR #189 消化済みと確認しチェック。

#### 変更点

- **passwordHash util 新設**: `pbkdf2$v1$<iter>$<salt>$<hash>` 自己記述形式・iterations [100k,1M] レンジ reject・salt/hash 厳密長・malformed の plaintext fallback 禁止・定数時間比較。TS 5.6（shared）/ 6.0（web）両対応の型調整（realm 越え Web Crypto の罠込み）
- **Notes/Daily 両サービス**: set=hash 保存 / verify=検証 + legacy 一致時 lazy rehash（payload 単独 UPDATE = DB-Q2 意図的例外・meta bump なし — unlock で一覧が並び替わる副作用を回避）/ RPC debt コメント引き継ぎ
- **品質ゲート**: security-review（計画段階・High 2 を計画反映）→ role-qa PASS（Blocking 0）→ sync-auditor Blocking 0（sync 面不在を実測確認）→ shared 790 tests + web build 緑
- **#181**: materials 行チェック + 実測コメント（NotesView/DailyView/KanbanView のハードコードは #189 で撤去済み）
- **前タスク完了処理**: Notes/Tasks flip 計画を COMPLETED + archive 移動（PR #189 merge 確認）

### 2026-07-11 - Materials Notes/Tasks レイアウト反転（リスト = rightSidebar / 本文・詳細 = メイン）

#### 概要

Notes / Tasks を Daily 同型の「サイドバー = 一覧・メイン = 編集/詳細」に反転し、Tasks は看板をトグル（board モード）で温存。あわせて layout standard v1（#188）を merge し PageContainer adoption（#181 materials 分・Tags 込み）を実施。

#### 変更点

- **Notes 反転**: ノートツリー（検索/フォルダ/DnD/Trash 行）→ RightSidebarPortal、NoteDetailPanel（variant="main" 追加）+ RichTextEditor → メイン。wide mount で rightSidebar 自動オープン・未選択 EmptyState
- **Tasks layout-mode**: 新規 shared `TaskListPanel`（folder/status/tag グルーピング + 折りたたみ + 件数）を sidebar に、TaskDetailPanel をメインに（list 標準・localStorage `life-editor.tasks.layout-mode`）。board = 従来看板を完全維持
- **検証起点の修正**: folder ビューに Unfiled（root）バケット追加（buildFolderColumns additive + moveToRoot DnD 配線）/ wide→narrow 境界のドロワー残留 close / 件数バッジ aria-label / PageContainer 二重ラップ剥がし（Notes/Daily/Tags/KanbanView gutter）
- **品質ゲート**: role-qa 2 回 PASS（Blocking 0）・playwright 実ブラウザ 2 回 PASS（フル 14 項目 + 修正 5 項目）・shared 768 tests 緑
- **既知の残件**: 409 sync（items_meta on_conflict=id vs 複合制約・既存データ層バグ・Issue 起票はユーザー判断待ち）/ board での Unfiled 列への cross-column DnD は手動確認推奨
