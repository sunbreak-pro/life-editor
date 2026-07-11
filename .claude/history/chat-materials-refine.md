# HISTORY (chat-materials-refine)

### 2026-07-11 - Layout Standard v2 adoption 着手（#207 起票・#203 依存で先行準備）

#### 概要

materials の v2「全画面 wide 統一」adoption を精査。全幅化の shell 実装は #203（layout-standard・未着手）依存で materials-refine 単独では完遂不能と判明。今セッションは adoption Issue #207 起票 + #203 への fluid 要望 + reading 前提コメントの素の全幅移行意図の先行明記まで。実確認は #203 merge 後に残す。

#### 変更点

- **方針決定（ユーザー 2026-07-11）**: 素の全幅（エディタ本文・タグ一覧も画面幅いっぱい・内部 reading カラムで絞らない）。進め方 = 「#203 待ち + 先行準備」
- **依存の同定**: #203 が `pageWidth = ownsFullBleed ? "fluid" : "full"` に単純化 → notes/daily/tags は `full`。素の全幅は中身ほぼ無改修で成立。shell（MainScreen/SectionHeader/PageContainer）は編集禁止（単一書込者 = layout-standard）
- **#207 起票**: section:materials + type:task。#203 merge 後の各サブタブ全幅確認チェックリスト付き
- **outbox 要望**: @chat-layout-standard へ「notes/daily は縦も fill する fluid 化を検討」（full だとエディタが content 高さで止まる）。tags は full で可
- **コメント先行更新**: NotesView/DailyView/WikiTagsManagementView の reading 前提コメントに v2 全幅移行意図を明記（実クラス名は #203 依存のため不変・手戻りなし）
- **#181 再実測**: main 取り込み後、`max-w-[800px]` 二重ラップ撤去済み・余計な幅ハードコードなしを確認（materials 行 [x] は正）

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
