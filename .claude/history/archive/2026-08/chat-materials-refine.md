### 2026-08-19 - #1099 SupabaseTodosService の items_meta UPDATE 4 箇所に role ガード（PR #1105）

#### 概要

#996（PR #1080）が Event / Routine 側で塞いだ穴の、Todo 側にあたる残余経路を塞いだ。#625 の変換は id を保ったまま role だけを動かす（D-20260810-sched-2）ため、Todo → Event を挟むと `items_meta.id` は安全な宛先ではなくなる。PR #1105 提出（Closes #1099・merge = こうだいさん）。

#### 変更点

- **`shared/src/services/SupabaseTodosService.ts` の `items_meta` UPDATE 4 箇所に `.eq("role", "task")`**: `bumpItemsMetaUpdatedAt`（private・現在は呼び出し無し）/ `updateTodo` / `softDeleteTodo` / `restoreTodo`。本 PR 前は 0 箇所だった
- **role の値は `"task"` であって `"todo"` ではない**（#831 でドメイン名だけ改称・判別子は据え置き）。ドメイン名から書いたガードはどの行にも当たらず正当な書き込みまで全部 miss するので、テストには必ず live な Todo の対照行を添えた
- **終わり方が 2 通りある**: `softDeleteTodo` / `restoreTodo` は 0 行ヒット（PostgREST はエラー無しの成功で返すので stale な undo エントリは静かに消える）。`updateTodo` は行を読み返すので reject する — 変換の best-effort な payload 掃除が着地していれば `requireRowPair` が、孤児が残っていれば `rowsToTodoNode` の `assertItemsMetaPair` が落とす
- **スコープ外**: `syncTodoTree` の UPSERT 1 箇所（role は WHERE ではなく行本体に載る）と DELETE 2 箇所（`createTodo` の R2 孤児回収 / `permanentDeleteTodo` の purge）。Issue の DoD が UPDATE と明記しているため
- **既存呼び出し側の実害を 1 点確認**: 変換 undo（`web/src/schedule/useItemConversion.ts:209`）だけが変換と `updateTodo` を続けて呼ぶが、先に `convertEventToTodo` で role を `task` へ戻す順序なので弾かれない
- **テスト `shared/tests/todoMetaRoleGuard.test.ts`（新規・10 ケース）**: フィルタを実際に適用する in-memory PostgREST スタブ。`.single()` が 0 行をエラーで返す PostgREST の挙動（PGRST116）もスタブ側で再現（updateTodo の reject 経路がそこに乗るため）。振る舞いテストとは別に、ソースを読んで「UPDATE チェーンが 4 本・全部 role 付き」を assert する数え上げ 3 ケースを置いた — private で呼び出し元の無い `bumpItemsMetaUpdatedAt` は振る舞いから到達できず、将来ガード無しで足されたメソッドも素通りするため
- **テストが効いていることを実測**: ガードの 4 行を剥がすと 10 ケース中 5 ケース（変換済み行の untouched 4 本 + 数え上げ 1 本）が落ちる
- **検証**: docs-lint / shared（lint・build・typecheck:tests・test 2513）/ web（同・705）/ desktop（typecheck・test 7・build）/ mcp-server（build・typecheck:tests・test 301）すべて exit 0

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

### 2026-08-15 - materials 7 件連続処理（PR #888 / #899 / #908 / #911 / #912 + 判断キュー 2 件）

#### 概要

section:materials の 7 Issue を bug 先行の指定順で処理し、5 件を 1 Issue = 1 ブランチ = 1 PR で提出、2 件（#873 / #876）はユーザー体験の分岐を含むため P-005 に従い判断キューへ回した。全 PR で `shared` / `web` の lint / build / test 6 ゲートが exit 0。UI の実ブラウザ確認は chat-main 手番のため worktree 側は型検証まで。

#### 変更点

- **#886（PR #888）**: `MenuItem` のフォーカス塗りを `focus:` → `focus-visible:`。`<Menu>` は開いた瞬間に先頭行へフォーカスを当てる（WAI-ARIA メニュー作法）ため、ポインタで開くと先頭の Pin / Unpin だけがホバー色で居座っていた。矢印キーのロービングフォーカスは従来どおり光る。回帰テストを `shared/tests/components.test.tsx` に追加
- **#883（PR #899）**: taskList のラベルを `margin-top: 0.2em` の手当てから、本文 1 行目と同じ「上マージン 0.4em + 高さ 1.6em の行ボックス + 中央寄せ」に変更。フォントサイズや行間が変わっても両者の中心が一緒に動く。jsdom にレイアウトが無く縦位置は自動テスト不可（`web/src/index.css`）
- **#884（PR #908）**: Links を rightSidebar の disclosure から詳細ヘッダーの [+Tag] 右隣へ移設（`NoteDetailPanel` に `linksSlot` を追加してタグ行を共有）。From / To の 2 ブロックを相手アイテム単位の 1 リストへマージし、両方向に張られたペアはチップ 1 個・× で対を結ぶ行を全消し。保存側のデータ構造は不変。方向系 i18n キー（outgoing / backlinks / 各 Empty / loading / `materials.notes.links`）を退役。**モバイルシートには渡していない**（従来モバイルに Links 導線が無かったため — PR 本文に申し送り）
- **#885（PR #911）**: `NoteDetailPanel` の kebab 直左に塗りつぶしピンを表示（`pinnedLabel`・`notesView.pinned` を en/ja 追加）。ボタンではなくマーカー（解除はメニュー側のまま）。デスクトップ本文とモバイルシートが同じ部品を使うため 1 箇所で両幅に出る
- **#875（PR #912）**: `SectionDescriptor` に `narrowWidth` を追加し、Materials は狭幅のみ `fluid`。MainScreen は section id で分岐せず descriptor の値を読む。Notes / Daily の狭幅は元から「`h-full` 外枠 + 内側 `overflow-y-auto`」で書かれており、この形が本来の想定。**Daily の狭幅もスクロール所有権が同時に変わる**ため、D-20260810-mobile-3 = B の懸念どおり merge 前に実機確認が要る旨を PR 本文に明記。`web/tests/sectionNarrowWidth.test.ts` を新設
- **キューへ回した 2 件**: D-20260815-materials-1 = #873 の 2 値化を「表示だけ」か「保存値ごと」か（IN_PROGRESS は 12 ファイル参照・Kanban は 3 列・MCP も 3 値）。D-20260815-materials-2 = #876 でモバイルの詳細ボトムシート（#471 / mobile-scope #7）を畳むか。どちらも放置時は当該 Issue 保留
# HISTORY ARCHIVE (chat-materials-refine, 2026-08)

ローリングアーカイブ: `history/chat-materials-refine.md` が 5 件超過した際に最古エントリをここへ移動。時系列降順。

### 2026-08-13 - #776 inline `[[` リンク配線の 3 つ写しを 1 実装へ（PR #808）

#### 概要

「本文の `[[ ]]` リンクを item_links のエッジにし、保存時に本文から消えたエッジを畳む」という配線が Notes / Tasks / Daily に 3 実装あったのを、`web/src/hooks/useInlineItemLinks.ts` 1 本に畳んだ。Notes と Tasks は逐語コピーで差は `console.error` のタグ 1 文字列だけ、Daily は同じ 3 手が park / flush の中に埋まっていた。PR #808 提出（Closes #776・merge = こうだいさん）。挙動変更なし。

#### 変更点

- **共有 hook**: 新規 `web/src/hooks/useInlineItemLinks.ts` が 3 手（`getLinksForItem` の重複ガード / `createItemLink(..., "inline")` / 保存後の `syncInlineLinks`）を持つ。置き場は 3 面が等距離で届く `web/src/hooks/`。`useItemLinkTargets` の `web/src/notes/` からの移動は見送った — `RichTextEditor` も同じく notes 配下から 3 面が横断 import しており、動かすなら一緒に動かす話になってスコープが膨らむ
- **写し痕の解消**: `console.error` のタグをホスト名の引数にした（`useInlineItemLinks("NotesView")` / `("KanbanView")` / `("DailyView")`）。`useTaskLinking.ts` の中に `[KanbanView]` が焼き付いていたのが Issue の指摘どおりコピー元の痕跡だった（Kanban はタスク詳細エディタの唯一のホストなので、呼び出し側が渡す名前としては正しい）
- **Daily**: park / flush（`pendingItemLinks`）は Daily 固有として残し、flush の内側だけ差し替え。`targetId === saved.id` の自己リンク判定は共有ガードに吸収（両方 skip なので結果同値）。`useWikiTagsUnifiedContext` の直接参照は DailyView から消えた
- **テスト +16 本**: `web/tests/useInlineItemLinks.test.tsx` 新設（8 本 = エッジ作成 / 生きた重複を書かない / soft-delete 済みなら書き直す / 自己リンク / 未保存 from / delete-sync / 失敗時タグが呼び出し元の名前になる×2）。`useNoteLinking.test.tsx` +3、`dailyView.test.tsx` +5（候補プールの受け渡し / park は保存着地で初めて書く #371 / 保存前に消したリンクは書かない / 既存エッジを触らない / 保存で消えたリンクの fold #372）。**Daily はエッジ作成も fold もこれが初カバー**。`useTaskLinking.test.tsx` は assertion 無変更で緑（DoD 要件）
- **jsdom 制約への当て方**: レイアウトが無く実サジェストのポップアップは駆動できない（CLAUDE.md §7.1）ため、Daily は stub エディタのボタンで「候補を選ぶ」「本文を保存する」を DOM イベントとして起こす形にした。ポップアップ自体は既存 `web/tests/itemLinkMenu.test.tsx` がカバー済み
- **検証**: shared lint（0 error / 既存 warning 3）・build・test 1980、web lint・build・test 285、shared / web の `typecheck:tests` — 8 ゲートすべて exit 0

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

