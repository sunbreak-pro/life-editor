# HISTORY (chat-materials-refine)

### 2026-08-11 - #680 Notes の i18n 取りこぼし 3 点を catalog へ（PR #693）

#### 概要

ゴミ箱行の aria-label・本文エディタの placeholder・en の件数表記という、ja 設定でも英語のまま出ていた 3 点を i18n catalog に載せた。表示のみで機能影響はなかったが、アイコンだけのボタンでは aria-label が読み上げの全部なので、スクリーンリーダー利用者には英語しか届いていなかった。PR #693 提出（Closes #680・merge = こうだいさん）。

#### 変更点

- **catalog**: `materials.notes` に `bodyPlaceholder` / `untitled` / `restoreNote` / `permanentDeleteNote` を en/ja 両方へ追加。`materials.tasks.taskCount` は i18next の複数形（en = `_one` + `_other`、ja = `_other` のみ）に置換。呼び出し側 `KanbanView.tsx:252` は `t(key, { count })` のままで無改修（三項演算子を足していない）
- **ラベルの形**: ゴミ箱行の 2 ラベルは文字列でなく `(title) => string` のビルダーで渡す。ja は題名が文頭・en は文末に来るので、題名の置き場所は翻訳側の裁量にした
- **placeholder の持ち主**: `NoteBodyEditor` の中で `t()` を読む形にした（prop にすると Desktop 本文とモバイルシートの 2 箇所で渡し忘れが起きる — このファイルが存在する理由そのもの）。`RichTextEditor` の既定値も翻訳経由に変え、唯一まだ placeholder を渡していない Kanban 本文（#680 のスコープ外）も英語を出さなくなった
- **テスト**: `web/tests/notesI18n.test.tsx` を新設し、本物の i18next シングルトンを ja に切り替えて描画結果を読み戻す。既存 `notesView.test.tsx` は `t` をキーのエコーに差し替えるため、ハードコード英語も翻訳済み文字列も同じように通る = この種のバグに構造的に無反応で、3 点が描画対象なのに生き残った理由
- **lockstep 検査**: `shared/tests/i18n.test.ts` に en/ja のキー集合照合を追加。比較は**複数形サフィックスを剥いだ base key** で行う（en = one + other、ja = other なので、素のキー集合一致を要求すると i18next が決して読まない `taskCount_one` を ja に置く羽目になる）。`_other` は両側に必須。追加時点で既存キーの欠落はゼロ
- **検証**: shared lint / build / test（192 files・1623 tests）・web lint / build / test（25 files・190 tests）・`LC_ALL=C bash scripts/docs-lint.sh` すべて exit 0

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
