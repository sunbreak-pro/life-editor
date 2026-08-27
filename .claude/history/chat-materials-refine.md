# HISTORY (chat-materials-refine)

### 2026-08-27 - #1139 SupabaseTodosService の items_meta DELETE 2 箇所に role ガード（PR #1150）

#### 概要

#1099 が Todos 側の UPDATE 4 箇所で塞いだ穴の、DELETE 側にあたる残余経路を塞いだ。#1098（PR #1113）が schedule 側でやったことの Todo 版で、UPDATE より重い — 間違った UPDATE は押し直せるが、間違った DELETE は 0008 の CASCADE で payload ごと持っていくため戻せない。PR #1150 提出（Closes #1139・merge = こうだいさん）。

#### 変更点

- **穴の本体は `permanentDeleteTodo`**: このメソッドは `idsToDelete` を `fetchTodoTree()` + `fetchDeletedTodos()` から作り、どちらも `role='task'` で絞っているので一見自衛できている。実際はしていない — `collectDescendantIds` が**プールを見に行く前に `id` 自身を結果へ入れる**（`ids.add(id)`）ため、呼び出し元が渡した id はどちらの read も見ていなくても DELETE ループへ届く。これが Issue の筋道 3（端末 B が trash 済み Todo を復元して Event へ変換 → 端末 A が古い Trash 一覧のまま「完全に削除」）で、修正前はその 1 クリックが Event の `items_meta` 行と `events_payload` を落としていた
- **子孫の窓は狭い**: 子孫は role 絞り込み済みプール経由でしか `idsToDelete` に入らないので、ガードが救うのは read と自分の DELETE の間に変換された子だけ。救った子の `tasks_payload` が残っていると（変換の payload drop は best-effort）0009 の複合 FK が ON DELETE NO ACTION なので**親の DELETE が拒否され purge が throw する**。#1098 が `permanentDeleteRoutine` で取ったのと同じ取引で、理由も同じ（拒否された purge は診断可能な残骸を残すが、ロール違いの hard delete は何も残さない）。この取引は doc comment に明記した
- **`createTodo` の R2 孤児回収はノーオペ**: 同じ呼び出しが 3 文前に insert した行が相手で、`items_meta.id` は一意なので変換方向が存在しない。「すべての items_meta DELETE は role を名乗る」を読み手が検算できる規則のまま保つために付けた、と comment に書いた。実際に買えるのは逆側の失敗 — フィルタを打ち間違えると孤児が残り、それはこの回収処理が防いでいる当の R2 違反なので、テストは孤児が本当に消えたことを assert する
- **テスト = 既存 `shared/tests/todoMetaRoleGuard.test.ts`（#1099 の pin）を #1113 と同じ形に育成**（10 → 16 ケース）。新規ファイルにしなかったのは PR #1113 の前例に合わせたため（モックが 1 つで済む）
- **モックの穴を 2 つ塞いだ**: (1) delete 分岐はフィルタを適用していたが記録していなかったので、census assertion を書いても空配列を読んで誤って緑になる。(2) `insert()` がスタブで、`.insert().select().single()` がテーブルの先頭行を返していた — R2 回収へ到達するにはテーブル別の失敗スイッチ付きの本物の insert が要る
- **DELETE の生存判定はテーブルから読む**: delete 分岐が配列を差し替えるため、テストが掴んでいる行オブジェクトは削除成功時も生き残る。`expect(converted).toEqual(snapshot)` はどちらでも通ってしまうので `metaIds(db)` ヘルパを置き、ヘッダにも罠として明記した
- **`beforeFirstMetaDelete` フック（schedule 側のモックには無い）**: 子孫は「最初から変換済み」になれないので、purge の途中で role を動かすしか「救われた子が親を止めない」を pin する方法が無い。葉が先・1 件 miss・1 件 hit の順序を assert する
- **census を `;` 分割から #1113 のチェーン walker へ差し替え**: 括弧の深さを数えてチェーンを歩き、role は**トップレベルのリンクからだけ**読む。verb に辿り着けない `.from("items_meta")` は「読めない」として落ちるので、走査できない形で書かれた DELETE は「異常なし」に消えず報告される。旧スキャナは文字列中の `;` や verb が先頭リンクでないチェーンで黙って数から漏れていた
- **pin は 4 本**: DELETE 面（`createTodo → task` / `permanentDeleteTodo → task`）・#1099 の UPDATE 面を同じ walker で言い直したもの・role を WHERE に置けない 2 箇所（`createTodo → insert` / `syncTodoTree → upsert`。どちらも行本体に `role: "task"` が載る）。最後のペアを名指しで固定しておかないと、そこが他の assertion にとって無言の穴になる
- **mutation 実測 4 通り**: `permanentDeleteTodo` のガード剥がしで 5 件赤（振る舞い 2 + census 3）、`createTodo` で 4 件赤（振る舞い 1 + census 3）、role を `"todo"` と誤記（#831 の罠）で 4 件赤（「live な Todo を purge できる」対照側が落ちるのが要点）、チェーンを 2 文に割って走査回避で 4 件赤（自己チェックが落ちる）
- **スコープ外**: Notes / Dailies / ItemConversion 各サービスの `items_meta` DELETE（Issue が `SupabaseTodosService` を名指し・#625 が動かすのは `event` ⇄ `task` だけ）と、`updateTodo` の読み返し SELECT（READ であり、安全性は mapper の `assertItemsMetaPair` が持つ。既存の 2 ケースが pin 済み）
- **検証**: shared（lint・build・typecheck:tests・test 270 files / 2561）/ web（同・87 / 849）/ desktop（typecheck・test 7・build）/ mcp-server（build・typecheck:tests・test 24 / 318）/ docs-lint、CI verify の 14 ステップ + docs-lint すべて初回で exit 0（フレークなし）

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

