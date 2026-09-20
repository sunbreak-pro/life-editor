# HISTORY ARCHIVE (chat-materials-refine)

### 2026-09-05 - #1470 検索 0 件の空状態 / #1471 テンプレート編集ダイアログの幅（PR #1502 / #1507）

#### 概要

#1408（Desktop 幅の実ブラウザ点検）の所見 2 件。どちらも `origin/main` から独立にブランチを切って 1 件 1 PR。書いた時点の実測で 2 本とも **open**（merge はこうだいさんの手番 = P-001）。共通していたのは「表示の元にしている量が 1 つずれている」形で、片方は**検索後の集合**を書庫と取り違え、もう片方は**トークンの幅**を実際の列幅と取り違えていた。

#### 変更点

- **#1470 の原因は `hasNotes` の定義そのもの**: `groups.length > 0` は検索後のグループ数なので、一致しない語を打った瞬間に「書庫が空」と同じ値になる。空状態の文言も中央の作成ボタンもここから出ていた。`notes.notes.some(n => !n.isDeleted)` に戻し、検索 0 件は `searchEmpty`（検索中 **かつ** 書庫が非空 **かつ** グループ 0）という別の名前にした
- **中央パネルも同じ値を読んでいた**: #1372（PR #1380）は中央の CTA を外したが文言は `hasNotes` 分岐のままだったので、検索 0 件のとき本文側も「ノートはまだありません」と言っていた。定義を直した副産物で一緒に直っている
- **チップ列は「絞り込む道具」なので結果集合から作ってはいけない**: 0 件のあいだは書庫の全タグへ落とす。そのままだと押しても何も起きない飾りになるので、**その状態のチップ押下は検索語を落とす**ようにした（打鍵が `tagFilters` を落とす `handleSearchChange` の裏返し）。一致がある間の挙動は無変更で、検索 + チップの併用も残っている
- **#1471 は「同じトークン名 ≠ 同じ幅」**: `reading` は PageContainer が `width="reading"` の**ページ**に渡す幅（818px）で、Materials セクションは `width="wide"`。Note の実幅は左ナビ（`w-16` / `w-60` で畳める）と右パネル（240–560px のドラッグ可変・永続化）の残りで、1280x800 の実測は 642px。**静的な class では原理的に一致させられない**ので測る
- **測り方は ref コールバック + ResizeObserver**（`web/src/notes/hooks/useElementWidth.ts` 新規）。幅が付くまで `null` を返すので、レイアウトの無い jsdom と「測る列が無いホスト」は CSS フォールバックのまま。値は `min(var(--container-lumen-reading), Npx)` にして**トークンを天井に残す** — 広い画面では Note の方が広くなるので、そちらに合わせると 1100px の行になる。px はどこにも書き写していない（`tokens.css` が唯一の在処という規約）
- **`Modal` の `maxWidth` はインライン style で当てる**のが要点で、実装の都合ではない。インライン宣言は出力順に関係なく class に勝つので、`MODAL_MAX_WIDTH` のコメントが書いている #830 の罠（2 つの `max-w-*` が Tailwind のソート順で決まる）が構造的に届かない。既存の呼び出し元は無変更
- **テスト**: `web/tests/notesView.test.tsx` に 5 ケース（文言 / CTA が無いこと / チップが残ること / 検索語が落ちること / 本当に空の書庫は今まで通り）、`shared/tests/templateEditPanelLayout.test.tsx` に 2 ケース（測れたとき = `min()` 式 / 測れないとき = class 幅のまま）、`web/tests/elementWidth.test.tsx` 新規 5 ケース（装着時に測る / 小数を丸める / リサイズに追従 / 幅 0 は「未測定」扱い / 外れたら observe をやめる）
- **踏んだ罠 2 つ**: (1) web の tsconfig は `erasableSyntaxOnly` なので、テスト用フェイクの**コンストラクタ引数プロパティ**が `TS1294` で落ちる（`build` と `vitest` は両方緑のまま `typecheck:tests` だけが赤くなる例）。(2) 全件並列で `briefingEveningLazyMount.test.tsx` が 1 本落ちたが、単体でも静かな状態の全件でも緑 — memory に記録済みの cold-cache flake で、今回の変更とは無関係
- **検証**: CI verify のステップ列をローカルで上から全部（shared 4 種 / web 4 種 = 114 files 1070 tests / desktop 3 種 / mcp-server 3 種）+ `docs-lint`、2 ブランチとも 15 本すべて exit 0。ビルド後の CSS で `--container-lumen-reading` が `:root, :host` に出ていることも実測（portal 先で解決するため）。実ブラウザでの実測（ダイアログと Note の `getBoundingClientRect().width` 比較）は worktree では回さない規約なので merge 後に chat-main

### 2026-09-01 - materials 4 件を 4 PR に分割提出（#1372 / #1363 / #1364 / #1365）

#### 概要

2026-09-01 dispatch の 4 件を、それぞれ `origin/main` から独立に切ったブランチで実装し 4 PR にした（#1380 / #1384 / #1394 / #1397）。うち 2 件は修正そのものより**「直す場所の特定」が本体**で、Issue 側が特定できないまま起票されていた。

#### 変更点

- **#1372（PR #1380・書いた時点で merged）ノート空状態の中央 CTA を撤去**: `NotesView.tsx` の `EmptyState` から `cta` を落とすだけ。アイコン・説明文・#1149 の「最近開いたノート」候補は維持。**両幅で残る入口は右上の `AddPill`** で、main content のツールバー行にあり `isWide` 分岐を持たないため狭幅でも生きる — #875 が狭幅の追加口を右端に固定した経緯があるので、`isWide=false` の空状態でツールバー pill から作成できることをテストで固定した
- **#1363（PR #1384）テンプレート編集パネルを Note と同寸に**: 512px 幅 + 本文 320px という**ダイアログの寸法**だったのを、`Modal` に新設した `reading` サイズ（`max-w-lumen-reading` = `PageContainer width="reading"` と同じトークン）へ。パネルを `flex max-h-full flex-col` の高さ有界カラムにし、**名前欄と本文を 1 つのスクローラに入れ、キャンセル / 保存はその外**（通常 Note にコミット行は無く、ページスクローラで流れて良いのはタイトルと本文だけ、という対応）。本文フロアは `NoteDetailPanel` の `variant="main"` と同じ 420px。web ホストは `RichTextEditor` に `className="pt-1"` を渡してボーダーレスに（既定は枠付きで、パネルの枠の内側にもう 1 枚枠が出ていた）
- **#1364（PR #1394）タグフィルタの繰り上げを廃止**: 実体は `web/src/notes/NoteTagFilterChips.tsx` の `ordered` メモで、**`sort` を呼ばず `filter` 2 回（picked / rest）の連結**で並べ替えていた。Issue が試した `selected` + `sort` の grep で出なかったのはこれが理由。繰り上げが担保していた #1288 の不変式（選択中チップが `+N` の裏に隠れない）は**並びを変えずに**維持 — 折り畳み時に描くのは「先頭 `VISIBLE_LIMIT` 個 + キャップより下にある選択済み」で、順序は呼び出し側のまま。`+N more` の N は実際に隠れている数になり、隠れが無くなればトグルも消える。この部品にテストが無かったので新規 8 件
- **#1365（PR #1397）Notes のタグチップにアイコン**: `useNoteListState.tagFilterChips` が 6px の色ドットを**手組み**していて `wiki_tags.icon` を一度も読んでいなかった（#1291 の唯一の取りこぼし・リポジトリ内で最後に残っていた手組みタグ表示）。`TagHeadingIcon`（`resolveTagIcon` → 無ければ汎用 Tag グリフ・タグ色でティント）に差し替え、**新しいチップは作らず手組みの方を消す**方向で揃えた。グリフの分だけ太るので行の整理も: 1 チップの幅上限を `max-w-full` → `max-w-[9.5rem]`（長い名前 1 個が 1 行を占有していた）、折り畳み時の表示数を 8 → 6（240px 幅で 4 行に折り返して最初のノートを fold の下へ押していた）
- **検証**: 各ブランチで shared → web の CI verify（`build` / `lint` / `typecheck:tests` / `vitest`）をローカル全緑。#1372 のときだけ web 全件の初回で `briefingEveningLazyMount.test.tsx` が 3 件落ちたが、単体緑・transform キャッシュが温まった 2 回目の全件も緑で、既知の cold-cache フレーク

### 2026-08-31 - #1345 — ノート削除を確認ダイアログ越しにした（PR #1347）

#### 概要

Notes の削除だけ確認が無く、同じ `NotesView.tsx` の中でテンプレート削除（#1248）は聞くのにノートは 1 クリックで消えていた。ノートの削除経路 2 本を既存の `useConfirmDialog()` に通し、削除の作法をファイル内で揃えた。PR #1347 提出（Closes #1345・書いた時点で open）。

#### 変更点

- **経路は 2 本とも 1 つのコールバックに寄せた**: サイドリスト行のゴミ箱（`onDeleteNote`）と詳細ケバブ「その他の操作」→「ノートを削除」（`onDelete`）。どちらも `handleDeleteNote` を通す。**wide / narrow の作法が割れないのはこの一本化のおかげ**で、幅ごとの分岐は書いていない — #876 以降、両幅が同じリストと同じ詳細サーフェスを描くため
- **ダイアログは view 直下の既存 `<ConfirmDialog>` を再利用**（#1248 が置いたもの）。ケバブから開く経路では**メニューが閉じた後も質問が残る**必要があり、メニューの隣にマウントしていたら消えていた
- **文言は Todo 削除（`todoDetail.todoDeleteConfirm`）に寄せた**: 「ゴミ箱に入るので、あとから元に戻せます」。テンプレート削除の「戻せません」とは**性質が逆**なので、同じファイルでも書き分けている。追加キーは `materials.notes.deleteConfirmBody` / `deleteConfirmAction` の 2 本を en / ja 両方へ
- **既存テスト 1 本が仕様変更で赤くなるはずの場所**（`deletes a note from its side-list row`）を、押下＝質問・承諾＝削除の形に書き換えた。追加は拒否ケースと、ケバブ経路を `it.each([true, false])` で wide / narrow 両方。`notesView.test.tsx` は 33 → 36 件
- **検証**: CI verify のステップ列をローカルで上から全部（shared 4 種 2766 / web 4 種 993 / desktop 3 種 / mcp-server 3 種 322）+ `docs-lint` すべて緑。実ブラウザ確認は worktree では回さない規約なので merge 後に chat-main

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

### 2026-09-01 (2) - #1407 Materials 復帰のロード / #1404 添付・埋め込み（PR #1417 / #1425）

#### 概要

2026-09-01 dispatch の残り 2 件。どちらも `origin/main` から独立に切って PR にした。**#1404 は 🛑 人手ゲート付き**で、`supabase/migrations/0027_attachments_bucket.sql`（非公開バケット + storage.objects の 4 ポリシー）は未適用のまま提出している（バケット作成・ポリシー投入は DDL push と同枠 = CLAUDE.md §7.3）。

#### 変更点

- **#1407（PR #1417）Materials へ戻ったときの空白を消した**: 一覧は #1101 の snapshot replay で既に即座に描かれていたが、**行は本文を持たない**（M1）ため、開いていたノートの本文だけ毎回 `getNoteUnified` を 1 往復し、その間エディタ領域が空だった。新規 `shared/src/state/noteBodyStore.ts` = 本文の module-level LRU（12 件）で、`domainSnapshotStore` と同じ 3 つの制限（メモリのみ / DataService identity で検証 / `updatedAt` 一致で検証）+ 上限付き。`mergeLoadedList` は**メモリ上に `prev` が無いときだけ**キャッシュを見る（ライブ状態が常に優先 = #607 の own-write カバーを壊さない）。`restoreSelection` は `canHydrate` を取り、snapshot replay からは**merge が既に本文を持っていた場合だけ**復元して、持っていなければ one-shot を消費せず戻る — fetch 側の `apply` が従来どおり全経路を通る。Trash からの完全削除で `forgetNoteBody`（二度と list read に現れないオブジェクトは何もエントリを無効化できないため）。ソフト削除では**あえて**破棄しない（Trash から戻すと行がそのまま復活し、キャッシュは正当なヒットになる）
- **#1404（PR #1425）スラッシュコマンドから画像 / ファイル**: `/` に Image と File を追加。**バケットは非公開**（`sounds` が public なのは中身が全員共通の環境音 5 本だから／こちらはユーザー自身のノート）で、**本文が持つのはパスだけ**。非公開バケットの URL は署名付き 1 時間で失効するので、本文に URL を焼き込むと「一晩で壊れるノート」か「ずっと公開のバケット」の二択になる。新規: `shared/src/constants/attachments.ts`（上限・TTL・`isEmbeddableImage`・`formatAttachmentSize`）/ `shared/src/services/SupabaseAttachmentsService.ts`（`<uid>/<uuid>.<ext>` で書く = migration 0027 のポリシーが認可する唯一の形）/ `web/src/notes/attachmentNode.ts`（block atom + 素の NodeView。itemLink と同じく**無条件登録**）/ `pickFile.ts` / `useAttachmentUpload.ts`。DataService には `attachments` ドメインを 1 つ足した（routing の型ガードが interface とタプルを両方向で突き合わせるので、宣言漏れも死んだ文字列もビルドで落ちる）
- **意図的な線引き（#1404）**: SVG は画像扱いにせずファイルのチップへ（スクリプトや外部参照を持てる「文書」なので inline 描画しない）／挿入はアップロード完了後（先に入れるとエディタの 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化される）／進捗表示なし・孤児回収なし（どちらも outbox で起票依頼済み）／配線したのは Notes だけ（Issue の Scope が `web/src/notes/**` を名指し）
- **テスト**: #1407 = `shared/tests/noteBodyCache.test.tsx` 7 件。要は `waitFor` を使わない 1 本で、`renderHook` が返った時点で既にノートが本文つきで開いていること・`getNoteUnified` が一度も呼ばれていないことを見る（`await` を挟むと修正前でも緑になり何も証明しない）。逆側の不変式として「離れている間に他デバイスが書き換えたら revalidate が上書きする」も。キャッシュを空振りさせて 7 件中 6 件が落ちることを実測。#1404 = shared 10 件（オブジェクト名の形が中心 — 危険な拡張子 / 拡張子なし / 先頭ドットが全部 uuid だけのキーに落ちること、上限超過が**送る前に**弾かれること）+ web 18 件（実エディタで署名 URL 解決・SVG のチップ化・リゾルバ無し / 失敗のフォールバック、スラッシュ項目のゲートと挿入順序、ピッカーの後片付け）
- **検証**: 両ブランチで CI verify のステップ列（shared → web → desktop → mcp-server の lint / build / typecheck:tests / test）+ `docs-lint` をローカル全緑

### 2026-09-02 - #1439 添付アップロード進捗の方針裁定 / #1438 添付の孤児回収（PR #1455 / #1453・どちらも merged）

#### 概要

#1404 が意図的に残した 2 つの穴（進捗表示・孤児回収）を、それぞれ `origin/main` から独立に切って PR にした。#1439 は「実装せず方針を決める」Issue なのでコードを触らず決定台帳 1 本、#1438 は実装。両ブランチで CI verify のステップ列 14 本 + `docs-lint` をローカル全緑。**書いた時点の実測で 2 本とも merged**（#1453 = 529ffea1 / #1455 = 39d4d402）。

#### 変更点

- **#1439（PR #1455）進捗はドキュメントの外に出す**: 裁定 = プレースホルダノードを作らない（`D-20260902-materials-1`・`status: recorded`）。理由 2 つ。(1) プレースホルダは「保存の直前に一時ノードを落とす」処理が要るが、保存経路は自動保存 / 手動保存 / 画面離脱と複数あり、1 経路の落とし忘れが**届いていないバイト列を指すノートの永続化**になる。壊れ方が静かすぎる。(2) `@supabase/storage-js` 2.105.4 の `FileOptions` に**進捗コールバックが無い**（実測 = `web/node_modules/@supabase/storage-js/dist/index.d.mts`。`cacheControl` / `contentType` / `upsert` / `duplex` / `metadata` / `headers` のみ）ので、どの案でもインジケータは不定形にしかならず、ドキュメント内に置く必然性が消える。派生の裁定 3 つ = 自動保存の除外機構は不要 / 失敗時は既存の danger トーストのみ・再試行導線なし / 両幅 1 実装・対象は Notes のみ
- **#1438（PR #1453）孤児回収**: 設定 → ゴミ箱の下に「添付の掃除」カード。dry-run の一覧 → 確認ダイアログ → **その一覧に対してだけ**削除。判定は純関数に切り出した（`shared/src/services/attachmentOrphans.ts` = `collectAttachmentPaths` / `selectOrphans`）
- **走査は `notes_payload` + `dailies_payload` の全行・`is_deleted` の絞り込みなし**: ゴミ箱のノートは復元できる以上その本文が指すファイルは生きている。テンプレートや legacy folder 行も同じ。Daily を入れたのは、`attachment` ノードが全編集面で無条件登録なので**貼り付けで Daily に入りうる**ため（走査して 0 件だったテーブルはクエリ 1 本の損、走査し忘れたテーブルは使用中のファイルを消す）
- **2 つの読み取りの順番が安全性そのもの**: 先にバケットの一覧 → 後からドキュメント。走査中のアップロードは「一覧に無い」か「後の読みで参照が見える」のどちらかになる。逆順だと 2 つの読み取りの間に添付したファイルが孤児に見える
- **ページングに `order("item_id")` を付けた**: PostgREST は行順を保証しないので、順序なしの 2 ページ目は 1 ページ目の行を取り直したり別の行を飛ばしたりする。**飛ばされた行 = 参照を見落としたノート**なので効率ではなく正しさの話
- **保険の猶予窓 1 時間**（`ORPHAN_GRACE_MS`）: 「アップロードは終わったのにノートが保存されないままタブを閉じた」に効かせる。タイムスタンプが読めないものも「新しい」側に倒す
- **Scope 外を 1 か所触った（申告済み）**: `web/src/notes/attachmentNode.ts` のノード名リテラルを shared の `ATTACHMENT_NODE_TYPE` に差し替え。掃除側は type 名でしか参照を認識できないので、片方だけ改名されると**全添付が孤児に見える**
- **テスト**: shared 14 件（深いネスト / 平文・null・壊れた JSON / `path` 属性を持つ別ノード / ゴミ箱のノートの参照 / folder 行と `.emptyFolderPlaceholder` / 読み取り失敗は例外）+ web 5 件（dry-run 前は削除ボタンが無い / 確認前に `deleteAttachment` を呼ばない / 1 件失敗しても続けて件数を報告 / 失敗した dry-run が「掃除するものはありません」に化けない）
- **事故 1 件**: #1455 の 2 コミット目（outbox の起票依頼）は push が merge に間に合わず main に届かなかった。cherry-pick で本 tracker ブランチに載せ直している
