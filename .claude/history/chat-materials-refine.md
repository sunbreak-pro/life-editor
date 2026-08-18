# HISTORY (chat-materials-refine)

### 2026-08-18 - RLS ゲートの誤検知修正（PR #1083）と known-issues 参照実績の実測（#1086 / #1087）

#### 概要

`npm run db:push` が Step 1 の RLS ゲートで止まる件を診断したところ、RLS 漏れは 1 件も無く、`npx` の CLI インストール確認プロンプトが stdout に混ざって CSV パースを壊していただけだった。ゲートを 2 点修正して PR 化し、併せて「known-issue は実際に読まれているのか」をトランスクリプト 784 ファイルの実測で検証して Issue 2 本に落とした。

#### 変更点

- **原因特定**: `supabase/node_modules` 不在 → `npx supabase db query` が CLI を取得しに行き `Need to install... / Ok to proceed? (y)` を **stdout** へ出力。プロンプトに改行が無いため本物の CSV ヘッダがその行末に連結され、`check-rls.sh:144` の `tail -n +2`（位置決め打ちのヘッダ捨て）がズレて npx の文言 2 行が offender 行に化けていた。`db-push.sh:75` は元から `npx --yes` で、付いていない呼び出しは `check-rls.sh:113` の 1 箇所だけだった
- **修正 (PR #1083)**: (1) `check-rls.sh:113` を `npx --yes` に (2) 本体スライスを CSV ヘッダ位置に anchor（前置ノイズが何行あっても捨てる・引用と CR を許容・プロンプトが行頭を奪うため `^` アンカーでなく部分一致・ただしヘッダ全体で照合するので `*table_name*` という名のテーブルは従来通りブロック）(3) ヘッダ不在時は exit 2 = INCONCLUSIVE。従来は空 body になり **読んでいない出力に対して PASS を返しうる穴**があった
- **self-test 追加**: A7（プロンプト混入でも all clear）/ A8（プロンプト混入が実 offender を隠さない）/ A9（sentinel はあるがヘッダ無し → inconclusive）。A1〜A9 緑。残る B*（sqlite3 未導入）と C3（CRLF チェックアウトに `^from \($` を grep）は変更前後で同一の環境要因
- **実 DB 検証**: main clone で `npm install` 後に `npm run db:check-rls` = **PASS**（未修正スクリプトでも通った = 診断の裏取り）。`supabase migration list` で **未適用は 0024 のみ**、かつ #1075 は既に merged と判明 — 0024 未適用のままテンプレート機能が出ている状態を memory の申し送りへ記録
- **known-issues の実測 (#1086 / #1087)**: `~/.claude/projects/` の 784 トランスクリプトを走査し (セッション, slug) で重複排除 → 679 件。うち 1 セッションで 15〜30 slug が出る 16 セッションが 6 割超を占める `ls` 由来の一括ヒットで、targeted に絞ると 031 = 51 / 027 = 31 / 他は全部 1 桁。その上位 2 件も `CLAUDE.md:68` と `memory/chat-main.md` からの自動注入で、自発参照ではない。30 本中 7 本（004 / 006 / 007 / 010 / 023 / 030 / 033）は参照 0。今回まさに 023 を読んで外した実例を #1087 の根拠に添えた
- **起票**: #1086 = 計測スクリプト化（bulk / targeted の分離と自動注入元の別枠表示を DoD に明記）/ #1087 = 採否条件を「常時ロードされる場所から ID 参照を張れるか」に絞る。どちらも `shared-fix`。本来 Issue 起票は chat-main 一元だが、こうだいさんの明示的な例外許可で materials-refine が起票

### 2026-08-18 - section:materials の 5 件を 1 Issue 1 ブランチで PR 化（#1041 #1042 #1040 #1043 #1047）

#### 概要

chat-main が配った materials レーンの 5 件を、それぞれ `origin/main` から切ったブランチで実装し、各本で CI verify（docs-lint / shared / web / desktop / mcp-server）をローカル全通ししてから PR にした。#1041 / #1042 / #1040 / #1043 は同日 merged、#1047（PR #1075）は `supabase db push` 待ちで open。

#### 変更点

- **#1041（PR #1052・merged）**: ja catalog の `section.materials` を「資料」→「素材」。コード側の `資料` 残存は 0 件。`.claude/archive/` と `history/`、2026-07-05 のデザインブリーフに残るものは当時の記録なので書き換えず、tier-2 の「参考資料」は一般名詞なので対象外と判断
- **#1042（PR #1055・merged）**: ノート詳細のタグ行から `ItemRoleBadge`（#412）を撤去。ノート自身のタイトルの真下で「ノート」と名乗り、しかも「+ タグ」の左隣にいたので「ノート / タグ」の対に読めていた。Todo 詳細とタグ編集のアイテム一覧では「どの種類に付けているか」が本当に要るので残置
- **#1040（PR #1064・merged）**: `TodoDetailPanel` の日時行（#877）を disclosure 化。キャプション自体がトグルで、既定は畳む。`scheduleSet`（ホストが `todoScheduleSlot(todo) != null` で渡す）で**日時ありは開いた状態**。開閉は未操作のうち `scheduleSet` に追従する（`undefined` = 未操作 = 同ファイルのタイトル draft と同じ書き方）— パネルを開いたままカレンダーにドロップして日時が付いたとき、押し直さずに見えるようにするため
- **#1043（PR #1067・merged）は「撤去対象ゼロ」だった**: Note ⇄ Todo / Event の変換は UI にもロジックにも i18n にも実在しない。変換は Todo ⇄ Event（#625 `itemConvert.*` / `SupabaseItemConversionService`）だけで、それは Issue が明示的に残す側。予定作成パネルの「種類 = ノート」タブは item_links のエッジを張るもので変換ではない。**消すものが無いので、決定を tier-1-core の Notes「やらない」に書く docs PR に切り替えた**
- **#1047（PR #1075・open）ノートテンプレート**: Issue が言う「既存 Templates 資産の再利用」は不可能だった（Tauri 時代の Todo ツリー版で `frontend/` + `src-tauri/` ごと #197 で削除済み）。現行スタック上に新規実装
  - **テーブルを足さず `notes_payload.note_type='template'`**（migration `0024_notes_template_type.sql` で CHECK を widen）。テンプレートは「まだ書いていないノート」なので、器を別に作るよりノート行に札を足して一覧側で外す方が筋が通る。作成 / 更新 / 削除 / 取得は既存のノート用メソッドをそのまま通る
  - **入口 = ノート詳細の 3 点メニュー「テンプレートを作成する」** → `ResponsiveDetailFrame`（Desktop = オーバーレイ / Mobile = 全画面シート = 要求どおりの画面遷移）
  - **タグ / リンクは「隠す」ではなく「不在」**: タグ行を出さないだけでなく、本文エディタに `[[` の loader を渡していないので打っても付けられない。テンプレートから作ったノートは普通のノートなので両方付く
  - **除外は 4 read すべて**: 一覧 / ゴミ箱一覧 / 検索 join は legacy folder と同じ `keep` 節（`isNoteTemplateRow`）、バッジ件数は `countLiveNotes` の `or(...)` に脚を追加。返すのは `listNoteTemplatesUnified` だけ。だからパネルは `NotesUnifiedContext` ではなく DataService を直接見る（context に入れると「保持するが全消費者から隠す行」を教え込むことになる）
  - 削除はソフトデリートだが**ゴミ箱も同じフィルタで外す**ので UI からは戻せない（DB には残る）。tier-2-supporting.md に明記
- **既存テストを 3 本追随させた**: `materialsCountQueries` / `supabaseNotesUnifiedReads` は PostgREST の `or` 文字列を丸ごと固定していたのでテンプレート脚を含む形へ、`lazyEditorChunk` は `NoteTemplateHost` を許可リストへ（`NoteBodyEditor` と同じく既に lazy な NotesView の中）
- **web の eslint に 1 つ引っかかった**: `react-hooks/set-state-in-effect`。effect 本体で `setLoading(true)` していたので、loading を「一覧がまだ null か」から導出する形に組み替え、setState はすべて promise のコールバック側へ寄せた
- **検証**: 5 本すべてで docs-lint / shared（lint・build・typecheck:tests・test）/ web（同）/ desktop（typecheck・test・build）/ mcp-server（build・test）が exit 0

### 2026-08-16 - #876 Mobile の Note / Daily を「一覧はサイドバー・メインは本文」へ（PR #962）

#### 概要

裁定 D-20260815-materials-2 = A（ボトムシートを畳む）に従い、Mobile の Note / Daily を Desktop と同じ 1 レイアウトにした。一覧は両幅とも詳細パネルの中身（narrow = ハンバーガーの `MobileDrawer`）、メインは選択中アイテムの本文。PR #962 提出（Closes #876・merge = こうだいさん）。

#### 変更点

- **配線は 1 行の話だった**: `RightSidebarPortal` の `isWide` ゲートを外すだけで一覧はそのままドロワーに入る。Materials は既に `narrowHeader: "tabs+hamburger"`（`sectionDescriptors.tsx`）なので導線も既存のものが効いた
- **Notes の退役 2 件**: 92%→全画面の detail sheet（#471）と、それを開くためだけの `NotesMobileList`（261 行）。メインが本文になった以上シートは同じノートへの 2 つ目の窓になる
- **副産物として穴が 1 つ消えた**: シートは一覧が本文を持たない状態でノートを**同期的に**開くため、自前の `isContentLoaded` ゲート（`useNoteSheetTarget`）が要り、無いと空本文の上にエディタが載って初打鍵で空を保存する（#475）。選択側にはこの穴が元から無い — `useNotesUnifiedAPI.selectNote` は id を切り替える**前に** hydrate する。よって `useNoteSheetTarget`（94 行）と `useNoteLinking` の `onPendingSelected` seam をまとめて落とせた
- **Daily**: 過去エントリのパネル（並び替え / 方向 / 絞り込み + エントリ一覧）を両幅共通の `pastEntries` に集約してドロワーへ。narrow の「過去のエントリ」2 件テーザーは退役 — テーザーは 2 行、`DateStrip` は 14 日ぶんで、**40 日前のエントリはスマホから到達不能だった**。`DateStrip` は本文側に残置（あれは書いている日の移動であって一覧ではない）
- **narrow 固有として残したもの**: 詰まったタイトルの `variant`（シートが使っていた方）と、タイトル先行の作成（ツールバーの「+」が `QuickAddSheet`）。一覧から選ぶとドロワーを閉じる（モーダルなので開いたものを自分で覆う）
- **Links（#884）は wide 専用のまま**。#884 が明示的に決めた箇所で今回の裁定はレイアウトの話しかしていないため広げず、判断キュー `D-20260816-materials-1` に積んだ（放置時 = 現状維持）
- **DailyView は null-safe hook に**: `useRightSidebarOptional` を使う（`RightSidebarPortal` 自身と同じ読み方）。この tab はテストで Provider 無しに単体 render されており、必須依存にすると 16 本が一斉に落ちる
- **docs / i18n**: `mobile-scope.md` #7 / #8 をシート前提から「メイン本文」前提へ更新（裁定の申し送り）。孤児になった `materials.notes.detailTitle` / `materials.daily.pastEntries` を en / ja 両 catalog から撤去
- **テスト**: 旧挙動を固定していた分を新挙動へ書き換え — `notesView.test.tsx` narrow 5 本 / `dailyView.test.tsx` narrow 3 本 / `useNoteLinking.test.tsx` handoff 2 本。`useNoteSheetTarget.test.tsx`（202 行）は面ごと削除
- **検証**: shared lint / build / test（2232）、web lint / build / test（472）、`docs-lint.sh` すべて exit 0。jsdom にレイアウトが無いためドロワーの実際の重なり・スクロール所有権は自動テストで見えない → 実機の狭幅目視はこうだいさんの手番

### 2026-08-16 - #896 KanbanView / TagEditModal の分割（PR #953）

#### 概要

Materials に残っていた 1,000 行級 2 本を、挙動変更ゼロで分割した。`TagEditModal.tsx` 1,050 行 → `shared/src/components/tagEdit/` 8 ファイル（最大 394）、`web/src/todos/KanbanView.tsx` 946 → 384 行。PR #953 提出（Closes #896・merge = こうだいさん）。

#### 変更点

- **TagEditModal**: 1 ファイル内に同居していた 4 コンポーネント（`TagEditModal` / `TagMasterList` / `TagDetailPane` / `TaggedItemList` / `TagIconPicker`）をそれぞれのファイルへ。加えて公開 props を `types.ts`、下書きオーバーレイの導出（`tagRowPatch` / `NO_EDITS`）を `tagRowPatch.ts` に分離。`tagEdit/index.ts` を置いて公開名を 4 つに絞り、列やピッカーは内部に留めた。app barrel 側は import 元が `./TagEditModal` → `./tagEdit` に変わっただけ
- **KanbanView**: 残したのは配線のみ。`useKanbanColumns`（labels + 3 つの column model）/ `KanbanBoardSurface`（ツールバー + plain / DnD 分岐 + DragOverlay）/ `TodoDetailContent`（両幅が開く詳細パネル）/ `useTodoDetailActions`（4 つの出口と各々が先に聞く質問）/ `useTodoAddDialog` / `TodoBodyDraft` へ切り出し
- **`useTodoDetailActions` を 1 本にした理由**: convert / delete / discard / shell teardown の 4 出口が**同じ ConfirmDialog と同じ dirty ref を共有**している。別インスタンスに割ると delete の確認が discard の確認の上に重なり得るし、convert が自分用の dirty フラグを読むとパネルが書く値とズレる
- **コメントの再配置**: 元ファイルの設計コメントは削らず、記述対象のファイルへ移した（レイアウトの経緯 → `TagDetailPane` / `TagMasterList`、下書きオーバーレイ → `tagRowPatch.ts`、DnD の非対称 → `KanbanBoardSurface`）
- **挙動不変の機械照合**: 分割前後で KanbanView 系の `t()` キー 46 件、TagEditModal 系の `lumen-*` を含む class 文字列 36 件、KanbanView 系の同 4 件がいずれも完全一致。既存テストは**無改変**（テストファイルの diff ゼロ）で緑
- **検証**: shared lint（0 error / 既存 warning 3）・build・test 2232、web lint（0 error / 既存 warning 4 = すべて CalendarTab）・build・test 485 の 6 ゲートが exit 0。`desktop` は未変更のため対象外（当 worktree に `desktop/node_modules` 未インストール）

### 2026-08-16 - #873 Todo ステータスを保存値ごと 2 値化（PR #926）

#### 概要

裁定 D-20260815-materials-1 = B（2026-08-16 回答）に従い、Todo のステータスを表示だけでなく型・保存値・MCP API まで 2 値（`NOT_STARTED` / `DONE`）へ畳んだ。PR #926 提出（Closes #873・merge = こうだいさん）。DDL は不要で、既存の `IN_PROGRESS` 行は読み出し時に未完側へ折り返す。

#### 変更点

- **型と列挙の 1 点化**: `TodoStatus` を 2 値に（`shared/src/types/todoTree.ts:17`）。Kanban のステータス列・Mobile のフィルタチップ・タッチ選択行はいずれも `todoStatusVisuals.STATUS_ORDER` から導出されているため、そこを 2 要素にするだけで 2 列 / 2 チップ / 2 択に追随した（`buildColumns` は無変更で 2 列になる）
- **リスト行のコントロール**: `TodoStatusCycleButton` を削除し `shared/src/components/TodoStatusCheckbox.tsx` を新設（`role="checkbox"` + `aria-checked` + `toggledTodoStatus`）。3 値の巡回に対応する ARIA ロールが無く、読み上げが「Status: Not started, button」で押した結果を名乗れていなかったのが、2 値化で解消できる部分。`TodoDetailPanel` 内蔵の切替も同じ checkbox セマンティクスに
- **レガシー行の吸収（DDL なし）**: `tasks_payload.status` の CHECK は 3 値のまま据え置き。`todoMapper.toStatus` が `IN_PROGRESS` → `NOT_STARTED` に畳む（`toNodeType` がレガシー `"folder"` を畳むのと同じ形）。読み取り行の型も `TodoStatus | "IN_PROGRESS" | null` にして、DB に存在しうる値を型でも認めた。移行 SQL は不要で、次にそのアイテムを触ったときに 2 値で上書きされる
- **MCP（宣言どおりの破壊的変更）**: ツールスキーマ 4 箇所の enum と `toDbStatus` から `in_progress` を撤去（送ると `Invalid status`）。`toToolStatus` はレガシー行を `not_started` で返す。**briefing の 2 本目の open-todo クエリ（`status = IN_PROGRESS`）を撤去**し、open todo の定義を carry-over（窓の開始より前に予定され未完）のみに統一 — 残すとレガシー行だけが永久に「進行中」として出続けるため
- **docs**: `docs/requirements/tier-1-core.md` の Boundary「3 段階ステータス」と AC2（巡回 → トグル）、`docs/requirements/mobile-scope.md` #6 の「3 択タッチ行」を更新
- **テスト**: 新規 `shared/tests/todoStatusCheckbox.test.tsx`（role / aria-checked / 双方向トグル / 44px）+ mapper のレガシー畳み込み 2 本 + MCP の `in_progress` 拒否とレガシー読み出し 2 本。既存の 3 値前提テスト（applyStatusChange / briefingView / todayTodoTray / mobileTodoList / weekContext 等）を 2 値へ書き換え
- **検証**: shared lint / build / typecheck:tests / test（2201）・web 同 4 種（408）・mcp-server build / test（283）・docs-lint すべて exit 0。mcp の `silentDrops` 1 件だけ落ちるが、開発機に `LIFE_EDITOR_SUPABASE_*` があると「認証情報が無い前提」の合格条件が崩れるためで本変更とは無関係（CI では緑）
- **判断の台帳化**: D-20260815-materials-1（= B）と D-20260815-materials-2（= A・#876 でボトムシートを畳む）を `.claude/decisions/` へ昇格し、キューを空にした
