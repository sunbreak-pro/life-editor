# HISTORY (chat-tags-docs)

### 2026-08-31 - #1337 records.mjs の archive スキャンと archive/INDEX.md

#### 概要

`archive/` 直下 96 本に索引が無く 63 本が grep でしか辿れなかったのを、`records.mjs` の生成物として埋めた（D-20260809-main-2 = A の実装・PR #1352 open）。

#### 変更点

- **`scanArchive` + `renderArchiveIndex`**: 直下 `*.md` からファイル名 + Status 行 + H1 を抽出し、所在表と Status 別件数を出す。`SUMMARY.md` と自分自身は除外
- **Status 行の書式が plans より広い**: archive には要件定義書・棚卸しメモも同居する（D-20260801-main-2 で enum 適用外）ため `Status:` / `**Status**:` / 先頭 `-` `>` の 4 通りが実在する。docs-consistency §3 と同じ範囲を 1 本の正規表現で拾った（実測: Status 行は全て 5 行目まで・持たないのは 3 本）
- **`#` の扱いだけ plans と分けた**: frontmatter の `Status: COMPLETED # 注記` はコメントだが、本文の `Status: COMPLETED (2026-06-11, PR #71)` は Issue 番号。素朴に切ると括弧が閉じない見出しになったので、**数字が続かない `#`** だけを落とす
- **5 本目の派生ビューとして配線**: `.gitignore` + docs-lint(a) の除外に追加。再生成は既に `records.mjs index` を呼んでいる SessionStart hook がそのまま担う。追随 = `rules/records.md` §1 / §4（索引 4 → 5 本）・`.claude/INDEX.md` の型別正本表・`CLAUDE.md` §0・`D-20260809-main-2` の `implemented-by`
- **計画書の決着**: `2026-08-09-record-graph-layer.md` は §後続 7 件のうちこれが最後の ⏸ だった。残ゼロで COMPLETED 化して `archive/` へ移動（plans/ に残すと docs-lint(d) が落ちる）。参照 5 箇所のパスと本文の相対リンク 1 本を追随修正
- **検証**: 2 回連続実行で出力差分ゼロ（冪等）／別 cwd から絶対パスで呼んでも同じ（SessionStart hook と同じ呼ばれ方）。`.claude/scripts/` にテスト基盤が無いため自動テストは足していない

### 2026-08-31 - #1342 アイコンピッカーの Escape がモーダルごと閉じる不具合

#### 概要

ピッカーを開いた状態の Escape 1 回で popover とタグ編集モーダルが同時に閉じ、未保存の名前まで消えていた。ハンドラ不足ではなく**順番**の問題（PR #1346 open）。

#### 変更点

- **原因**: パネルは dialog で、その Escape は `useDialogA11y` が `document` の **capture フェーズ**で取る。ピッカーのリスナは同じ `document` の bubble にいたため一度も到達しなかった。capture に移しても、先にマウントされたパネルが登録順で前に来るので勝てない
- **`useEscapeLayer` を `useDialogA11y.ts` に追加**: dialog と同じレイヤースタックに乗るが Escape だけを扱い focus trap は持たない、非モーダル面（popover / menu / picker）用の入口。最前面のレイヤーだけが Escape を受けるので 1 回目 = グリッド / 2 回目 = パネルになる
- **`stopImmediatePropagation` を使う**: パネルは同じノード・同じフェーズで待っており、素の `stopPropagation` では止まらない。`onClose` の identity が変わってリスナが再登録されると、順番次第でパネルも閉じてしまう
- **レイヤーに `modal` フラグ**: `hasOpenDialogLayer()` は従来どおり「aria-modal な面が開いている」だけを指す。popover がスタックに入っても MobileDrawer の edge-swipe と TourOverlay は誤って引っ込まない
- **テスト**: `shared/tests/tagIconPickerEscape.test.tsx` 新規 6 件。fix を外すと 3 件が red になることを実測した。未保存の名前が残る検証は、`onClose` が実際に閉じるホストで囲まないと `open` が true のままで意味を成さない（最初に書いた版が素通りしたので差し替え）
- **申し送り**: `shared/src/components/ColorPicker.tsx` が同じ行の隣で同一コードを持つため同症状のはず。Kanban / TagColorControls でも使われ影響範囲が変わるので本 PR に含めず、outbox で chat-main へ起票依頼した

#### 乖離レビュー（本セッション 2 件分）

- **スコープ逸脱**: #1342 で Issue の見当（TagIconPicker のみ）を越えて `useDialogA11y.ts` と `shared/src/index.ts` に手を入れた — レイヤー順の問題で dialog 側に primitive を足さないと直せないため。#1337 で計画書 1 本の archive 移動と参照 5 箇所の追随を行った（DoD「残作業表記を解消」の帰結）
- **AC 免除**: なし。ただし #1342 の DoD「守りのテストを `tagIconPickerSurface.test.tsx` の隣に」は、当該ファイルが未 merge の PR #1314 にしか無いため、同ディレクトリへ別名で新規追加した
- **途中で出た判断の行き先**: ColorPicker の同型バグ → outbox（chat-main へ起票依頼）。`.claude/scripts/` のテスト基盤不在 → PR #1352 本文に明記（今回は作らず）

### 2026-08-30 - #1291 タグアイコンを共通チップへ

#### 概要

タグのアイコンが見出し / 一覧 / Tag hub には届いていてチップで止まっていたのを、共通部品側で埋めた（PR #1318 open）。

#### 変更点

- **`TagPill` を `web/src/wikitag/` → `shared/src/components/` へ移動**。「タグ名が出るところ全部」に出す部品が 1 ホストの中にいるのは筋が通らないため（CLAUDE.md §6）。`web/src/wikitag/index.ts` は shared から再エクスポートして旧パス参照を生かした
- **先頭マークを色ドットから `TagHeadingIcon` のグリフへ**。見出し / hub と同じ 1 本の読み出し経路になり、「アイコンを編集したら全面が追随する」が構造で成立する。グリフ自体がタグ色で着色されるのでドットは重複だった。未設定は汎用 Tag グリフ（master list と同じ fallback）
- **`TagHeadingIcon` に `size` prop を追加**（既定 15 = 従来値）。チップは見出しより小さい字送りのため
- **採用した呼び出し側**: `TagPicker`（付与済みチップ + 候補リスト）/ `TagFilterPanel`（`TagFilterPanelTag` に `icon` 追加）/ `useTagFilterPanel`（`allTags` から流す）
- **境界**: `web/src/notes/` は不可侵（#1288 が同面を再構成中）。保存済みグループの要約行は名前のカンマ列でチップではないため対象外
- **テスト**: `shared/tests/tagChipIcon.test.tsx` 新規 5 件 + `tagFilterPanel.test.tsx` に 2 件追加。lucide が `<svg class="lucide lucide-star">` を刻むのでスナップショット無しでグリフを特定できる

### 2026-08-30 - #1289 タグ編集パネルのアイコンピッカーが崩れる不具合

#### 概要

ピッカーを開くと行が崩れ背景が透けて見えた件。Issue の見立て（未定義 `bg-lumen-*` の透明落ち）は外れで、原因は**幅**だった（PR #1314 open）。

#### 変更点

- **原因**: ポップオーバーが `absolute` なので包含ブロックが 32px のトリガーボタン。そこでの `width: auto` は shrink-to-fit = `min(max(min-content, 32px), max-content)` で、中身の `grid-cols-6` は Tailwind では `repeat(6, minmax(0, 1fr))` = **min-content 0**。下限が gap 5 個分（20px）しかなく、**背景が約 32px 幅で描かれ 28px のアイコンボタンだけが幅 0 のトラックからはみ出して隣の名前入力に散っていた**
- **`ColorPicker` で出なかった理由**: あちらのパネルは通常フローにいて、自分の幅が flex アイテムの幅に反映される
- **修正**: `w-max` 1 つ。#552 が色トークンを 1 段上げて直そうとしたのは対症で、幅には触れていなかった
- **テスト**: `shared/tests/tagIconPickerSurface.test.tsx` 新規 7 件。jsdom にレイアウトが無いので 204px そのものは測れないが、(a) ポップオーバーが自前の幅クラスを持つこと（`w-max` を外すと落ちるのを実測で確認）、(b) 塗っている `lumen-*` クラスが全て `tokens.css` に宣言済みであること、(c) その元値が light / dark 両スコープにあること、は宣言から検査できる
- **申し送り**: 未定義 `bg-lumen-*` の無警告透明落ちを機械で捕まえるゲートは (b) の形で書ける。他の浮遊面にも横展開の余地あり

### 2026-08-13 - #777 テストの DataService スタブ / fixture を共有ヘルパへ集約

#### 概要

30 スイートが手写ししていたテストの足場（DataService スタブとノード fixture）の土台を 1 箇所に置き、名前が 3 通りに割れていた分を寄せた（PR #812 open）。プロダクションコードは無変更。

#### 変更点

- **新設 3 本**: `shared/tests/helpers/dataServiceStub.ts`（`stubDataService` — `as unknown as DataService` のキャストを集約）/ `shared/tests/helpers/nodeFixtures.ts`（完全一致の `makeNote` 5 本・`makeTask` 2 本）/ `web/tests/helpers/index.ts`（`@life-editor/shared` エイリアスは `../shared/src` を指していて `shared/tests` に届かないため、4 段の相対パスをこの 1 本が持つ）
- **引数型の設計**: `Partial<Record<keyof DataService, unknown>>` — メソッド名だけ型チェックし値は緩いまま。多くのスイートは「本当は TaskNode を返すメソッド」に三つ組を返す（呼ぶ側がそこしか読まない）ため、真の返り値型を要求すると消したかった重複が増える
- **名前統一**: 18 本のファクトリを `makeDS` に（`makeDataService` 7 + `makeDs` 3 を改名）。うち 16 本が `stubDataService` 経由。残り 2 本（paletteItemSearch / workScreenLayout）は絞り込んだローカル型を返すので改名のみ
- **挙動不変の根拠**: diff を assertion 系トークンで絞って**増減 0 行**。テスト本数も前後同一（shared 217/1980・web 32/269）
- **意図的に残した**: 13 スイートのインラインスタブ（Issue の「1 PR で 30 ファイルを書き換えない」）/ Schedule 系の `makeItem`・`makeRoutine`（`frequencyType` と `frequencyDays` が各スイートの試したいケースを決める値で、共有既定を選ぶと他 2 本が何を試しているか黙って変わる）
- **申し送り**: `shared/tests` と `web/tests` は**どの CI ゲートでも型検査されていない**（両 tsconfig とも `include: ["src"]`・eslint は type-aware でない）。`stubDataService` の名前チェックは型検査を走らせた瞬間から効くもので今日の CI では効かない。検証用に一時 tsconfig で `tsc` を回してテスト木エラー 0 件を実測した（Scope 外なのでファイルは削除）。恒久ゲート化は別 Issue の判断
