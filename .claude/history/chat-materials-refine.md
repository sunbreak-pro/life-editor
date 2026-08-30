# HISTORY (chat-materials-refine)

### 2026-08-30 - materials 5 件を 5 PR に分割提出（#1292 / #1285 / #1286 / #1287 / #1288）

#### 概要

2026-08-30 dispatch の materials 5 件を、それぞれ `origin/main` から独立に切った 5 本の PR にした（#1306 / #1313 / #1316 / #1319 / #1322）。うち 2 件は「未実装の機能」ではなく**既存機能が別の PR に壊されていた**もので、そちらの診断が本体だった。

#### 変更点

- **#1292（PR #1306）— 削除済みリンクが id の羅列で出る**: 症状の出どころは `LinkPanel.itemTitle` の最後の手段（`…${id.slice(-8)}`）。そこへ落ちる理由が `useItemLinkTargets` が soft-deleted 行を**捨てて**いたことで、`item_links` の行はリンク先より長生きするため削除の瞬間に「名前を知っている場所」がゼロになる。プールを「捨てず、フラグを立てる」に変え、id を握っている面（chip / related 行）は名前を引ける・新しいリンク先を**出す**面（`[[` メニュー・picker・関連リスト）は各自の境界でフラグを落とす形にした
- **id 短縮のフォールバックは残した**: プールに無いロール（event）は「削除済み」ではなく「名前が分からない」で、削除済みと言い切るのは逆方向の嘘になる。既存テストが `event-abcdef12345678` でこの経路を pin していたのも同じ理由
- **`resolveTitle` を live-only にした**: notes 配列は Trash 用に soft-deleted 行を保持しているので、host 側の live lookup が削除済みノートに答えると「生きている」と見えてしまう。プールの判断を上書きしない形へ
- **#1285（PR #1313）— セクション往復で選択が消える**: 「引き継ぐ」は #282 で実装済みで、**#1101（stale-while-revalidate）が壊していた**。スナップショットが当たったマウントは `useDomainLoad` で最初から settled 扱いになり `isLoading` が 1 レンダー目から false。復元 effect はそのレンダーのクロージャを読むので `notes` はまだ `[]` で、`notes.find(storedId)` の miss を「ノートが消えた」と解釈して `clearNotesSelection()` — 選択が落ちるだけでなく**記憶ごと消える**ので次の往復でも戻らない
- **復元を「適用された配列を引数で受け取る」形に変えた**（隣の `useTodoTreeAPI` が最初からそうしている形）。クロージャを読まないので同種のズレが起こらない
- **さらにスナップショット replay では復元しない**（`fetchLandedRef` を `load` の中で立てる）: replay は `useDomainLoad` の layout effect なので、そこで body の hydrate を始めると裏で走る再読み込みと重なる。その再読み込みの `mergeLoadedList` は `notesRef` を読み、React はそれを passive effect で更新するため**1 フラッシュ遅れることがあり、取ってきたばかりの body が merge で消える**（実測でテストが `expected '' to be 'real body'` で落ちた）。読み込みの着地を待つ = #1101 以前の正しいタイミングに戻すのが安全側
- **既存テストがこのバグを 2 Issue ぶん隠していた**: `materialsSelectionPersistence.test.tsx` の再マウント検証は**別の DataService インスタンス**を渡していて、スナップショットは identity で引くため常に miss = 常にコールドマウント相当だった。同じ ds を使い回す回帰テストを 1 本追加し、修正前のフックで実際に落ちることを stash して実測した
- **#1286（PR #1316）— サイドバーのごみ箱撤去**: Trash セクションと役割が被るため、props 5 本 + labels 4 本 + host の `trashOpen` state + 死にキー 3 本（en/ja）ごと撤去。162 行の純減。context 側の `deletedNotes` / `restoreNote` / `permanentDeleteNote` は TrashView が読むのでそのまま
- **#1287（PR #1319）— 行頭アイコンの入れ替え**: 全行同じドキュメントアイコンを外し、その位置にピン留めピン。**未ピン行でも同じ幅のスロットを必ず描く**（詰めるとピン留め行の周りだけタイトル開始位置がずれて一覧がガタつく）。アイコンの不在は lucide が `aria-hidden` で名前を持たないため **svg の本数**（ピン留め行 2 / 通常行 1）で pin した
- **#1288（PR #1322）— タグフィルタ複数選択 + 未フィルタ時の整理**: 選択は **OR**（一覧がタグ見出しでグループ化されているので、チップ = 「この見出しを出す」。AND は見出しの置き場が決まらない）。共有の `StatusFilterChips` は単一選択が契約でもう一方の利用者が Mobile Todos のため広げず、Notes ローカルの `NoteTagFilterChips` を新設した（one writer per artifact）。未フィルタ時のみチップ行 8 個上限（選択中は先頭へ寄せるので**効いているフィルタが隠れることはない**）+ グループ 5 行上限。タグを選んだ瞬間に行上限は外れる
- **#1291 は採用していない**: tags レーンの PR #1318 がほぼ同時に open になったが merge 前で、`origin/main` の `shared/src/components/` に共通タグチップは無かった。追随の差し込み口（`useNoteListState.tagFilterChips` の `icon` スロット 1 箇所）を PR 本文と outbox に記録した
- **#1292 の後半（削除時の確認パネル）は分割起票を outbox で依頼**: Todo の削除確認は `web/src/schedule/useScheduleTodoChips.ts` にあり schedule レーン専有。Issue の Scope 註が認めている分割で、DoD も「確認パネル**または**分割起票の記録」
- **検証**: 各ブランチで CI verify の 14 ステップ（`npm ci` を除く全部）をローカル実行。#1285 / #1287 / #1288 は初回で全緑、#1292 / #1286 は `briefingEveningLazyMount.test.tsx` の既知フレーク（vite の transform キャッシュが冷えていると落ちる）のみで、温めて再実行して緑。docs-lint はいずれも `.claude/**` を触らないため回さず CI に委ねた
- **運用で踏んだ罠 2 つ**: (1) バックグラウンド Bash の `timeout: 600000` は 10 分超で殺されうる上に `| tail` で出力ごと消える → **Monitor でステップ単位のイベントを流す**形に変えた（memory の verification-command-pitfalls 14 の実践）。(2) 検証の途中でファイルを直すと**途中の木を検証した結果**になる → lint 修正のあと頭から回し直した（同 11）

### 2026-08-30 - #1248 / #1255 — テンプレート削除に確認を挟み、空ノートに嘘の警告を出さなくした（PR #1260）

#### 概要

2026-08-30 の merge 後実ブラウザ検証（chat-main）で出た、Notes テンプレートの同じ一角の 2 件。押したら戻せない削除ボタンと、破棄するものが無いのに「破棄されます」と言う確認を、1 ブランチ 1 PR で直した。PR #1260 提出（Closes #1248 / #1255・merge = こうだいさん）。

#### 変更点

- **#1248 削除の確認**: `web/src/notes/NotesView.tsx` に `useConfirmDialog` を足し、`TemplateListPanel` の `onDelete` を `templateLibrary.remove` 直結から確認経由に変更。文言はテンプレート名入り・`danger`、確定したときだけ `softDeleteNoteUnified` が走る。ダイアログは **view の最上位**にマウント（narrow ではサイドバーが MobileDrawer で、その中に置くと開いた本体ごと消える — `TemplateEditHost` と同じ理由）
- **Trash 復元は入れていない**: Issue が明示的にスコープ外としているため、代わりに「ゴミ箱に入らないため元に戻せません」と文言で断った。復元可能にするなら別 Issue
- **#1255 空本文の出し分け**: `isBlankNoteBody`（`web/src/notes/hooks/useNoteTemplateApply.ts`）を追加し、空なら `applyConfirmTitleEmpty` / `applyConfirmBodyEmpty` に切り替える。確認ステップ自体は残した（書き込みであることに変わりはなく、やめられる価値がある）
- **述語は意図的に片側だけ**: 空だと**証明できた**ときだけ `true`。TipTap 以前のノートは生 HTML を持ち、`isEmptyDocJson` はパースできない文字列を「空」と答えるので、**警告を落とすかどうかの判断にはちょうど裏返し**になる。doc JSON でないものは全部「書かれている」扱いにした
- **i18n**: `deleteConfirmBody` / `deleteConfirmAction` / `applyConfirmTitleEmpty` / `applyConfirmBodyEmpty` を en / ja 両方に追加。三項は `t(cond ? "a" : "b")` ではなく `cond ? t("a") : t("b")` と書いた — `i18nKeys.test.ts` のリテラル走査に拾わせるため
- **テスト**: `noteTemplateLibrary.test.tsx` に「押下は質問であって削除ではない」「拒否したら行が残る」、`noteTemplateApply.test.tsx` に空本文 3 件 + `isBlankNoteBody` の単体 3 件
- **検証**: `ci.yml` の `verify` + `docs-lint` をローカルで頭から 15 ステップ実行し全緑（web は 100 files / 944 tests）
- **既知の未処理**: 空本文でも Apply ボタンは `bg-lumen-danger` のまま。`TemplateApplyPanel` は #1255 の Scope 外なので触っていない

### 2026-08-30 - PR #1227 に main を取り込み、テンプレート 3 機能を両立させた

#### 概要

#1181（テンプレートから反映）の PR #1227 は、兄弟の #1179 / #1180 が先に main へ着地した後も古い base のままだった。CI は緑だったが取り込んでいなかっただけで、取り込むと 4 ファイルが衝突した。すべて「両方残す」で解決し、3 機能が同居する形にした。

#### 変更点

- **ケバブ項目の付け替え**: #1227 の「テンプレートから反映」は #1179 が退役させた `onOpenTemplates` / `createTemplateLabel` に乗っていた。main の `onRegisterTemplate` / `registerTemplateLabel` の下にぶら下げ直し（`NoteDetailPanel` / `NoteDetailSurface` の props・labels も同様）
- **materials barrel**: main の `TemplateSavedPanel` / `TemplateListPanel` / `TemplateEditPanel` を残し、その後ろに `TemplateApplyPanel` を追加
- **NotesView**: テンプレート系フックが 3 本並ぶ形に（register = #1179 / library = #1180 / apply = #1181）。名前が衝突しないよう分け、3 つのパネルをすべてマウント。#1179 が消した項目の名前だった `createTemplate` ラベルは一緒に削除
- **apply の picker は鮮度の配線が不要だった**: `begin()` が開くたびに `listNoteTemplatesUnified` を読み直すため、#1221 で必要になった `refresh()` 相当が要らない
- **検証**: CI verify 相当をローカル全ステップ実行 — shared 2652 / web 934 / desktop 7 / mcp 319 すべて緑、`docs-lint` OK

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
