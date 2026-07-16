# HISTORY (chat-materials-refine)

### 2026-07-16 - #260 F-3 Note Links rightSidebar パネル化 + #261 F-4 表示ラベル改名（PR #264）

#### 概要

loop-friction-fixes §F-3 / §F-4 を実装し PR #264（Closes #260 / #261）を提出。Note 本文最下部の Links を rightSidebar の開閉パネルへ移設し、表示ラベルをタスク→Todo・約束→予定へ i18n catalog のみで改名した。

#### 変更点

- **F-3（#260）**: `NoteDetailPanel` から `linksSlot`/`linksLabel` を削除（呼び出し元は NotesView のみ）・rightSidebar のノート一覧の下に Trash と同型の「区切り線 + 開閉」Links セクションを新設（LinkPanel を選択ノートで表示・未選択時は mainEmpty ヒント・mobile は Links 非表示のまま）・noteDetailPanel.test 追随
- **F-4（#261）**: en/ja catalog の値のみ一括改名（キー・`{{task}}`/`{{tasks}}` プレースホルダー変数・コード識別子・DB・SectionId は不変）。JSON パース → 値 walk のスクリプト変換 + 和欧間スペース調整（TodoID→Todo ID / Todo ・→Todo・）。en は Task(s)→Todo(s)・PROMISES→PLANS。i18n.test の期待値と Briefing コード内コメントも追随
- **docs sweep（同一 PR）**: schedule-redesign（約束→予定 + F-4 注記）・briefing-loop 読む行・tier-1-core AC2・settings brief プレビュー文。outbox / per-chat history / F-4 仕様文中の引用は歴史的記述として維持
- **検証**: shared vitest 112 files / 902 tests green・shared tsc -b green・web build green（既存 chunk-size warning のみ）・catalog JSON parse 検証・shared/web ソースの タスク/約束 残存 0（prototype/ は対象外）
- 2026-07-11: [途中] life-tags 統一 Materials 領分 — PR #244 の CI 失敗を修正（main #243 ページ分割 fetchAllPages の .order/.range にテストモック追随・origin/main merge・457237c8 push・vitest 879/879 + build green・role-qa PASS）。残 = PR merge + 実データ変換（ユーザーゲート）

### 2026-07-11 - life-tags 統一 S3 実装（NodeType folder 除去・legacy 行 fetch 除外・i18n/docs sweep）

#### 概要

S1 (PR #237) / S2 (PR #239・schedule-refine) の merge を受けて S3 を実装。Tasks ドメインから folder ノード型を型レベルで撤去し、legacy folder 行の fetch 時除外を新設、folder 系 orphan i18n キーと docs を sweep した。Notes 側の folder 型は Connect グラフ後継設計と併せて別レーンへ意図的に温存（過渡期非対称）。

#### 変更点

- **型・mapper・サービス**: `NodeType = "task"` 単一化・`folderType`/`originalParentId`/`FOLDER_PAD_TOP` 除去・taskMapper は DB 列 read 維持のまま両列を null 書込・**`isLegacyFolderRow` による fetchTaskTree/fetchDeletedTasks の client-side 除外**（NULL task_type 生存・孤児許容・幽霊 folder が Trash に出ない）
- **デッドコード削除**: `folderTag.ts` ファイル削除・`getDescendantTasks()` 関数削除（`collectDescendantIds`/`isDescendantOf` は不変）
- **folder 分岐撤去**: sortTaskNodes / useTaskTreeAPI / useTaskTreeCRUD / TaskDetailPanel(isFolder prop) / KanbanView / useTaskTreeDnd（inside ドロップは tier-1 AC3 準拠で全タスク許可・cycle guard 維持）・analytics `aggregateByFolder` は `[]` 返却の最小改変（tag 後継 = analytics レーン）
- **テスト**: 6 ファイル書換 + 新規 2 本（applyStatusChange DONE 沈み reorder / legacy folder filter）— 855 tests green（baseline 852）
- **i18n**: folder 系 orphan キー削除（en/ja lockstep・キー parity 機械確認）。FileExplorer / Notes folder 系は温存
- **docs sweep**: tier-1-core（Tasks Purpose/Boundary/AC1/AC4/AC5/AC10・Notes AC1 に retired 注記）・tier-2（WikiTags → life-tags 昇格・Tasks tagging 解禁）・plan Worklog 追記
- **検証・監査**: shared build + 855 tests / web build / web lint 全 green。role-qa PASS（Blocking 0）・sync-auditor Blocking 0（Nit 1 = original_parent_id の null 上書きは rollback SSOT が log テーブルのため実害なし）

### 2026-07-11 - life-tags 統一 S1 実装（Kanban 2 ビュー化・Notes タグ見出し UI・変換 migration 0020）

#### 概要

life-tags 統一 S1 を role-engineer 3 レーン並列で実装。Kanban / タスク一覧から folder ビューを廃して status / tag の 2 ビューへ、Notes サイドリストをタグ見出しグルーピングへ置換、folder→tag 変換 migration 一式を作成。NodeType の "folder" は温存（S3 = schedule-refine S2 合意後）。

#### 変更点

- **Kanban レーン（18 ファイル）**: KanbanViewMode 2 値化・default "tag"・buildFolderColumns / FOLDER_ROOT_BUCKET_ID 削除・folder pill / accent 除去・viewModeStorage の legacy "folder"→"tag" 自己修復・TaskListPanel 双子追随・TaskAddDialog task 専用化・useTaskTreeCRUD の Complete-folder 自動管理退役（status 遷移 + completedAt + DONE 沈み reorder は維持）・web/src/tasks host 追随
- **Notes レーン**: buildTagGroups 純関数（shared/components/notes 新設・多タグ重複表示・untagged バケツ・folder 配下ノートも parentId 無関係に可視）・NotesView をタグ見出しグルーピングへ書換・useNoteTagDnd（見出しドロップ = assignTagToItem・複合 draggable id・untagged は no-op）・useNoteTreeDnd 削除・i18n 4 キー追加（en/ja）
- **migration レーン**: 0020_life_tags_folder_migration.sql（log テーブル + set-based 変換・冪等・LWW bump）+ scripts/life_tags_verify.sql（期待値 5 タグ / 1 assignment / 1 re-root）+ migrations_archive_rollback/0020_rollback.sql（対称・新規タグのみ削除）。実行 = 🛑 ユーザー
- **検証**: shared build + 851 tests green・web build green。統合時の NotesView activeNode/activeNote 取り違え 2 行をメインが修正
- **監査**: role-qa PASS（Blocker 0）・migration-validator Blocking 0・sync-auditor Blocking 0。Nit 反映 = assignTagHint props 配線・KanbanView stale コメント修正・rollback ヘッダに「delta-pull 復活時は soft-delete へ」注記

### 2026-07-11 - life-tags 統一 Step 2 詳細設計（#225 起票・実測込み設計・S2 合意依頼）+ #118 後始末

#### 概要

life-tags 統一（folder 廃止 → WikiTag 一本化）の Materials 領分に着手。Supabase 本番の read-only 実測を根拠に、計画書へ Step 2 詳細設計（平坦化規則・変換 migration + 検証クエリ + rollback・UI 波及・S1/S2/S3 ステージング）を追記し Status → IN PROGRESS。あわせて merge 済み PR #195（#118 パスワードハッシュ化）の DoD 後始末を実施。

#### 変更点

- **Issue #225 起票**: type:task + shared-fix・タイトル prefix [materials-refine]。共有コアの単一書込者 = materials-refine（chat-main 采配）
- **実データ実測（Supabase Management API read-only SQL）**: active folder = tasks 3 + notes 2（全ルート直下・入れ子なし）/ deleted 6 は全て folder_type='complete' / folder 直下 active アイテムは task 1 件のみ / calendars **0 行** / タグ名衝突 0 / user 2 名義（set-based 必須）。**MCP life-editor は旧 SQLite 読みで本番と別データ**と判明（実測は Supabase 側を正とした）
- **設計確定**: 平坦化 = 直近 folder 名のみ付与 / 'complete' folder は変換対象外 / 同名は 1 タグへ dedupe（partial unique `uq_wiki_tags_name` 準拠）/ 直下アイテム re-root（tasks は original_parent_id 退避・notes は移行ログ）/ folder はソフトデリート保持 / 期待値 = 5 タグ・1 assignment・1 re-root
- **outbox → schedule-refine**: CalendarView の folder バインド置換（S2）の合意依頼。NodeType folder 除去（S3）は S2 完了後のみと約束
- **#118 後始末**: PR #195 merge 確認 → plan COMPLETED + `.claude/archive/` 移動・memory 更新

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
