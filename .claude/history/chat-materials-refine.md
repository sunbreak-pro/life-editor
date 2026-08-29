# HISTORY (chat-materials-refine)

### 2026-08-30 - PR #1221 の main マージ解決ミスを修復し、テンプレート 2 機能を両立させた

#### 概要

#1180（テンプレート一覧・編集）の PR #1221 で CI の `typecheck + test + build` が赤になっていた。原因は #1179（PR #1216）着地後の main 取り込みで、解決が「main が消した側を残し、main が足した側を落とす」形になっていたこと。両方残す形に直し、両立で露見した読み直しの穴も塞いだ。

#### 変更点

- **materials barrel**: 実在しない `./NoteTemplatePanel` の re-export を除去し、main の `TemplateSavedPanel` の export を復旧（CI が報告した TS2307 はこれ 1 件。tsc は 1 件目で止まるので、以下 2 つはログに出ていなかった）
- **NotesView**: 本 PR の hook / panel を import しながら main の hook / panel を呼ぶ状態だった（`templates` の二重宣言）。両方を残し、register 側を `templates`・library 側を `templateLibrary` に改名して分離
- **code-split allowlist**: main で削除済みの `notes/NoteTemplateHost.tsx` が `lazyEditorChunk.test.ts` の ALLOWED に復活していたので除去
- **両立で出た穴**: 登録は #1179 の hook が書き、サイドバー一覧は #1180 の hook が読む。読み直しは sync カウンタでしか起きず、ローカル書き込みではカウンタが動かないため「登録したテンプレートが一覧に出ない」。library に `refresh()` を足し、`savedId` の両端（書き込みの着地・受領パネルの閉じ = 名前確定）で `NotesView` が呼ぶようにした
- **テスト**: `web/tests/noteTemplateLibrary.test.tsx` に「三点メニューから登録したテンプレートを一覧が拾う」を追加（8 → 9 件）
- **main の再取り込み**: Connect 復活 / related panel / Daily サイドバー等を衝突なしで取り込み、CI verify 相当をローカル全ステップ実行（shared 2631 / web 908 / desktop 7 / mcp 319・docs-lint OK）

### 2026-08-29 - Materials 6 Issue を 6 ブランチ / 6 PR に（#1179 #1180 #1181 #1172 #1189 #1183）

#### 概要

2026-08-29 dispatch 分の 6 件を、1 Issue 1 ブランチ・全て `origin/main` から独立（ユーザー指示）に落とした。テンプレート 3 本（登録 → 一覧・編集 → 適用）+ Related パネル + Daily サイドバーの整理 + エディタのチェックボックス拡大。各本でローカル CI verify 14 ステップ + docs-lint を exit 0。PR #1216 / #1221 / #1227 / #1232 / #1236 / #1237（merge = こうだいさん）。

#### 変更点

- **#1179（PR #1216）テンプレートとして登録する**: 三点メニューを「テンプレートを作成する」→「テンプレートとして登録する」に刷新し、押下で**開いているノートの本文ごと**テンプレート行（`note_type='template'`）を 1 操作で作る。生成後に受領パネル（Modal・上部にテンプレート名の入力欄・初期値「{ノート名}のテンプレート」）。タグ / リンクは引き継がない（2026-08-29 ユーザー裁定・#1047 の前提維持）。**パスワードロック中は項目ごと出さない** — #526 のゲートは本文だけを覆うので、テンプレートへ複製するとロックの外へ本文が出る。旧工房（`NoteTemplateHost` / `NoteTemplatePanel` + `web/tests/noteTemplates.test.tsx`）はここで撤去
- **#1180（PR #1221）rightSidebar の一覧 + 中央パネル編集**: Trash の上に「テンプレート」折りたたみ（件数つき）。各行に鉛筆（編集）と ゴミ箱（削除）。鉛筆で**本文を取得してから**中央パネル（通常ノートと同じ 28px ボーダーレスのタイトル + 本文、下部にキャンセル / 保存）を開く。エディタは **`onDraftChange`（#713 のドラフトモード）**で配線 — 既定の `onUpdate` は 800ms デバウンス + unmount フラッシュなので、素早い「保存」で最後の打鍵が落ち「キャンセル」でも書き込まれる。Escape とバックドロップは**どちらもキャンセル**。パネルは sidebar portal の外（View 直下）にマウント — 狭幅ではその portal が MobileDrawer で、中に置くとドロワーと一緒に消える
- **#1181（PR #1227）テンプレートから反映する**: 三点メニューの 2 項目め。一覧 → 選択 → **破棄確認** → 現ノートの本文を置換。一覧クリックは何も書かない（browsing が下書きを消す設計にしない）。置き換えるのは**本文だけ** — テンプレート名でノートを改名するのは頼まれていない 2 つ目の編集。`NoteBodyEditor` に `remountToken` を追加（既定 0）: `RichTextEditor` はマウント後 `initialContent` を見ないので、key を変えないと「保存済み本文は差し替わったのに画面は元のまま」になる。ロック中は非表示（#1179 と同じ理由）
- **#1172（PR #1232）LinkPanel を Related パネルへ**: 「+ リンク」の隣に関連ピル（件数）。3 セクション = **リンク**（送信 / 被リンクを #884 どおり相手アイテム単位で 1 リストに）/ **同じタグのアイテム**（TagPicker が読む `allAssignments` から導出・追加クエリなし・リンク済みは除外して 1 隣人 1 行）/ **同じ日のデイリー**（`daily-<YYYY-MM-DD>` の id lookup。日付は host が `dateKeyOfInstant` で渡す — `slice(0,10)` は UTC 文字列を切って JST 09:00 前に前日を指す = #413）。プールで名前が引けないアイテムは載せない（行の存在意義は辿れること・ナビは role がキー）。見出しに全件数・リストは先頭 8 件。**コンポーネント名は `LinkPanel` のまま**（改名すると `../src/wikitag` を差し替えている全スイートに波及する）
- **#1189（PR #1236）Daily サイドバーの日付タブ撤去**: 「今日」「昨日」は entry 行やピッカーと同じ selectedDate を動かすだけなので、名前どおりの日以外では何も変わらず「壊れたフィルタ」に見えていた。狭幅本文の `DateStrip`（直近 14 日）も撤去 — 提供する日は全部ピッカーで届く範囲の部分集合。コンポーネント本体・`stripDays`・props・i18n 4 キーまで削除。**日付ピッカーは残した**（エントリが無い日を開く唯一の導線）
- **#1183（PR #1237）エディタの Todo チェックボックス**: スラッシュコマンド「チェックボックスリスト」と `[] ` で出るチェックボックスが UA 既定（約 13px）だった。`1.05em` + `flex: none`。px でなく em にしたのは、エディタ本文のフォントが固定でない（モバイルのフィールド床 #1134）ことと、ラベルが 1.6em の行ボックス中央に置いている（#883）ことの両方に追随させるため
- **テストは 5 本追加 / 3 本更新**: 新規 `noteTemplateRegister`（8）/ `noteTemplateLibrary`（8）/ `noteTemplateApply`（7）/ `relatedPanel`（7）/ `taskListCheckboxSize`（3）。更新 = `linkPanel.test.tsx`（fake context に `allAssignments` / `getTagsForItem` 追加）・`dailyView.test.tsx` と `dailyScreenActions.test.tsx`（日を切り替える手段をピッカーへ）・`dailyEntriesPanel.test.tsx`（トグルのテストを「無いこと」へ）。#1181 の remount テストは**空 dep の effect で数える** — render body で数えると再レンダーも数えてしまい、key 変更を外しても緑のままになる。#1183 は CSS だけなので jsdom では何も測れず（要素の座標が 0）、`fieldFontFloorLockstep.test.ts` と同じくソーステキストを読む形にした
- **独立ブランチ制約でこうした**: #1180 は旧工房を**触らない**（撤去は #1179 の担当。同じ行を 2 本で消すと衝突するだけ）。i18n の `materials.templates` ブロックは 3 本で挿入位置をずらした（#1179 = `menuEntry` 直後 / #1181 = `pickHint` 直後 / #1180 = `bodyPlaceholder` 直後）ので自動マージが効く
- **検証**: 6 ブランチそれぞれで shared（lint / build / typecheck:tests / test）→ web（同 4 種）→ desktop（typecheck / test / build）→ mcp-server（build / typecheck:tests / test）+ `docs-lint` を全通し、すべて exit 0。GitHub CI も 6 本とも SUCCESS

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
