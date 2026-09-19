# HISTORY (chat-connect-refine)

### 2026-09-19 - 390 幅で長いタイトルの行が横スクロールを生む問題を直した（#1749）

#### 概要

Connect のタグを 390 幅で開くと、タイトルの長い行だけ行末の「…」が x=356〜406 に出て画面幅 390 を越え、一覧に横スクロールが出ていた（出典 = Epic #716 の DoD 実測 m21）。**PR #1751（open）**。触ったのは `shared/src/components/TagHub/TagHubItemGroups.tsx` 1 ファイルとそのテストだけ。

#### 変更点

- 行のタイトルボタンの `w-full` を **`min-w-0 flex-1`** に置換。flex の子は既定で min-content 幅より小さくならないため、長いタイトルを抱えたボタンが縮むのを拒み、隣の 44px ボタンの場所を空けられなかった。中の span は元から `truncate` を持っているが、truncate は上の階層が全部縮めるようになって初めて効く
- `flex-1`（basis 0）にしたのは、`w-full` + `min-w-0` だと「まず 100% を要求してから 44px ぶん縮め戻す」形になるため。呼び出し元は `TagHubView` 1 箇所だけで、行末ボタンが無い場合に幅いっぱいへ伸びる挙動は変わらない
- テストは `shared/tests/tagHubMobile.test.tsx` に 2 件追加。jsdom はレイアウトを持たない（CLAUDE.md §7.1）ので幅の数値では検証せず、**縮める契約**（ボタン `min-w-0` / `flex-1`・label `min-w-0` / `truncate`・「…」`shrink-0`）と**両方が同じ `li` に入っていること**を固定した。既存 #1561 / #1646 の「クラス契約で 44px を固定する」やり方に揃えている

#### 検証

CI `verify` のステップ列 + `docs-lint` をローカルで上から全通しし、**15 ステップすべて exit 0**（shared / web / desktop / mcp-server）。390 幅の実ブラウザ確認は Issue の Gate どおり merge 後に chat-main。

### 2026-09-19 - タグのアイコンを 146 個に増やし、選択パネルに検索欄を足した（#1700 / #1701）

#### 概要

`/goal` で受けた 2 Issue を順に実装した。**#1700 = PR #1740（merged）**、**#1701 = PR #1743（open）**。どちらも CI verify の全 15 ステップ + docs-lint をローカルで通してから出している。#1701 は同じファイルを触るため #1740 の上に積んだが、#1740 が先に merge されたので base を main に付け替え済み（MERGEABLE を実測）。

#### 変更点

- **#1700（PR #1740・merged）**: `TAG_ICONS` を 56 → 146 個に。既存 9 カテゴリを厚くし、旧セットに 1 個も無かった 6 領域（自然 / 天気 / 道具 / 通信 / 場所 / 記号）を新設した。`import { icons }` には戻さず named import を 90 行足す形を維持。`tagIconExplicitImports.test.ts` の個数 band を 55〜60 → 112〜168 にし、`AREA_ICONS` に新設 6 領域を追加
- **#1701（PR #1743・open）**: パネル上部に検索欄。新規 `shared/src/components/tagIconAliases.ts` が 146 個ぶんの日本語別名を持ち、`matchesTagIconQuery` が英語名と別名の OR（部分一致・大文字小文字無視）で引く。文言 `connect.edit.iconSearch` / `iconNoMatch` を en / ja に足し、`TagHubEditLabels` → `TagIconPickerLabels` とホスト 2 箇所（`ConnectScreen.tsx` / `useSidebarContextMenus.tsx`）経由で渡す

#### 設計判断と実測

- **バンドル実測（eager index チャンク）**: 56 個 = 1,079.41 KB raw / 297.71 KB gzip → 146 個 = 1,105.24 / 307.62（**+9.91 KB gzip**・1 個あたり 0.110 KB）→ 検索欄 + 別名表まで入れて 1,119.39 / 315.11（**さらに +7.49 KB gzip**）。#1366 の予算 gzip +15 KB はアイコンぶんで収まったが、**2 本合計は +17.4 KB gzip**。別名表はパネルを開くまで誰も読まないので、削るなら `import()` で遅延するのが一番安い（実装はせず数字だけ残した）
- **描画時間の実測**（jsdom・12 回中央値）: 56 個 = 18.2ms → 146 個 = **62.0ms**。100ms は超えないので間引きは別 Issue にしない。ただし個数 2.6 倍に対して時間 3.4 倍で線形より悪い
- **別名表は「1 アイコン 1 行のスペース区切り文字列」**にした。配列のままだと prettier が 7 要素を 9 行に割って表が約 1,000 行になり、語を 1 つ足すたびに下の 4 行が動く。代償（別名にスペースを含められない）はテストで見張る
- **IME は 2 つを同時に満たす**: 絞り込みは変換中の `onChange` でも走らせる（打ちかけの「きん」が確定前に「きんとれ」へ絞れる）／ Enter・Escape・↑ ↓ は `isImeComposing` で弾く（WebKit の `keyCode 229` Enter 含めてテストで固定）
- **↑ ↓ は候補 1 つぶん動かす**（行 = 8 個ではない）。行内を動く自然なキー ← → はテキスト欄ではキャレットのものなので、8 個ずつ飛ばすと 8 個に 7 個がマウス専用になる。カーソル初期値は null で、何も打たないパネルはどのセルも光らない（「空のときの見た目が変わらない」を保つ）
- **セルが `role="option"` になった**: 検索欄 = combobox、グリッド = その listbox。`aria-activedescendant` がカーソル位置を読み上げに伝えつつキャレットは欄に残る。`aria-selected` = キーボードのカーソル / `aria-current` = そのタグが今使っているアイコン、と 2 状態を別の語に分けた
- **Scope 外を 1 箇所だけ直した**: `web/tests/connectScreen.test.tsx` の 2 件が Icon グループの「最初の button」を取っており、role 変更で「既定のアイコン」行を掴んで落ちた。今回の ARIA 変更が直接壊したものなので `getAllByRole("option")[0]` に直して同じ PR に入れた（Issue の Scope は `shared/tests/**` だけ）
- **lint の落とし穴 2 つ**: `react-hooks/set-state-in-effect` が `open` 監視の effect 内での状態リセットを error にするので、リセットはクリックハンドラ側へ移した（フォーカスだけ effect に残す）。JSX の三項の分岐に `{/* … */}` を置くと「親要素が 1 つでない」で構文ごと壊れる

### 2026-09-19 - Connect ワークベンチの残り 4 Issue を 5 PR で出した（#1676 / #1644 / #1645 / #1646）

#### 概要

`/goal` で受けた 4 Issue を順に実装し、PR #1685（merged）+ #1696 / #1698 / #1703 / #1709（open）にした。どの PR も base = main で、CI verify の 14 ステップをローカルで通してから出している。計画書は Status COMPLETED にして `.claude/archive/` へ移した。

#### 変更点

- **#1676（PR #1685・merged）**: タグレールの行を右クリックすると「…」と同じメニューがカーソル位置に開く。`Menu` に `anchorPoint`（viewport 座標 = `position: fixed` + 画面端で内側へ寄せる）を足し、メニューと編集下書きを `TagActionsMenu` + `useTagActionsMenu` + `useTagEditDrafts` として hub の外から呼べる形に切り出した（#1677 が使う）。narrow と「…」の無い行では既定のコンテキストメニューを潰さない
- **#1644（PR #1696 + #1698）**: `useWikiTagsUnifiedAPI` に `bulkAssign` / `bulkUnassign` / `moveItemsToTag` / `mergeTags`（既存の 1 行書き込みの逐次呼び出し・成功 / 失敗件数を返す。統合は assign → unassign → soft delete で、1 件でも失敗したら統合元を残す）。UI はアイテム行のチェックボックス + 下端の選択バー（タグを付ける / 外す / 別のタグへ移す / 選択解除）とタグ検索ポップオーバー、行メニューの「別のタグへ統合…」から開く `TagMergeDialog`
- **#1645（PR #1703）**: 行クリック = 選択に変え、右パネルをモード B（`RelationPanel` = リンク / 同じタグ / 同じ日のデイリー + リンクの追加と削除）へ。導出は shared の `buildItemRelations` に切り出し、`LinkPanel` も同じ関数を読む
- **#1646（PR #1709）**: narrow を 3 段に。行の「…」は BottomSheet、編集は `TagHubEditBlock` の 1 欄版（`only` prop）をシートで、関連もシート。複数選択・統合は Desktop 専用のまま。docs = `mobile-scope.md` #13 / brief の Status / 裁定の implemented-by / 計画書の archive 移動

#### 設計判断と実測

- **#1644 を 2 本に割った**: 1 PR で 1,250 行になり Issue の 900 行上限を超えたため、計画書の Step 6（API + 統合）と Step 7（複数選択）の境目で分割した。#1645 は 985 行で 9% 超過のまま出した（部品とそのテストを割ると挙動がレビューできなくなるため、PR 本文に明記）
- **`buildItemRelations` は `connections` ではなく `getLinksForItem` の 2 バケットを受け取る**: 計画書の草案は全リンクを渡す形だったが、`LinkPanel` は昔からバケット済みの配列を信じており、そのテスト（1 行も変えずに緑にするのが I-4a の DoD）が itemId と一致しないリンクを混ぜていた
- **narrow の編集シートは `editFocusField` では駆動できない**: あれは最初の操作で消える 1 回限りのフォーカス要求なので、最初のキー入力でシートが閉じた。シート専用の `sheetField` に分けた
- **Mobile の上部バー「＋」は未実装**（P-008 でキューへ）: narrow ヘッダーは shell の形状 enum で、末尾アクションを足すと `MainScreen.tsx`（本 Issue の Scope 外）に触る。タグ追加はレール下端の追加行が入口として残っている
- **検証**: 各 PR で CI verify の 14 ステップ全緑（最終形で shared 3138 tests / web 1246 tests）。`LC_ALL=C bash scripts/docs-lint.sh` = OK（この PC で 18 分）、`records.mjs check` = OK
- **事故**: 検証プロセスを止めるつもりの `kill` が `ps | grep verify.sh` で materials-refine の verify にも当たり、そちらを止めてしまった。連絡済み・先方は回し直して復旧。以後は自分の pid をファイルに控えて対象を絞った

---

### 2026-09-16 - タグ編集モーダルを Connect に畳んだ（#1643 / PR #1657 open）

#### 概要

同じタグ一覧が Connect のレールとタグ編集モーダルの 2 画面にあり、行の形まで意図的に揃えてあるのに編集できるのはモーダル側だけ、という二重保守を畳んだ（`D-20260912-main-1` Q1-A）。タグマスタの編集所は Connect セクションに一本化され、モーダルとその host は削除。CI verify の全ステップ + docs-lint をローカル全通しし、PR #1657 を open（**merge はユーザー = P-001**）。

#### 変更点

- **新規 `shared/src/components/TagHub/TagHubEditBlock.tsx`**: 退役した `TagDetailPane` の中身をブロックとして移設。**保存ボタンだけが書き込む**（#715）・blur は何も書かない・未保存ドット + 保存の footer（#681 の配置）。色は共有 `ColorPicker` のトリガー越しではなく 12 スウォッチをインライン展開した（盤面 2a が展開状態で、ブロック自体が既に開閉なので二重の開閉を避けた）
- **`TagHubTagRail.tsx`**: 行が「ボタンの隣にボタン」になった（`<button>` の入れ子は不正 HTML）。選択バー 2px は wrapper 側に絶対配置。件数 0 のタグを折り畳み「使われていないタグ（N）」へ（D4）、最下部に固定の追加行（D5）、行ホバーの「…」= 改名 / アイコン / 色 / 削除（D2）
- **`buildTagHubModel.ts`**: `unusedTags` を分けて返す。分岐の規則は `count === 0` だけで、行のチップと同じ導出から取るので「レールの分類と印字された数字が食い違う」が起こらない
- **`TagHubView.tsx`**: 編集系の props はすべて optional にした（渡さなければ #1643 以前の読み取り専用 hub のまま）。選択タグの解決を `tags` ∪ `unusedTags` に広げた — 折り畳みを開く理由が「編集 / 削除」なので、そこの行が選択できないと導線が死ぬ
- **`web/src/connect/ConnectScreen.tsx`**: 下書き（tagId keyed）・切替時の破棄確認・削除確認をホストが持つ。view が純粋で、かつレールの絞り込みと選択のどちらもブロックを unmount するため
- **退役**: `shared/src/components/tagEdit/` 一式・`web/src/tags/TagEditorHost.tsx`・呼び出し元ゼロになった `useTaggedItemIndex`。`TagIconPicker` と `tagRowPatch` は `TagHub/` へ移し、専用の labels 型を持たせた
- **導線の差し替え**: サイドバー行と Mobile「その他」シートの「タグを編集」は `setSection("connect")`。`SectionHeader` に `subtitle` prop を足して「タグ N ／ アイテム N」を出す（D1・Issue の Scope 外のファイルだが実装先が「header 組み立て」と指定されていたため）
- **テスト**: 旧 `tagEditorActions.test.tsx` の 11 ケース相当を `connectScreen.test.tsx` へ移設（unassign 2 件だけ #1644 へ持ち越し）。`tagHubView.test.tsx` に編集系 11 ケース、`tagHubLabels.ts` を共通 labels に新設、`tagRowPatch.test.ts` を新規（退役した `tagEditModalSave` が唯一の守りだったため）
- **検証**: shared 302 files / 3084 tests・web 126 / 1191・desktop・mcp-server 全 pass、lint / build / typecheck:tests 全 exit 0、`LC_ALL=C bash scripts/docs-lint.sh` exit 0
- **差分量**: `+2,205 / −3,551`。Issue の目安 1,200 行を超えたが、退役と置換を別 PR に割ると「タグを編集できない期間」ができるため分割しなかった（PR 本文に内訳を明記・chat-main へ outbox で報告）
- **スコープ外へ送った分（P-008）**: アイテム単位のタグ外し（選択バーの領分 = #1644）・タグの統合（同）

### 2026-09-16 - 繰り返しアイテムのタグを Connect とタグ編集に届かせる（#1631 / PR #1650 open）

#### 概要

繰り返しアイテムのタグは occurrence ではなくシリーズ（`routine` の `items_meta` 行）に書かれる（#468）のに、Connect もタグ編集パネルの索引も routine を読んでいなかった。結果、タグを選んでもシリーズが出ず件数にも入らず、occurrence が「タグなし」に溜まり、タグ編集では「その他 (無題)」になっていた。読み出し側に routine を足して解消。CI verify の全ステップ + docs-lint をローカル全通しし、PR #1650 を open（**merge はユーザー = P-001**）。

#### 変更点

- **`shared/src/hooks/useTaggedItemIndex.ts`**: `fetchAllRoutines()` を 5 本目の read として追加し、routine id を `role: "event"` + routine のタイトルで解決する。5 つ目のバッジは作らない（§4 / #185 = 繰り返しは「Event + 繰り返し設定」として見せる）。「routine は読まない」という旧コメントの前提は #468 で崩れていたので header ごと書き換えた
- **`shared/src/components/TagHub/types.ts`**: `TagHubItem` に `isSeries` / `seriesId` / `navigateId` を追加。`navigateId` は「綴じ先の id と遷移先の id が違う行」用で、今のところ繰り返しシリーズだけが使う
- **`shared/src/components/TagHub/buildTagHubModel.ts`**: 自前のタグを持たない行について 2 つの規則を追加。タグ付きシリーズの occurrence は落とす（シリーズ行が run 全体を代表する）／タグの無いシリーズ行は「タグなし」に入れない（occurrence が既に言っている）
- **`web/src/connect/ConnectScreen.tsx`**: `fetchAllRoutines()` を読み、routine をシリーズ 1 行として items に追加。occurrence には `seriesId` を載せる。遷移先は `pickSeriesOccurrence`（今日以降の最も早い occurrence → 無ければ直近の過去）で選び、`handleOpenItem` が `navigateId ?? id` を渡す。Calendar は routine id では何も選択できないため
- **`web/src/tags/TagEditorHost.tsx`**: コメントのみ（「routine は名前を引けない」という前提が変わった）
- **テスト**: `tagHubModel.test.ts` にシリーズ 6 ケース、`useTaggedItemIndex.test.tsx` に routine 解決 1 ケース、`connectScreen.test.tsx` に 4 ケース、`tagEditorActions.test.tsx` に 2 ケース
- **検証**: shared / web / desktop / mcp-server の 14 ステップと docs-lint が全 exit 0。途中 `web/node_modules` が #1587 の `@tiptap/extension-table` を欠いていて build が落ちたため `npm ci` で追いつかせた（実装とは無関係）
- **触っていないもの**: タグの書き込み先（routine id に付ける設計）・`ScheduleEventEditor.tsx`・DB スキーマ

### 2026-09-09 - narrow の絞り込み入力の余白タップを input に届かせる（#1578 / PR #1585 open）

#### 概要

#1561 で枠だけ 44px に伸ばした Tag hub の絞り込み入力は、中の `input` が 27px のままで枠の上下 11px をタップしてもフォーカスが入らなかった。`SidebarFilterField` の外側の箱を `div` から `label` に変え、ブラウザ標準のクリック転送で余白タップを input に届けた。CI verify と同じ 14 ステップをローカルで全通しし、PR #1585 を open（**merge はユーザー = P-001**）。

#### 変更点

- **`shared/src/components/materials/SidebarFilterField.tsx`**: 外側を `<label>` にして `cursor-text` を追加。`size` の `h-8` / `h-9` と ring の出し分けは据え置き。a11y 名は `input` の `aria-label` のまま（label は自前テキストを持たず、アイコンは `aria-hidden`）。onClick で `focus()` する案ではなく label にしたのは、input と別のハンドラを追従させる必要が無いため
- **`shared/src/components/TagHub/TagHubTagRail.tsx`**: `min-h-11` の注記に「箱が label なので余白タップも input に届く」を追記（コード変更なし）
- **`shared/tests/sidebarFilterField.test.tsx`**: 箱が `LABEL` で `control` が input を指すこと・`textContent` が空でアクセシブル名が変わらないことを固定（jsdom はレイアウトも label の activation も持たないので契約を pin する形）
- **副作用（PR 本文に明記）**: materials 側のノート一覧検索・タグ編集のマスターリストも同じ部品なので、枠の左右余白クリックで input にフォーカスが入るようになる。見た目は不変
- **検証**: shared lint / build / typecheck:tests / test、web 同 4 本、desktop typecheck / test / build、mcp-server build / typecheck:tests / test の 14 ステップ全 exit 0。docs-lint は docs 未変更のため対象外。実ブラウザの 390 幅タップ確認は merge 後に chat-main 側

### 2026-08-30 - Connect 退役の後片付け 2 本（#1220 d3 依存 / #1239 backlink 部品）

#### 概要

`section:connect` の残り open Issue 2 本を別 PR で処理した。どちらも #1152 の退役が残した「コードは消えたが宣言だけ残っている」類で、PR #1256（d3）と #1258（backlink 部品）を open。CI verify 全ステップ + docs-lint はローカルで両方とも全通し。

#### 変更点

- **#1220（PR #1256）**: `d3-force` / `d3-quadtree` / `d3-selection` / `d3-zoom` + `@types` 4 本を shared / web 両 package.json から削除し lockfile 再生成（-275 行）。着手前に `grep -rn "from ['\"]d3" shared/src web/src desktop/src mcp-server/src` = 0 を再実測。**バンドルは縮まない**（誰も import していなかったので元から積まれていない）ため、効くのは install サイズとマニフェストの正確さだけ — PR 本文にも明記した。lockfile に残る `d3-array` / `d3-scale` 等は recharts の推移依存で正しく残る
- **#1220 の追加 1 行**: `shared/package.json` の `_comment_sideEffects` が「Connect の d3 stack が initial chunk に乗っていた」を現在形で語っていたので #1152 / #1220 の日付を添えた過去形に。`sideEffects` **配列**は無改変（`analyticsTabsLightweight.test.ts` が pin しているのは配列の方で、Issue 本文の「コメントを pin」は取り違え）
- **#1239（PR #1258）**: `shared/src/components/Backlinks/` + `shared/src/utils/itemLinks.ts` + テスト 2 本を削除（-413 行）。裁定 = `D-20260829-connect-1` = B。#1152 で「次のホストが要るはず」と救出したが呼び出し元は現れず、#1171 の Tag hub もタグ軸なので import しない（計画書 AC で diff 0 行を pin 済み）→ P-002 適用
- **#1239 の Scope 外 1 本**: `shared/tests/itemLinks.test.ts`。Issue の Scope は `backlinkView.test.tsx` しか挙げていないが、削除対象を import しているので残すと `typecheck:tests` と vitest が落ちる。機械的な帰結だが scope 線を越えたので PR 本文に明記
- **#1239 の判断点（要レビュー）**: DoD は「シンボル名の grep = 0」。退役理由を残すコメント 3 箇所（バレル 2 + `LinkPanel.tsx` の設計注記）に名前を残したため実測は **3**。`rules/docs-consistency.md` §2 の「歴史的記述は同じ行に注記して残す」に従った判断で、**実参照はゼロ**。字面どおり 0 にしたいならコメントから名前を落とす旨を PR 本文で確認中
- **検証**: #1220 = shared 2675 / web 937 / desktop 7 / mcp-server 319、#1239 = shared 2666（削除した 9 ケース分の減）/ web 937 / desktop 7 / mcp-server 319。両方とも lint・build・typecheck:tests 全 exit 0、docs-lint OK
- **権限の確認**: #1239 の対象はこのセッションで「読み取り専用・変更が要るなら outbox 依頼」と指示されていたパスだったため、着手前にこうだいさんへ確認し「このレーンで削除まで実行」の回答を得てから進めた

### 2026-08-30 - Connect 2 本（#1152 / #1171）の merge 後始末 — 計画書を archive へ

#### 概要

PR #1175（退役）と #1230（Tag hub）が両方 merged・Issue #1152 / #1171 が CLOSED になったのを実測で確認し、対応する計画書 2 本を COMPLETED 化して `archive/` へ移した。コード変更なし。

#### 変更点

- **archive 移動**: `plans/2026-08-29-connect-section-retirement.md` と `plans/2026-08-29-connect-tag-hub.md` を `.claude/archive/` へ。Status を `COMPLETED # … PR #NNNN merged / Issue #NNNN CLOSED` に更新
- **相対パスの貼り替え**: 計画書は `plans/`（`.claude` から 3 階層下）から `archive/`（1 階層下）へ移るので、本文の `../../../CLAUDE.md` → `../CLAUDE.md`・`../../../rules/…` → `../rules/…`・`../../requirements/…` → `../docs/requirements/…` を全数置換。tag-hub 側の `Previous:` は前計画も同時に移したため `./…` のまま有効
- **参照元の追随**: `docs/design/briefs/connect.md` の「新 Connect の仕様の正本」リンクが `plans/` を指したままだったので `../../../archive/…` へ。**これは markdown リンクなので放置すると docs-lint (a) が落ちる**（history / memory 側の言及はインラインコードなので lint 対象外）
- **乖離レビュー 3 行**を両計画書の Worklog へ記入（archive 前の必須手順）。tag-hub 側の要点 = スコープ逸脱は docs 4 本で計画時に宣言済み / AC 免除なし / 途中で出た判断は TagPill・snapshot slot が計画書の §スコープ外、Briefing テストの flake が outbox
- **`archive/SUMMARY.md` は更新しない**（同ファイルの運用宣言どおり、2026-05-24 以降の archive 入りは索引しない）

### 2026-08-29 - Tag 起点の新 Connect セクション（Tag hub）を新設（#1171 / PR #1230 open）

#### 概要

#1152 で退役させた Connect を、力学グラフではなく**タグを入口にしたハブ**として同じ id で戻した。タグ一覧 → 選択 → そのタグの Note / Todo / Event / Daily を種類別に一覧し、行クリックで各アイテムの本来の画面へ飛ぶ。DataService への追加メソッドはゼロ・DDL 変更ゼロ。CI verify 全ステップ + docs-lint をローカルで全通しし、`origin/main`（#1215 = #1199 着地後）へ rebase してから PR #1230 を open（**merge はユーザー = P-001**）。

#### 変更点

- **新規（部品層）**: `shared/src/components/TagHub/` — `buildTagHubModel`（導出を丸ごと純関数化）+ レール / 種類別グループ / それを組む View。**新しい視覚言語を作らずに済んだ**のが設計上の要点で、レール行はタグ編集（#740）の行形、種別見出しはその `ItemRoleBadge`（#409）をそのまま使っている
- **新規（画面層）**: `web/src/connect/ConnectScreen.tsx` — `fetchTodoTree` / `fetchEvents` / `listNotesUnified` / `listDailiesUnified` の 4 本を `useDomainLoad` で読み、labels を解決して `navigateToItem` に配線。Provider は descriptor 側の `WikiTagsUnifiedProvider` 1 本だけ（4 ドメインは読み取り専用なので Briefing / Trash と同じ「Provider を足さない」形）
- **registry / i18n**: `sections.ts` に `connect`（icon = `Tags` / materials の直後 / `mobileOrder: 5`）を追加し、settings・trash の mobileOrder を 1 つ後ろへ。`connect.*` ブロックと `section.connect` を en / ja に新設。**`MainScreen.tsx` は無改変**（registry + descriptor の 2 箇所で閉じる = `rules/frontend.md`）— 同時進行の #1199 レーンと衝突しないための必須条件だった
- **設計判断（PR 本文にも記載）**: (1) 未分類バケツは必須機能 — タグ起点一本化ではタグ無しアイテムに入口が無くなる。soft-delete された assignment と、削除済みタグを指す assignment の 2 経路も未分類へ落とすようにした (2) 件数は `countsByTag` ではなく**表示している行から**導出（前者は hub が並べない role も数えるため 5 と 4 がズレる） (3) hub は編集しない・「今日への配置」導線を持たない（#1153 の領分。不在をテストで固定） (4) code-split しない（重いのはベンダー依存で、entry gzip は 233KB → 236KB の実測）
- **テスト**: `shared/tests/tagHubModel.test.ts`(20) が導出、`tagHubView.test.tsx`(15) が描画と狭幅 1 画面ずつ遷移、`web/tests/connectScreen.test.tsx`(7) がホスト配線（どの read がどの種別になるか / ゴミ箱行の除外 / event の date が nav intent に乗るか）を固定
- **docs 追随**: CLAUDE.md §8 / `rules/frontend.md` / `mobile-scope.md` #13（Full → **Consumption**）/ `tier-2-supporting.md`。**Issue の Scope に無い `docs/design/IA.md` と `briefs/connect.md` も追加**（#1152 が「Connect は退役した」と現況として書いた場所で、放置すると実在するセクションを docs が「無い」と言う状態になるため。決定本文は書き換えず注記のみ）
- **検証**: shared 265 files / 2570 tests・web 91 / 865・desktop 7・mcp-server 24 / 319 全 pass、lint / build / typecheck:tests 全 exit 0、`LC_ALL=C bash scripts/docs-lint.sh` exit 0。rebase 後の再検証で `web/tests/briefingEveningLazyMount.test.tsx` が 1 度だけ落ちたが、単体でも次のフル実行でも緑 = **フル実行時の flake**（#1115 の lazy mount・本 PR と無関係）。起票依頼を outbox に投函
- **スコープ外へ送った分（P-008）**: TagPill へのアイコン展開（Issue が「計画書で判断」としていた点 → **今回は入れない**と判断）・hub 内編集・`useDomainLoad` の snapshot slot（key の union が本計画の Scope 外にある）
- **計画書**: `plans/2026-08-29-connect-tag-hub.md`（Status: IN PROGRESS。archive 移動は merge 後）
