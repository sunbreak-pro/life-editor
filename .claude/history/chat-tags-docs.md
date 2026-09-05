# HISTORY (chat-tags-docs)

### 2026-09-02 - #1391 / #1390 docs 整合 2 本（常時ロード面の drift + design docs の追随）

#### 概要

2026-09-01 の docs 整合監査で出た 2 束を、`origin/main` から切った別々のブランチで片付けた。どちらも `.claude/` 配下のみの docs 変更で、コードには触っていない（PR #1451 / #1461 ともに merged）。

#### #1391 — 常時ロード面の数値 drift と dead path

- **主目的は `add-ipc-channel` スキル**: description は毎セッション読まれるので、そこに書いた「7 関数」が全セッションに配られていた。実測は `desktop/src/shared/ipcContract.ts` の **10 チャネル**（Issue 起票時点は 9・その後 `notify:show` が着地）で、**起票から実装までの 1 日で既にもう 1 ずれていた**。個数の転記自体をやめ「`DesktopIpcApi` を数える」形へ。名前空間の列挙も `DESKTOP_IPC` 参照に変え、箇条書きが拾い漏らしていた 2 本（Claude Code 起動 #1211 / OS 通知 #1374）を追加
- **tier-1-core の Database 節**: `○基本完成` のままで現役機能に読めていたので、Terminal と同じ体裁の `✗凍結`（D-20260704-main-1）へ
- **dead path を実リンク化**: `docs/vision/plans/2026-07-14-schedule-redesign.md` 等はバッククォート表記だったため **docs-lint(a) の検査対象外**（インラインコードは link 抽出前に落とされる）で腐り続けていた。実リンクに直したので以後は機械が見張る
- **実在しない archive 直下ファイル 4 箇所**: 2026-05-16 の統合（3b4715cc）で消えたファイルを「archive 済」と断言していた。歴史的事実は残し参照先を `archive/SUMMARY.md` へ
- **`rules/docs-consistency.md` §3**: 「archive へ移すのは COMPLETED / SUPERSEDED だけ」と書いてあるのに `2026-05-23-filechanged-comm-watch.md` は DEFERRED のまま archive にあり、`comm/README.md` もそう参照している。**意図的な運用だったので規則側に例外を明記**（Status 行に畳んだ理由を書くことが条件）
- **無変更で済んだもの**: packaging 計画の Status 註記は既に実態化済みだった（`PR #1348 / #1360` = どちらも MERGED を実測）

#### #1390 — design docs の追随

- `IA.md` は「ナビ構成の正本」を名乗るのに、registry（`shared/src/sections.ts`）に無い Trash をユーティリティ枠として列挙していた。実測は **7 セクション = 本流 6 + Settings 1**
- 決定 1（個数）・決定 3（Mobile 固定 4 タブの中身）は**断定をやめて registry を数える形**へ、決定 2（Trash = ユーティリティ枠）は取り消し線 + SUPERSEDED（#1293）
- サイドバー表から Trash 行を落とし、**抜けていた Briefing 行を追加**。More シートの中身（旧 `Connect / Settings / Trash`）を実測（固定 = Briefing / Schedule / Materials / Work・More = Analytics / Connect / Settings）へ
- `design/README.md` が同じ数値を 1 層外側に複製していたので registry 参照へ。tier-2 の Trash 節は Owner が **削除済みの `frontend/src/components/Trash/`** を指していたので現行パスへ

#### 検証

両ブランチとも `LC_ALL=C bash scripts/docs-lint.sh` = OK、CI `verify` の 14 ステップを全数ローカル実行して全緑（shared 2851 tests / web 1045 tests / desktop / mcp-server）。#1391 側は 1 回目に `web — test` の `briefingEveningLazyMount` が落ちたが、docs-lint と並走させた CPU 競合による既知 flake で、静かな状態の単独再実行は緑。

#### 乖離レビュー

- **スコープ逸脱**: なし。両 Issue の Scope 宣言の内側に収めた。`ipcContract.ts:138` のガードコメントが `Current = 9` のまま（同ファイル `:172` は「notify で 10」と書いており 1 ずれている）のを見つけたが `desktop/` は Scope 外なので触らず、PR 本文と outbox に申し送りだけ残した
- **AC 免除**: なし
- **途中で出た判断の行き先**: 2 件とも判断キューへ（D-20260902-tags-1 / -2）。chat-main の振り直しコメントが「要判断 A/B は実装せずキューへ」と明示していたのでそれに従った
- **運用メモ**: `scripts/docs-lint.sh` は vitest と並走させると 38 分かかる（単独なら数分）。**verify と docs-lint は順に回す**のが正解

### 2026-09-01 - #1366 タグアイコンを 26 → 56 に増やす

#### 概要

タグに合うグリフが見つからない状態を、lucide の個別 import を 30 行足して解消した。増やし方そのものが Issue の主眼で、レジストリ参照へ戻さないことが制約（PR #1383 open）。

#### 変更点

- **`TAG_ICONS` 26 → 56**: 生活 4 / 仕事 3 / 学習 4 / 健康 4 / お金 4 / 移動 4 / 食 4 / 趣味 3 を追加。既存 26 個との重複なし。宣言順 = グリッド順なので、汎用ブロックを先頭に置いたままカテゴリごとの連なりで並べた
- **バンドル実測**: eager チャンクは 955.12 KB → 962.54 KB raw / 264.48 KB → 267.32 KB gzip = **+2.84 KB gzip**（DoD の予算 +15 KB に対し 19%）。1 個あたり約 95 バイト gzip で、`import { icons }` が curate 数に関係なく 466.5 KB 固定なのと対照的。実測値を Issue にコメント済み
- **ピッカーを 8 列 × 約 5 行のスクロール枠へ**: 旧 6 列・高さ無制限のままだと 56 個でモーダル下端を突き抜け、以後アイコンを足すたびに悪化する。cap を置いたのでリストが伸びてもパネルの高さは 26 個当時とほぼ同じで固定される
- **スクロール枠に明示幅**: パネルの `w-max` はこの枠を測るが、overflow ボックスは max-content 幅にスクロールバーのガターを含めない。auto 幅だと最終列がバーに食われる（#1289 の再発形）
- **守りの穴を 1 つ塞いだ**: 既存の「1 行 1 名前」チェックは `TAG_ICONS` リテラル側の行でも満たせるため、import が消えても緑のままだった。**lucide の import 文の中だけを読む**チェックを追加し、未使用 import 禁止 / 55〜60 のバンド / 重複なし / 各カテゴリ 3 個以上 / グリッドが cap を宣言、も足した
- **検証**: shared（282 files / 2796 tests）・web（107 files / 1003 tests）・desktop・mcp-server・docs-lint すべて緑。web の vitest は 1 回目に `briefingEveningLazyMount` が 1 本落ちたが、単体再実行と warm cache 全件はどちらも緑（既知の冷えた transform キャッシュ由来の flake）

#### 乖離レビュー

- **スコープ逸脱**: なし。Issue の Scope（`tagIcon.ts` / `TagIconPicker.tsx` / 必要なら i18n）の内側で収まった。i18n はカテゴリ見出しも検索も採らなかったため不要
- **AC 免除**: なし。DoD 6 項目すべて実測で満たしている
- **途中で出た判断の行き先**: 実ブラウザでのピッカー表示確認は worktree では行わない規約（CLAUDE.md §7.4）のため未実施 — merge 後に chat-main 側の確認事項として PR 本文に残した。それ以外の計画外要望は出ていない

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
