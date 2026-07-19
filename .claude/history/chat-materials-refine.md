# HISTORY (chat-materials-refine)

### 2026-07-19 - #300 tag chip ちらつき + #301 rightSidebar Notes 選択の遅延（PR #308）

#### 概要

section:materials の Issue キュー消化。#300（入力中の Tag 表示ちらつき）と #301（rightSidebar アイテム選択の遅延）を調査・修正し PR #308 を提出（Closes #300, #301・merge = こうだいさん）。両方とも根は同じ own-write Realtime echo 連鎖（typing → 800ms debounce 保存 → Supabase が自分の書き込みを自分にエコーバック → 300ms debounce 後 syncVersion bump）。

#### 変更点

- **調査（#300）**: 4 並列偵察（sync-refetch / TipTap decoration / context identity / 直近 regression の git 調査）→ 統合 → 上位仮説 2 件を敵対的検証（両方 CONFIRMED）のワークフローで root cause 特定
- **#300 修正 1（tag chip 全般）**: `useWikiTagsUnifiedAPI` の `loading` が syncVersion bump のたびに true へ戻り、TagPicker/LinkPanel/Tags タブ全てが表示中の chip を unmount していた。`hasLoadedRef` で「初回ロード未完了時のみ loading」に変更 — 3 surface 同時に解消
- **#300 修正 2（Daily editor 全体 remount）**: `DailyView` の own-echo 判定がバイト比較で、Postgres jsonb のキー順再配置により自分の保存エコーを外部編集と誤認し editor 全体を remount（カーソル飛び + `[[wiki-link]]` pill 明滅）。`jsonDocEquals`（新規 shared ユーティリティ・JSON 意味比較、非 JSON はバイト比較 fallback）に差し替え
- **#301 修正（Notes 選択遅延）**: `useNotesUnifiedAPI` の sync-triggered list reload が syncVersion bump のたびに hydrated body キャッシュ（`contentLoadedIdsRef`）を全消去 — 入力はどこでやっても bump が飛ぶため、既読 Note の再選択がほぼ毎回ネットワーク往復（`ds.getNoteUnified`）になっていた。`updatedAt` 不変なら旧 body を維持する merge 方式に変更（実際に書き込まれた note のみ無効化）
- **テスト**: 新規 3 ファイル 15 件（`jsonDocEquals.test.ts` / `wikiTagsRefreshLoading.test.tsx` / `notesHydrateCachePerf.test.tsx`）。shared vitest 132 files / 1067 tests green・shared tsc -b・web build 全 green
- **プロセス注記**: #308 マージ待ちの間に #301 コミットを同ブランチへ push してしまい 2 Issue が 1 PR に同居（GitHub は同一ブランチ→main の PR を 1 つしか許さないため分割不可・PR タイトル/本文で両 Issue 明記して対応。次回は前 PR マージ後に次 Issue へ着手する運用に戻す）
- **outbox**: follow-up 起票依頼 1 件（PR #289 由来・編集中 Note がタグ group 内で最新順ソートにより跳ねる現象）+ 上記プロセス注記を chat-main へ報告

### 2026-07-19 - #282 選択状態のタブ跨ぎ保持 + #283 rightSidebar ソート・フィルタ（PR #289）

#### 概要

Materials の Notes/Daily/Tasks で選択中アイテムがセクション・タブ切替で失われるバグ（#282）を in-memory 選択ストアで修正し、rightSidebar リストにソート・フィルタ UI（#283・Notes + Daily）を追加。PR #289 提出（Closes #282/#283・merge = こうだいさん）。

#### 変更点

- **#282 選択ストア**: `shared/src/state/materialsSelectionStore.ts` 新設（モジュールスコープ・意図的に localStorage 不使用 = 再起動リセットで stale id 復元ゼロ）。3 フックに write-through + one-shot 復元を配線。Notes は hydrate-first（`getNoteUnified` 完了後にのみ選択が立つ — 空エディタ上書きのデータ損失経路を排除）・存在検証で消えた id はクリア・取得失敗ではクリアしない（一時エラー耐性）。TaskTree は `persistSelection` オプトイン（Schedule mount の非干渉を構造化）。Daily は「今日」選択でストアをクリア（日跨ぎ固定を防止）
- **#283 ソート・フィルタ**: `SidebarListControls` 新設（props 注入・lumen トークン・IME 安全な onChange のみ filter）。Notes = 3 モード × 方向をタググループ内に適用・sortMode を `life-editor:note-sort-mode` に新規永続化・ソート実装を `utils/noteSort.ts` に一本化。Daily = 日付方向（`life-editor:daily-sort-direction`）+ テキスト絞り込み（`utils/dailyListView.ts`）。Tasks は N/A（リスト退役済み #286）・他セクション水平展開は outbox で起票依頼
- **プロセス**: ultracode 采配 = 偵察 3 並列 → role-pm 分解 → engineer 3 本（A/B1 並列 → B2）→ role-qa + 敵対的レビュー並列監査。監査指摘 4 件（createNote ストア書き込み漏れ / fetch 失敗時の誤クリア / Schedule mount への復元リーク / Daily today 固定）を全修正 + 回帰テスト 5 件
- **検証**: shared tsc -b / vitest 122 files・998 tests（新規 47）/ web build / eslint 全 green。実ブラウザ確認 = merge 後 chat-main（PR 本文にチェックリスト）

### 2026-07-18 - #258 F-1 Daily エディタ TipTap 化（PR #270）

#### 概要

loop-friction-fixes §F-1（ループ前提工事・最優先）を実装し PR #270（Closes #258）を提出。Daily 本文の平文 textarea を Notes の TipTap RichTextEditor（見出し 1〜3）に載せ替え、手書きの朝刊・夕刊見出しが extractBriefing に拾われるようにした。

#### 変更点

- **shared 純関数ヘルパー新設**: `components/materials/dailyContent.ts` — `plainTextToTipTapDoc`（改行 = paragraph）/ `dailyContentToEditorContent`（平文は読み込み時のみ変換・doc でない JSON も平文扱いでデータ非破壊）/ `dailyContentExcerpt`（平文・TipTap 両対応の抜粋）+ vitest 12 件（extractBriefing 往復テスト含む）
- **DailyView**: EditorCard の textarea → RichTextEditor（web/notes 再利用・`className` prop 新設で card 内フィル表示）。JSON 保存はユーザー編集時のみの遅延方式・remount は日付切替/外部変更時のみ（保存エコーは lastEmitted state で判別 — カーソル/IME 保持）。タイトルは日付固定のまま。過去エントリ抜粋を両形式対応に
- **CSS**: `.daily-editor` バリアント（カード内フィル + クリック全域フォーカス）
- **検証**: shared vitest 929/929・shared tsc -b・web build green・web eslint clean（react-hooks/refs 9 件を state 化で解消）。role-qa 独立監査 PASS（Blocking 0）— 指摘反映: CRLF split / 空 doc mint ガード / lastEmitted に日付付与（切替直後の誤 unsaved 解消）/ CSS 詳細度固定。夕刊パースは F-6 領分とスコープ明確化（extractBriefing は朝刊専用のまま）。実ブラウザ確認 = merge 後 chat-main
- **状況同期**: PR #244（#225 life-tags S3）・PR #264（#260/#261）の merge 済みを確認し memory へ反映。life-tags 残 = ユーザー db push のみ

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
