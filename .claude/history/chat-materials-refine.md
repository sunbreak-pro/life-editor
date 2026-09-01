# HISTORY (chat-materials-refine)

### 2026-09-01 (2) - #1407 Materials 復帰のロード / #1404 添付・埋め込み（PR #1417 / #1425）

#### 概要

2026-09-01 dispatch の残り 2 件。どちらも `origin/main` から独立に切って PR にした。**#1404 は 🛑 人手ゲート付き**で、`supabase/migrations/0027_attachments_bucket.sql`（非公開バケット + storage.objects の 4 ポリシー）は未適用のまま提出している（バケット作成・ポリシー投入は DDL push と同枠 = CLAUDE.md §7.3）。

#### 変更点

- **#1407（PR #1417）Materials へ戻ったときの空白を消した**: 一覧は #1101 の snapshot replay で既に即座に描かれていたが、**行は本文を持たない**（M1）ため、開いていたノートの本文だけ毎回 `getNoteUnified` を 1 往復し、その間エディタ領域が空だった。新規 `shared/src/state/noteBodyStore.ts` = 本文の module-level LRU（12 件）で、`domainSnapshotStore` と同じ 3 つの制限（メモリのみ / DataService identity で検証 / `updatedAt` 一致で検証）+ 上限付き。`mergeLoadedList` は**メモリ上に `prev` が無いときだけ**キャッシュを見る（ライブ状態が常に優先 = #607 の own-write カバーを壊さない）。`restoreSelection` は `canHydrate` を取り、snapshot replay からは**merge が既に本文を持っていた場合だけ**復元して、持っていなければ one-shot を消費せず戻る — fetch 側の `apply` が従来どおり全経路を通る。Trash からの完全削除で `forgetNoteBody`（二度と list read に現れないオブジェクトは何もエントリを無効化できないため）。ソフト削除では**あえて**破棄しない（Trash から戻すと行がそのまま復活し、キャッシュは正当なヒットになる）
- **#1404（PR #1425）スラッシュコマンドから画像 / ファイル**: `/` に Image と File を追加。**バケットは非公開**（`sounds` が public なのは中身が全員共通の環境音 5 本だから／こちらはユーザー自身のノート）で、**本文が持つのはパスだけ**。非公開バケットの URL は署名付き 1 時間で失効するので、本文に URL を焼き込むと「一晩で壊れるノート」か「ずっと公開のバケット」の二択になる。新規: `shared/src/constants/attachments.ts`（上限・TTL・`isEmbeddableImage`・`formatAttachmentSize`）/ `shared/src/services/SupabaseAttachmentsService.ts`（`<uid>/<uuid>.<ext>` で書く = migration 0027 のポリシーが認可する唯一の形）/ `web/src/notes/attachmentNode.ts`（block atom + 素の NodeView。itemLink と同じく**無条件登録**）/ `pickFile.ts` / `useAttachmentUpload.ts`。DataService には `attachments` ドメインを 1 つ足した（routing の型ガードが interface とタプルを両方向で突き合わせるので、宣言漏れも死んだ文字列もビルドで落ちる）
- **意図的な線引き（#1404）**: SVG は画像扱いにせずファイルのチップへ（スクリプトや外部参照を持てる「文書」なので inline 描画しない）／挿入はアップロード完了後（先に入れるとエディタの 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化される）／進捗表示なし・孤児回収なし（どちらも outbox で起票依頼済み）／配線したのは Notes だけ（Issue の Scope が `web/src/notes/**` を名指し）
- **テスト**: #1407 = `shared/tests/noteBodyCache.test.tsx` 7 件。要は `waitFor` を使わない 1 本で、`renderHook` が返った時点で既にノートが本文つきで開いていること・`getNoteUnified` が一度も呼ばれていないことを見る（`await` を挟むと修正前でも緑になり何も証明しない）。逆側の不変式として「離れている間に他デバイスが書き換えたら revalidate が上書きする」も。キャッシュを空振りさせて 7 件中 6 件が落ちることを実測。#1404 = shared 10 件（オブジェクト名の形が中心 — 危険な拡張子 / 拡張子なし / 先頭ドットが全部 uuid だけのキーに落ちること、上限超過が**送る前に**弾かれること）+ web 18 件（実エディタで署名 URL 解決・SVG のチップ化・リゾルバ無し / 失敗のフォールバック、スラッシュ項目のゲートと挿入順序、ピッカーの後片付け）
- **検証**: 両ブランチで CI verify のステップ列（shared → web → desktop → mcp-server の lint / build / typecheck:tests / test）+ `docs-lint` をローカル全緑

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

### 2026-08-31 - #1334 — リンク先プールが両方の is_deleted バケツを読むようにした（PR #1340）

#### 概要

前日の #1292（PR #1306）が実データで効いていなかった件。プールは「削除済みをフラグ付きで持つ」形になっていたのに、**フラグの元にしていた 3 本の読み取りが全部 live 行しか返さない**ままだったので、フラグは構造的に常に false で、削除済み Todo へのリンクは相変わらず id 断片（`…44440797`）で出ていた。PR #1340 提出（Closes #1334・merge = こうだいさん）。

#### 変更点

- **原因は「フラグを立てる側」ではなく「行を取ってくる側」**: `useItemLinkTargets.fetchPool` が呼ぶ `fetchTodoTree` / `listNotesUnified` / `listDailiesUnified` は 3 本とも自分のクエリで `is_deleted = false` を固定している（`SupabaseTodosService` は `isDeleted: false` 直書き、Notes は `listLite(false, …)`、Dailies は `listByDeletedBucket(false, …)`）。#1292 は下流（フラグの読み方）だけを直していた
- **各ドメインで両方のバケツを読む形にした**: `listNotesUnified` + `fetchDeletedNotesUnified`、daily / todo も同じ対。3 本とも Trash が既に使っている既存メソッドなので、**新しいクエリも新しい引数も足していない**（同じ分割の反対側を足しただけ）。前例は `SupabaseTodosService.permanentDeleteTodo` の `[...live, ...deleted]`
- **連結は live が先**: ターゲットを*提示する*面（`[[` メニュー・LinkPanel の picker・関連リスト）は自分の境界でフラグ付きを落としてから並べるので、既存の並び順は動かない。削除済みの尾に触るのは id 逆引き（`resolveRow`）だけ
- **空の Trash の追加コストはドメイン 1 本あたり SELECT 1 回**: `fetchMetaFirstJoin` は meta が 0 行なら payload テーブルに触らず返る
- **既存テストがこのバグを丸ごと隠していた**（#1285 と同じ形の再発）: `web/tests/linkPanel.test.tsx` は削除済み行が**入り済みの pool** を panel に直接渡す。壊れていたのはまさにその手前の工程なので、緑のまま通っていた
- **新しいテストは結果ではなく分割の方を模した**: `web/tests/useItemLinkTargets.test.tsx` はドメインごとに 1 枚の行テーブルを置き、各読み取りが自分の `is_deleted` バケツだけを返す（実サービスと同じ契約）。live だけから組んだ pool では通らない。4 ケース = 6 本の読み取りが全部呼ばれる / 3 ドメインの削除済みがフラグ付きで入る / live が unflagged かつ先に並ぶ / **報告された症状そのもの**（実 pool を通した LinkPanel に「Return the extra tiles（削除済み）」が出る）。修正前のソースに戻して 4 本とも落ちることを実測
- **検証**: CI verify のステップ列をローカルで上から全部（docs-lint / shared 4 種 / web 4 種 / desktop 3 種 / mcp-server 3 種）— shared 2757・web 987・desktop 7・mcp 322 すべて緑。実ブラウザでの DoD 確認は worktree では回さない規約なので merge 後に chat-main

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
