# HISTORY (chat-materials-refine)

### 2026-09-19 - #1677 右クリック編集 / #1687 ドロップを移動に / #1688 未解決リンク行の削除 / #1689 閉じ括弧（PR #1713 / #1716 merged / #1717 / #1719）

#### 概要

chat-main の配布で materials の残り 4 件に着手し、4 PR にした。#1689 のみ #1688 に stack（同じ関数）。

#### 変更点

- **#1677（PR #1713）Note の rightSidebar を右クリックで編集**: タグ行（フィルタチップ / グループ見出し）は Connect と同じ `TagActionsMenu` をポインタ位置に開き、名前 / アイコン / 色はその場に `TagHubEditBlock` を出す（`useTagEditDrafts` = 保存ボタンだけが書く #715 の契約をそのまま使用）。削除は `ConfirmDialog`。ノート行は汎用 `ItemActionPopover`（#307）で、タイトル + `TagPicker` + 名前変更（インライン入力・IME 安全）+ 削除。新規 `web/src/notes/useSidebarContextMenus.tsx` に「ハンドラ + パネル」を 1 ファイルでまとめた（ハンドラは一覧の奥へ、パネルはホスト最上位へ行くため）。`shared/src/components/TagHub/` は触らず使うだけ
- **#1687（PR #1716・merged）ドロップ = 移動**: `handleDragEnd` がドラッグ元のタグ（draggable id のグループキー）を読み、`{noteId, fromTagId, toTagId}` を報告する。未分類も本物のドロップ先になり、そこへ落とすと**ドラッグ元のタグ 1 つだけ**を外す。書き込みの判断は純関数 `planTagMove` に出した（jsdom にレイアウトが無くジェスチャを再現できないため）。Scope どおり `useWikiTagsUnifiedAPI.ts` は不変
- **#1688（PR #1717）未解決リンクの行を削除**: 行と `insertUnresolved`・`exactMatch`・`"unresolved"` 種別・i18n キー（en/ja）を撤去。**ノート作成失敗時のフォールバックは残した**（`[[query` の削除は await より前に走る同期処理なので、フォールバックまで消すと打った文字が何も残らない）。`targetId: null` の描画は保存済み本文のため維持
- **#1689（PR #1719）閉じ括弧**: `stripLinkClosing` で検索語末尾の `]` / `]]` を落としてから、絞り込み・作成行のラベル・作成するノート名に使う。末尾だけを落とすので `Roof [draft] repair` は無傷。挿入側は無変更（range が `]]` を含む）
- **テスト**: web 8 件（#1677 = タグメニューの 4 項目・保存でのみ renameTag・削除の確認・未分類は素通り・ノートパネルの中身・名前変更・削除・狭幅で何も付かない）+ 10 件（#1687 = どの移動か 5 件 / どの書き込みか 5 件）+ 4 件（#1688）+ 3 件（#1689）。`buildItems` と `planTagMove` はテストのために export した（どちらも実 ProseMirror / 実ポインタなしでは到達できない判断）
- **検証**: 4 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑
- **申し送り**: #1687 と #1667（タグ付け外しの Undo）が重なると、移動 1 回が Undo 2 回になりうる。まとめるかは #1667 側で確かめる

### 2026-09-17 - #1679 Daily エディタカードの床 / #1680 夕刊カードの編集 / #1674 添付アップロードの帯（PR #1683 merged / #1693 / #1699）

#### 概要

section:materials の open 3 件を 1 件 1 ブランチで実装し、3 PR にした。#1679 は merge 済み、残り 2 本は書いた時点で open。

#### 変更点

- **#1679（PR #1683・merged）Daily の「…」メニューが切れる**: `web/src/daily/DailyView.tsx` の `EditorCard` に `DAILY_EDITOR_CARD_MIN_HEIGHT = "min-h-60"` を置き、`min-h-0` と**差し替え**た（`cn` は文字列連結なので 2 つ並べると CSS の記述順が勝つ）。原因は「メニューが portal ではなくカードの中」+「カードが `overflow-hidden`」+「flex 列が短い日のカードを潰す」の 3 つ重ね。開いたメニューの到達点は約 122px（pt-4 + 28px のトリガー + 行 2 本）なので、240px は 3 行目が増えても収まる。`Menu.tsx` は他画面共有なので触っていない。テストは desktop / mobile の 2 面でクラスの有無を見る（jsdom に高さは無い）
- **#1680（PR #1693）夕刊カード（気分・振り返り）を Daily 上で編集**: `DailyEveningCard` に `onSelectMood` と `reflectionSlot` を任意で足し、渡されなければ従来の読み取り専用のまま描く。ホスト側は `mergeEveningSection` で夕刊レンジだけ差し替えるので本文と MCP の往復形式は不変。振り返りは `EveningReflectionPreview`（夕刊画面と同じ部品 = TipTap チャンクを押すまで取りに行かない）→ 押したら `LazyRichTextEditor`。気分 1 タップ = グローバル undo 1 件（`skipUndo` で context 側の createDaily undo を抑止）、振り返りの打ち込みはエディタ自身の履歴。夕刊が無い日はカードではなく小さな「夕刊を書く」ボタンを出す（#1046 が避けた「空カードの氾濫」を作らない）。スケジュール行は読み取りのまま（Schedule のデータで、ここに保存先が無い）
- **#1674（PR #1699）添付アップロード中の帯**: `web/src/notes/AttachmentUploadStatus.tsx` を新設（ファイル名 + `attachment.uploading` + 不定形スピナー・`role="status"` + `aria-live="polite"`・idle では何も描かない）。`useAttachmentUpload` に任意の `onUploadingChange` を足し、サイズ検査を通った時点でファイル名・`finally` で null を渡す（失敗も拒否も帯が残らない）。ドキュメントは一切触らない = `D-20260902-materials-1` の裁定 B。`RichTextEditor` / `attachmentNode` は Scope 外のまま
- **テスト**: web 5 件（#1680 = 気分の設定 / 解除・振り返りの編集・夕刊が無い日の入口・undo コマンド。いずれも保存文字列を `extractEveningSection` / `stripEveningSection` で読み直して確かめる）+ shared 1 件（編集モードのカード）+ web 4 件（#1674 = 開始で出る / 成功・失敗・サイズ拒否で消える / `aria-live`）+ #1679 の 2 件。既存の #1046 テストは星が `role="img"` から button になったので `aria-pressed` を見る形へ直した
- **検証**: 3 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカル全緑。#1693 は #1683 の merge 後に `origin/main` を取り込んで衝突（テストの import 1 ブロック）を解消し、再度全緑
- **事故 / 摩擦 2 件**: (1) 他レーン（connect-refine）の `ps | grep verify.sh` が当方のプロセスまで kill した — 同名スクリプトが全 worktree にあるため。(2) `briefingEveningLazyMount` の cold-cache flake に 2 回当たった（単体では緑・別レーンの PR #1692 が main に着地して解消）

### 2026-09-13 - #1606 添付チップの全幅化 + 削除ボタン / #1607 URL のリンクブロック（PR #1612 / #1617）

#### 概要

2026-09-13 dispatch の 2 件。**どちらも `origin/main` から独立に切り、stack していない**（こうだいさんの指定）。2 件は「本文に埋め込んだものを 1 つの形にそろえる」1 本の話で、#1606 が形（本文カラム幅のブロック + 右端 44x44 の ×）を決め、#1607 がその形に URL を乗せる。

#### 変更点

- **#1606（PR #1612）添付ファイルのチップを本文幅いっぱいにし、右端に削除ボタンを置いた**: `.note-attachment__file` は `inline-flex` だったのでファイル名の文字数ぶんしか伸びず、短い名前だと行の左端に小さく残っていた。`display: flex` + `width: 100%` + `min-height: 2.75rem` の行にし、名前が伸びて省略記号で切れ、サイズと × が右に寄る。削除は `web/src/notes/attachmentNode.ts` の node view が実体の `<button>` を足す。消すのは**ノードだけ**で Storage のオブジェクトには触らない（孤児回収は #1438 — undo でノードを戻せる必要があり、消したファイルは戻せない）
- **#1607（PR #1617）段落に単独で置かれた URL をブロックにした**: 新規 `web/src/notes/linkCardNode.ts` = `linkCard` block atom（`attrs.href` のみ）。ホストを見出し・パスを副見出しにして、**通信は 1 本も足していない**（タイトル取得は CORS で塞がれ、代理取得はサーバー費用が出る = 完成までコスト $0 の前提に反する。favicon も同じ取引の小型版）。入口は入力規則（URL を打ち終えたスペース）と貼り付け（空段落に素の URL）の 2 つで、**文中の URL は下線リンクのまま**。既存ノートは遡って変換しない（開いても保存済み JSON は 1 バイトも変わらない）。`RichTextEditor` には**無条件登録**（スキーマが知らないノードは文書全体を捨てる = #1521 / #1579 と同型）

#### 決めたこと（Issue が実装者に委ねていた点）

- **読み取り専用の面では × を出さない**（#1606 の推奨どおり）。判定は `editor.options.editable`。**`editor.isEditable` は使えない** — `this.options.editable && this.view && this.view.editable` で、node view は EditorView の**構築中**に作られるため `this.view` がまだ undefined、つまりどの面でも false になる
- **× は常時表示**（hover / focus 出しは不採用）。タッチに hover が無く、実体が `<button>` なので Tab でも届く
- **× は `<a>` の兄弟**にして CSS で右端に重ねる。リンクの中のボタンは不正な HTML で、キーボードの対象が 2 重になる。この形なら DoD が測る `.note-attachment__file` が本文カラム幅の要素のままでいられる
- **44x44 は全幅で無条件**。#1560 の `max-md:` 限定はリストの desktop レイアウトを太らせないためで、ラベルの無いアイコン 1 個が「横に本文の流れないブロック行」にいるここには当てはまらない（逆に taskList のチェックボックスが 20px なのは本文の行の中にいてキャレットのクリックを食うから）
- **#1607 の表示はホスト + パス**、**切り替わるのは段落に URL 単独のときだけ**、**既存ノートは非変換**（Issue の 3 問すべて推奨どおり）

#### 実測（DoD）

dev server は chat-main 専有（§7.4）なので、**ビルド済み `web/dist/assets/*.css` + アプリと同じ chrome（SidebarNav 240 / NotesView narrow の `px-4` / NoteDetailPanel narrow `p-3`・wide `p-5` + 1px border）を書き下ろした計測用ページ**を作り、playwright MCP で開いて `getBoundingClientRect()` を読んだ。`file://` は playwright が塞ぐのでポート 8791 の使い捨て静的サーバー経由（アプリの dev server ではないのでポート競合が起きない）。

| viewport | 本文カラム | 添付チップ（前 → 後） | リンクブロック | × |
| --- | --- | --- | --- | --- |
| 390x844 | 332.67 | 176.73 / 132.29 → 332.67 | 332.67 | 44x44 |
| 1280x800 | 998.67 | 167.13 / 126.63 → 998.67 | 998.67 | 44x44 |

変更前の 2 つの数字は長いファイル名と短いファイル名で、名前の長さで幅が決まっていたことがそのまま出ている。

#### 途中で踏んだこと

- **`new URL()` は http(s) 以外も通す**: `javascript:alert(1)` は例外を投げず host が空・pathname が `alert(1)` になるので、見出しの空なカードになりかけた。`href` はクリックでブラウザにそのまま渡る = アプリのオリジンで走るため、**http(s) 以外は href を付けない**を `safeHref` に切り出した。ドキュメントには MCP サーバーも書き込むので「作る側が安全」は根拠にならない
- **`index.css` の `@media (forced-colors: active)` が 1 つではなくなった**: `taskListCheckboxSize.test.ts` が「最初の 1 つ」を取っていたため両ブランチで赤くなった。中身（`input[type="checkbox"]` を含む方）で選ぶ形に直してある。両ブランチに同じ修正が載っているので、片方 merge 後にもう片方が衝突しても内容は同一
- **入力規則にはテストが無い**（PR 本文で申告）: ProseMirror のテキスト入力経路は jsdom に無いレイアウトと mutation flush を要求する。貼り付け・ラウンドトリップ・削除・URL 解釈の 14 件は押さえた
- **`mcp-server — test` が Windows 固有で 1 件赤**: `remoteRegistry.test.ts` が `utilserification.ts`（プラットフォーム区切り）と `utils/verification.ts`（リテラル）を比べている。今回の変更は mcp-server に触れておらず、Linux ランナーでは緑。**プロダクト課題ではなくテスト側のパス組み立ての問題**なので、起票するなら chat-main 経由

#### 検証

両ブランチで CI verify のステップ列（shared → web → desktop → mcp-server）+ `bash scripts/docs-lint.sh` をローカル実行。上記 `mcp-server — test` の 1 件を除いて全て exit 0。テストは #1606 が web 7 件（`attachmentDelete.test.tsx`）、#1607 が web 14 件（`linkCardNode.test.tsx`）。

### 2026-09-09 - #1579 エディタに table 系ノードを教えた（PR #1587）

#### 概要

MCP の `generate_content` が書く表（`table` / `tableRow` / `tableHeader` / `tableCell`）を web エディタのスキーマが知らず、表入りノートは開いた瞬間に本文全体が捨てられて空の autosave に上書きされていた。#1521（callout・PR #1555）と同型で、その PR 本文が兄弟として名指ししていた残りの片方。`@tiptap/extension-table` を現行 core / pm と同じ 3.23.4 で入れ、4 ノードを無条件登録した。

#### 変更点

- **方針は #1521 に揃えた**（Issue の指示どおり）: MCP の生成をやめず、エディタ側にノードを足す。既存データがそのまま守れて MCP の機能も削らずに済む
- **ただし手書きの `Node.create` にはしなかった**: callout は属性 2 つの div なので手書きで足りたが、表はセルが colspan / rowspan / colwidth を持ち、編集中に表が壊れないための挙動（セル選択・Tab 移動・修復）は prosemirror-tables の `tableEditing` プラグイン側にある。それは各ノード仕様の `tableRole` を要求し、`tableRole` は `@tiptap/core` がこのパッケージのためだけに宣言しているフィールド。手書きだと「開くけれど編集すると崩れる」= バグの再演になる。旧 Tauri 版も同じパッケージ群だったので、当時のノートも同じノードとして読める
- **バージョンは 3.23.4 にピン**: このパッケージは peer で core / pm を**完全一致**で要求するため、最新（3.31.3）を取るとバグ修正 PR でエディタ基盤ごと動く。3.23.4 なら peer が現行と一致し、lockfile の増分は 1 パッケージ 15 行
- **`resizable: false` はどの node view が走るかも決めている**: リサイズ off だと素の `TableView` が使われ、表を `div.tableWrapper` で包む。CSS の `overflow-x: auto` はそこに掛けた。セルに 4rem の下限を置いたので、ノート幅より広い表は列を潰さずスクロールする
- **mcp-server は触っていない**: Issue の Scope は MCP 側も挙げていたが、突き合わせたらずれが無かった。ビルダーの出力（`table` > `tableRow` > `tableHeader` | `tableCell` > `paragraph`）は公式スキーマにそのまま収まり、空セルの `paragraph()` も `inline*` なので有効。`markdownToTiptap` は表を作らないため経路は `generate_content` だけ
- **テストは 5 本**（`web/tests/tableNodes.test.tsx`・実 `RichTextEditor` を jsdom で）。登録を外すと 5 本とも落ちることを実測した。開いたときのセル本文と周囲の段落、`th` 2 / `td` 4 と `.tableWrapper`、保存後もヘッダー行がヘッダーのままであること、merged cell の colspan / rowspan が残ること、セルが複数段落を持てること
- **エディタから表を作る導線は足していない**（slash メニュー項目・input rule なし）。#1521 と同じ判断で DoD の範囲外・i18n カタログ 2 本への追加を伴うため。読み込みと round-trip 専用
- **検証**: CI verify のステップ列 14 本（shared → web → desktop → mcp-server）+ `docs-lint` をローカル全緑。lockfile を触ったので `npm ls @tiptap/extension-table` でツリーの整合も確認。実ブラウザ確認は worktree では回さない規約なので merge 後に chat-main

### 2026-09-06 - #1409 の Materials 4 件（PR #1540 / #1543 / #1547 / #1549）

#### 概要

Mobile 幅点検 #1409 と Desktop 点検 #1408 の所見 4 件。全部 `origin/main` から独立に切って 1 件 1 PR。書いた時点の実測で #1540 / #1543 / #1547 が merged、#1549 が open（merge はこうだいさんの手番 = P-001）。

着手して分かったのは、**4 件のうち 2 件（#1470 / #1471）は前日に main で直っていて Issue だけが open で残っていた**こと。実装が要ったのは #1523 と #1518 の 2 件で、残り 2 件は「現状が DoD を満たしているかの確認」と「抜けていた回帰テスト」に変わった。

#### 変更点

- **#1523（PR #1540）Note 本文のチェックボックスに親指サイズの当たり判定と名乗り**: 丸そのものは #1368 で既に `TODO_CHECKBOX_ICON_PX` のマスク描画に揃っていて、足りなかったのは当たり判定と属性の 2 つ。`index.css` には「44px にすると上下の行のキャレット移動用クリックを飲む」という**既存の反対理由**が書かれており、マウスではそれが正しいので **768px 未満だけ**に入れた（ItemLinkMenu が `max-md:min-h-11` を敷いているのと同じ境界）。当たり判定に場所を奪わせず、`min-height` で**行に場所を与える** — 隣り合う 2 つの 44px 領域が重ならないので境界付近のタップが隣の Todo を切り替えない。領域は label の擬似要素で、label は 1.6em の行ボックスを保つので #883 の光学中央合わせがそのまま生きる（label を高くすると丸が約 3px 下がる）。`role` / `aria-checked` は TipTap の node view を包んで input に付けた
- **#1518（PR #1543）候補メニューを画面幅で頭打ちに**: 配置関数には #471 以来 **高さ**の上限しか無かった。メニューの幅は一番長い行で決まるので、`[[` のアクション行（文章）が 445px を作り、390px の画面で左マージン 8px に正しく寄せたうえで画面外まで描いていた（`/` メニューの行は単語なので露呈しない）。左オフセットは**上限後の幅**から計算する（素の幅だと、もう存在しない余白の分だけ左に引き戻す）。上限は **portal 先のコンテナ**に書く — メニュー本体は配置の後に ReactRenderer が差し込むので、配置時に存在するのはコンテナだけ。既存の ResizeObserver がもう 1 周まわして収束する
- **アクション行だけ折り返し、候補行は省略のまま**: アクション行は意味が末尾にある（「…のノートを作成してリンク」）ので三点リーダーだと動詞が消える。候補行は先頭で識別できるし、全部折り返すとピッカーではなく壁になる
- **#1471（PR #1547）は確認 + 配線のガードだけ**: PR #1507 で着地済み。内側まで一致していることを読んで確認した（`NoteDetailPanel` の `variant="main"` も Modal のパネルも `p-5` + `border` 1px なので差 0px）。抜けていたのは **`useElementWidth` と `TemplateEditPanel` の間の 2 ホップ** — NotesView の `ref={measureMainColumn}` と `columnWidth={mainColumnWidth}` を押さえるテストが無く、片方消しても全緑のまま 818px に戻る。3 件追加し、**配線を 1 つずつ外して 2 件が赤くなることを実測**した
- **#1470（PR #1549）は narrow の実測**: PR #1502 で着地済みだが、Issue に「Mobile でも再現」というコメントが残っていた（**そのコメントは修正の着地より前**に書かれたもの）。#1502 の 5 件は全部 `state.isWide` の既定値 true で走るので、narrow を同じ答えに縛るものが 1 つも無かった。4 件足して緑で通ること自体が所見 = Mobile も直っている。プロダクトコードの変更なし
- **踏んだ罠**: worktree が tracker ブランチ（`origin/main` より 20 コミット古い）に居たまま最初のファイル読みをしたので、`TemplateEditPanel.tsx` などを**全部旧版で読んで**設計を組み立てかけた。**ブランチを切ってからファイルを読む**、が正しい順序
- **検証**: 4 ブランチとも CI verify のステップ列 14 本 + `docs-lint` をローカルで上から全部。#1470 のときだけ一括実行で `briefingEveningLazyMount` が 1 件落ちたが、単体でも静かな状態の全件（116 files / 1096 tests）でも緑 — memory に記録済みの cold-cache flake。実ブラウザでの再測定は worktree では回さない規約なので merge 後に chat-main

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
