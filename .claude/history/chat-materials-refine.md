# HISTORY (chat-materials-refine)

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

### 2026-09-01 (2) - #1407 Materials 復帰のロード / #1404 添付・埋め込み（PR #1417 / #1425）

#### 概要

2026-09-01 dispatch の残り 2 件。どちらも `origin/main` から独立に切って PR にした。**#1404 は 🛑 人手ゲート付き**で、`supabase/migrations/0027_attachments_bucket.sql`（非公開バケット + storage.objects の 4 ポリシー）は未適用のまま提出している（バケット作成・ポリシー投入は DDL push と同枠 = CLAUDE.md §7.3）。

#### 変更点

- **#1407（PR #1417）Materials へ戻ったときの空白を消した**: 一覧は #1101 の snapshot replay で既に即座に描かれていたが、**行は本文を持たない**（M1）ため、開いていたノートの本文だけ毎回 `getNoteUnified` を 1 往復し、その間エディタ領域が空だった。新規 `shared/src/state/noteBodyStore.ts` = 本文の module-level LRU（12 件）で、`domainSnapshotStore` と同じ 3 つの制限（メモリのみ / DataService identity で検証 / `updatedAt` 一致で検証）+ 上限付き。`mergeLoadedList` は**メモリ上に `prev` が無いときだけ**キャッシュを見る（ライブ状態が常に優先 = #607 の own-write カバーを壊さない）。`restoreSelection` は `canHydrate` を取り、snapshot replay からは**merge が既に本文を持っていた場合だけ**復元して、持っていなければ one-shot を消費せず戻る — fetch 側の `apply` が従来どおり全経路を通る。Trash からの完全削除で `forgetNoteBody`（二度と list read に現れないオブジェクトは何もエントリを無効化できないため）。ソフト削除では**あえて**破棄しない（Trash から戻すと行がそのまま復活し、キャッシュは正当なヒットになる）
- **#1404（PR #1425）スラッシュコマンドから画像 / ファイル**: `/` に Image と File を追加。**バケットは非公開**（`sounds` が public なのは中身が全員共通の環境音 5 本だから／こちらはユーザー自身のノート）で、**本文が持つのはパスだけ**。非公開バケットの URL は署名付き 1 時間で失効するので、本文に URL を焼き込むと「一晩で壊れるノート」か「ずっと公開のバケット」の二択になる。新規: `shared/src/constants/attachments.ts`（上限・TTL・`isEmbeddableImage`・`formatAttachmentSize`）/ `shared/src/services/SupabaseAttachmentsService.ts`（`<uid>/<uuid>.<ext>` で書く = migration 0027 のポリシーが認可する唯一の形）/ `web/src/notes/attachmentNode.ts`（block atom + 素の NodeView。itemLink と同じく**無条件登録**）/ `pickFile.ts` / `useAttachmentUpload.ts`。DataService には `attachments` ドメインを 1 つ足した（routing の型ガードが interface とタプルを両方向で突き合わせるので、宣言漏れも死んだ文字列もビルドで落ちる）
- **意図的な線引き（#1404）**: SVG は画像扱いにせずファイルのチップへ（スクリプトや外部参照を持てる「文書」なので inline 描画しない）／挿入はアップロード完了後（先に入れるとエディタの 800ms 自動保存に拾われ、届いていないパスを指すノードが永続化される）／進捗表示なし・孤児回収なし（どちらも outbox で起票依頼済み）／配線したのは Notes だけ（Issue の Scope が `web/src/notes/**` を名指し）
- **テスト**: #1407 = `shared/tests/noteBodyCache.test.tsx` 7 件。要は `waitFor` を使わない 1 本で、`renderHook` が返った時点で既にノートが本文つきで開いていること・`getNoteUnified` が一度も呼ばれていないことを見る（`await` を挟むと修正前でも緑になり何も証明しない）。逆側の不変式として「離れている間に他デバイスが書き換えたら revalidate が上書きする」も。キャッシュを空振りさせて 7 件中 6 件が落ちることを実測。#1404 = shared 10 件（オブジェクト名の形が中心 — 危険な拡張子 / 拡張子なし / 先頭ドットが全部 uuid だけのキーに落ちること、上限超過が**送る前に**弾かれること）+ web 18 件（実エディタで署名 URL 解決・SVG のチップ化・リゾルバ無し / 失敗のフォールバック、スラッシュ項目のゲートと挿入順序、ピッカーの後片付け）
- **検証**: 両ブランチで CI verify のステップ列（shared → web → desktop → mcp-server の lint / build / typecheck:tests / test）+ `docs-lint` をローカル全緑
