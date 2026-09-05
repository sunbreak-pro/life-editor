# HISTORY ARCHIVE (chat-materials-refine)

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
