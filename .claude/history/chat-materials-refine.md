# HISTORY (chat-materials-refine)

### 2026-08-10 - #588 NotesView 925 行の分割 + materials 3 画面のテスト整備（PR #646）

#### 概要

`web/src/notes/NotesView.tsx`（925 行）を責務ごとに 5 ファイルへ分割し、NotesView / DailyView / KanbanView に web/tests のテスト 36 本を新設した。テストを先に敷いてから分割し、同じテストが分割の前後で緑であることを挙動不変の根拠にした。PR #646 提出（Closes #588・CI 緑・merge = こうだいさん）。

#### 変更点

- **テスト先行（commit ba05c3ab）**: `web/tests/{notesView,dailyView,kanbanView}.test.tsx` を新設（14 + 11 + 11 = 36 本）。ホストの配線だけを固定 = どの幅でどちらの面が出るか / クリックが何に届くか / 各面が何をマウントしてよいか。合成する shared の部品（`buildTagGroups` / column builders / list・sheet・panel）は本物のまま残し、派生リストの回帰がここで落ちるようにした。TipTap とタグピッカーのみスタブ
- **分割（commit ee2c2fc1）**: `NotesSidebarList`（Desktop 側リスト）/ `NotesMobileList`（Mobile ヘッダ + グループ + FAB）/ `NoteDetailSurface`（両面が載せる詳細パネル + パスワードゲート）/ `NoteBodyEditor`（配線済みエディタ 1 つ — 手写しコピー 2 箇所を廃止）/ `hooks/useNotePassword`。ホスト 925 → 469 行
- **ホストに残した判断**: 派生リストとシート対象は両面が読むため（面の内側で計算すると各ブレークポイントが同じ状態の別コピーを持つ）。Links / Trash の開閉も同じ理由（側リストは narrow で unmount するため、下ろすとリサイズで開閉を忘れる）
- **挙動不変の根拠**: `t()` キー集合が分割前後で完全一致（機械照合・i18n catalog 追加なし）／分割前に緑だった NotesView 14 本が無修正で緑／`git diff origin/main -- shared/` が空
- **検証**: shared lint 0 error・test 1512・build 緑／web lint 0・build 緑・test 160（18 files）。CI（typecheck + test + build / docs-lint）緑
- **#587 との調整**: `useNotesUnifiedAPI` / `SupabaseNotesUnifiedService`（shared-fix レーン担当）には触っていない。着手前・PR 前に `git fetch` 済みで origin/main は動いていなかった
- **環境**: 未追跡の `AGENTS.md` / `.agents/` / `.codex/`（main が 2026-08-09 にポインタ化した旧全文コピー版）が checkout を塞いだため `git stash push -u` で退避（stash@{0}・同種の退避は stash@{1} にも既存）

### 2026-07-23 - materials-refine 担当5件（#310/#311/#312/#302/#303）実装 + main 取り込み

#### 概要

section:materials の担当5 Issue を実装・検証・ローカルコミット。放置されていた未コミット WIP が実は #310 の残り（タグ編集モーダル + アイコン + 使用数）だったので完成させ、Notes の見出し/行/生成導線と Kanban タグ view を刷新。origin/main 取り込みで #322 の barrel 破損（8 テスト落ち）も回収。push は権限拒否のためユーザー実行待ち。

#### 変更点

- **#310（tag 編集集約）**: 放置 WIP を完成 = shared `TagEditModal` + `tagIcon`（curated lucide picker）+ `wiki_tags.icon`（type/mapper/WIKI_TAGS_COLUMNS）+ migration `0022`（local-first・DDL push は🛑人手）+ `useWikiTagsUnifiedAPI` に `setTagIcon`/`countsByTag`（role 横断 active assignment 集計）+ NotesView サイドバー下部に編集導線。commit 15e9ef45
- **#311（見出し区切り化）**: `DesktopTagHeading` を [アイコン]+[色帯 pill（TagPill と同 tint）]+[件数]+[罫線]へ。folder 風 `border-l` インデント撤去・モバイル見出しも同調。`NoteTagGroup` に `tagIcon` 追加 + buildTagGroups 単体テスト
- **#312（グリップ撤去）**: `GripVertical` 撤去・行全体を drag activator に（既存 PointerSensor `distance:5` で click＝開く / drag＝タグ付与を切り分け）。a11y 追随で `<li>` の role を listitem に戻す（attributes の button 化がリスト構造を壊すため）。commit 018bb125
- **#302（生成導線）**: Add Note を rightSidebar → メインコンテンツ右上へ移設（Tasks board toolbar と同位置感）。サイドバーは検索 + sort/filter 残置・モバイルは floating + 維持
- **#303（Kanban タグ view）**: タグ view のみ `flex-wrap max-w-[980px]`（3×316+2×gap）で最大3列折り返し・縦スクロール化。status view は無変更
- **git**: `merge origin/main`（MainScreen `headerControls` conflict を #322 側採用 → `HeaderUndoRedo` 重複解消・itemContextMenu 8 テスト回復）。リモート旧 `claude/materials-refine`（54 コミット）は全て squash merge 済みと確認（PR #264/#270/#289/#308）→ `--force-with-lease` 貼り替え方針
- **QA / 残**: role-qa 独立レビュー PASS（Blocking 0）。使用数の trash 過大計上 edge case（note soft-delete が assignment に非波及）を outbox で chat-main へ低優先起票依頼。残ゲート = push（拒否→ユーザー）/ PR / `supabase db push` 0022 / merge / Issue close

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
