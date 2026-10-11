---
Status: Ready # Draft → Ready（Claude Design に渡せる）→ Round-<N>（N 回目の比べ直し中）→ Matched（揃った）
Kind: reproduce
Created: 2026-07-05
Updated: 2026-10-11
Section: schedule
Source: main = 07ead4ab # 値を換算したコード
Captured: 2026-10-10 # スクリーンショットと計測（main = 85aa99b9）
Owner-chat: shared-fix
Branch: docs/design-repro-brief-2153
---

# Reproduction Brief: Schedule（予定）

> 目的: **今の予定の画面を、Claude Design にそのまま写させる**こと。写した結果を出発点にして、余白や文字の大きさを Claude Design の上で微調整します（#2153・親 #2156）。
> 型は `_TEMPLATE-reproduce.md` です。新しい案を考えさせる 7 月の版（v2）は、git の履歴の `8cfee97d` にあります。v2 は旧パレット（Lumen blue）と、退役した Routines タブを前提にしていました。
> Claude Design はリポジトリを読めません。§5 のプロンプトには値をすべて書き写してあります。色の値・アプリの説明・設計の意図は、DesignSystem プロジェクトの部品集から毎回読み込まれます。
> 撮影の日（`85aa99b9`）から値を換算した日（`07ead4ab`）までに予定の画面へ入った変更は 4 本です。どれもタグの絞り込みパネル（#2178）と内部の処理（#2097 / #2098 / #2143）で、この指示書が写す範囲の見た目は変わっていません。

## 1. 写す範囲

- **画面とビュー**: 週ビュー・月ビュー・詳細パネルの 3 タブ（今日の流れ / Todo / 繰り返し）。Mobile は月ビューと、左の引き出しの 3 タブ。
- **幅とテーマ**: Desktop 1440×900 / Mobile 390×844 × ライト / ダーク の 4 通り。Desktop は詳細パネルを開いた状態です。
- **写さないもの**: アイテムを押したときの吹き出し・アイテム追加のパネル・予定のエディタ・タグの絞り込みパネル。1 回目は画面そのものに絞り、重ねて開くものは揃ってから足します。吹き出しの値は §3.7 に控えてあります。
- **外枠**: サイドバー・見出し行・下部タブバーは、試作一式（`../prototype/`）で作ってあれば作り直させません。無ければ §3.1 の値で一緒に作らせます。
- **今のまま写す癖**: Desktop 1440×900 で詳細パネルを開くと、ツールバーが狭い形に縮みます（「＋予定を追加」がアイコンだけになり、繰り返しのトグルも文字が消える）。これは今の正しい表示なので、文字付きに戻させません。

## 2. 画面の構成（どの部品がどこにあるか）

### 2.1 Desktop

本文の入れ物は `web/src/schedule/CalendarDesktopLayout.tsx:373` です。上から順に次が並びます。

1. **ツールバー**（`shared/src/components/schedule/ScheduleToolbar.tsx:146`）: 左から [今日] [‹ ›] 期間の表示（週は「10/4 – 10/10」、月は「2026年10月」）、空き、祝日のトグル（Flag）、繰り返しのトグル（Repeat）、週 / 月のセグメント、絞り込みボタン（ListFilter・件数のバッジ）、主ボタン「＋予定を追加」。
2. **レンズの行**（`shared/src/components/schedule/CalendarLensRow.tsx:63`）: 保存したタグのグループのチップ（名前と件数）。絞り込みが効いているときは「N 件を非表示」と「すべて表示」。チップが無く絞り込みも無いときは行ごと出ません。
3. **週ビュー**（`shared/src/components/schedule/WeekTimeGrid.tsx:528`）: 枠の中に、曜日と日付の見出しの行、終日の行、時刻の列と 7 日の列。0〜24 時をスクロールで見せます。
4. **月ビュー**（`shared/src/components/schedule/MonthGrid.tsx:247`）: 曜日の見出しの行と、6 週 × 7 日の 42 マス。週ビューと入れ替わりで出ます。
5. **詳細パネル**（`shared/src/components/RightSidebarContents.tsx:65`）: 見出し「詳細」、その下にタブ（`web/src/schedule/ScheduleSidebar.tsx` / `shared/src/components/schedule/ScheduleSidebarTabs.tsx:51`）とタブの中身。

### 2.2 Mobile

本文は `web/src/schedule/CalendarNarrowLayout.tsx:185` です。

1. **上端の帯**（外枠）: [ハンバーガー] 「予定」 [元に戻す] [やり直す]。
2. **見出しの行**: 月の題「2026年10月」、空き、絞り込みボタン、‹ ›、[今日]。
3. **月のグリッド**（`MonthGrid.tsx:246` の compact 型）: 画面の端から端まで。1 マスに予定の題を 1 行ずつ、最大 4 行。
4. **下部タブバー**（外枠）: 朝刊・予定・素材・集中・その他。
5. **左の引き出し**（`shared/src/components/MobileDrawer.tsx:84`）: ハンバーガーか日付のタップで開きます。見出し「詳細」と ×、3 タブ、選んだ日の日付と「＋追加」、今日の流れ。

- **Desktop から落とすもの**: 週ビュー、祝日と繰り返しのトグル、週 / 月のセグメント、レンズの行、主ボタン「＋予定を追加」（引き出しの「＋追加」が代わり）、マスの右上の ＋、吹き出し、詳細パネルのマイルーチンのカード。

## 3. 実測した値の表

寸法は px で、ルートの文字サイズ 18px での値です。rem に直すには 18 で割ります。Tailwind の余白は 0.25rem 刻みなので 4.5 の倍数が多く出ますが、ずれではなく今のコードの値です。出典の列は、コードの換算なら `file:line`、実画面の計測なら `measure` と書きます（`measure` = メインのクローンの `shots/2026-10-10-design-capture/measure/schedule-*-light.json`）。

いくつかの値には、表だけでは分からない決まりがあります。

- **アイコンの下限**: lucide のアイコンはすべて 0.9rem = 16.2px より小さくなりません（`shared/src/styles/tokens.css:505`・`:598-601`）。`size-3`（13.5px）も `size-3.5`（15.75px）も 16.2px で描かれます。計測でもアイコンの大きさは 16 と 18 の 2 種類だけでした（`measure`）。
- **Mobile のタップ領域**: `min-h-11` は 2.75rem なので、ルート 18px では 44px ではなく 49.5px です。
- **文字の段**: text-xs = 14.625px（行の高さ 19.5）、text-sm = 15.75px（行の高さ 22.5）、`text-[0.625rem]` = 11.25px。xs だけは Tailwind の既定より大きくしてあります（`tokens.css:530`）。太さは 400 / 500 / 600 / 700 です。
- **角丸**: `rounded` / `rounded-sm` = 4.5、`rounded-md` = 6.75、`rounded-lumen-sm` / `-md` / `-lg` = 6 / 8 / 12、`rounded-full` = 完全な円。

### 3.1 外枠（参考）

| 部品                  | 項目                     | 値（px）        | コードの書き方 | 出典                                           |
| --------------------- | ------------------------ | --------------- | -------------- | ---------------------------------------------- |
| サイドバー            | 幅                       | 270             | `w-60`         | `../prototype/01-screens.md` §14               |
| 見出し行              | 高さ                     | 67.5            | —              | 同上                                           |
| 詳細パネル            | 幅（既定 / 範囲）        | 320（240〜560） | —              | `shared/src/components/RightSidebar.tsx:32-33` |
| 本文                  | 幅（パネルを開いたとき） | 850             | —              | `../prototype/01-screens.md` §14               |
| Mobile の上端の帯     | 高さ                     | 49.5            | —              | 同上                                           |
| Mobile の下部タブバー | 高さ                     | 60.4            | —              | 同上                                           |

### 3.2 本文の入れ物とツールバー（Desktop）

| 部品                | 項目                                       | 値（px）                                    | コードの書き方                                                                | 出典                                                 |
| ------------------- | ------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 本文の入れ物        | 余白（上 右 下 左）                        | 13.5 24 18 24                               | `pt-3 pb-4 px-lumen-gutter md:px-lumen-gutter-wide`                           | `CalendarDesktopLayout.tsx:373`・`measure`           |
| 本文の入れ物        | 縦の間（ツールバー・レンズ・グリッドの間） | 13.5                                        | `gap-3`                                                                       | `CalendarDesktopLayout.tsx:373`                      |
| ツールバー          | 部品の間（広い / 狭い）                    | 11.25 / 6.75                                | `gap-2.5 @max-3xl:gap-1.5`                                                    | `ScheduleToolbar.tsx:146`                            |
| ツールバー          | 狭い形に縮む境                             | 入れ物の幅が 48rem 未満                     | `@max-3xl`                                                                    | `ScheduleToolbar.tsx:139`（px は未確認。864 か 768） |
| 今日                | 余白 / 高さ / 角丸                         | 13.5×6.75 / 約 38 / 8                       | `px-3 py-1.5 rounded-lumen-md border-lumen-border-strong`                     | `ScheduleToolbar.tsx:153`                            |
| 今日                | 文字                                       | 15.75 / 500                                 | `text-sm font-medium`                                                         | 同上                                                 |
| ‹ ›                 | 大きさ / 間 / 角丸 / アイコン              | 31.5 角 / 4.5 / 6 / 16.2                    | `size-7 gap-1 rounded-lumen-sm`、`size-3.5`                                   | `ScheduleToolbar.tsx:108,157-173`                    |
| 期間の表示          | 文字                                       | 15.75 / 600                                 | `text-sm font-semibold truncate`                                              | `ScheduleToolbar.tsx:176`                            |
| 祝日のトグル        | 大きさ                                     | 31.5 角（いつもアイコンだけ）               | `ICON_BTN`                                                                    | `ScheduleToolbar.tsx:197-213`                        |
| 繰り返しのトグル    | 余白 / 高さ / 角丸                         | 11.25×7 / 約 38.5 / 8                       | `px-2.5 py-[7px] gap-1.5 rounded-lumen-md`                                    | `ScheduleToolbar.tsx:227`                            |
| トグルの押下中      | 色                                         | 枠 accent・地 accent-subtle・字 accent      | `border-lumen-accent bg-lumen-accent-subtle text-lumen-accent`                | `ScheduleToolbar.tsx:197-227`                        |
| 週 / 月のセグメント | 外枠                                       | 余白 2.25・間 2.25・角丸 8・地 bg-secondary | `p-0.5 gap-0.5 rounded-lumen-md bg-lumen-bg-secondary`                        | `shared/src/components/SegmentedControl.tsx:204`     |
| 週 / 月のセグメント | 1 つ分                                     | 13.5×6.75・高さ 36・角丸 6・15.75           | `px-3 py-1.5 rounded-lumen-sm text-sm`                                        | `SegmentedControl.tsx:72,237`                        |
| 週 / 月のセグメント | 選択中                                     | 地 bg・500・影 sm                           | `bg-lumen-bg font-medium shadow-lumen-sm`                                     | `SegmentedControl.tsx:244`                           |
| 絞り込みボタン      | 大きさ                                     | 31.5 角                                     | `ICON_BTN`                                                                    | `ScheduleToolbar.tsx:261`                            |
| 件数のバッジ        | 大きさ / 文字                              | 高さ 18・最小幅 18 / 11.25・600             | `h-4 min-w-4 px-1 text-[0.625rem] font-semibold bg-lumen-accent`、右下に −4.5 | `ScheduleToolbar.tsx:261-288`                        |
| ＋予定を追加        | 余白（広い / 狭い）/ 角丸 / アイコン       | 15.75×7 / 9×7 / 8 / 18                      | `px-3.5 py-[7px] @max-3xl:px-2 rounded-lumen-md bg-lumen-accent`、`size-4`    | `ScheduleToolbar.tsx:303,307-308`                    |

### 3.3 レンズの行（Desktop）

| 部品                  | 項目                      | 値（px）                                                                          | コードの書き方                                     | 出典                                                             |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| 行                    | 部品の間                  | 9                                                                                 | `flex-wrap gap-2`                                  | `CalendarLensRow.tsx:65`                                         |
| チップ                | 余白 / 高さ / 角丸 / 文字 | 9×2.25 / 約 26 / 円 / 14.625                                                      | `px-2 py-0.5 rounded-lumen-full text-xs gap-1`     | `shared/src/components/materials/StatusFilterChips.tsx:54,65-71` |
| チップ（選択中 / 他） | 色                        | 枠 accent・地 accent-subtle・字 accent・600 / 枠 border・地 bg・字 text-secondary | —                                                  | 同上                                                             |
| チップの件数          | 色                        | text-tertiary・等幅数字                                                           | `tabular-nums text-lumen-text-tertiary`            | 同上                                                             |
| N 件を非表示          | 文字                      | 14.625・text-secondary                                                            | `text-xs`                                          | `CalendarLensRow.tsx:75`                                         |
| すべて表示            | 余白 / 角丸 / 文字        | 9×2.25 / 8 / 14.625・500                                                          | `px-2 py-0.5 rounded-lumen-md text-xs font-medium` | `CalendarLensRow.tsx:81`                                         |

### 3.4 週ビュー（Desktop）

| 部品                 | 項目                            | 値（px）                                                                                  | コードの書き方                                                                     | 出典                           |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| 枠                   | 角丸 / 線 / 地                  | 6.75 / border / bg                                                                        | `rounded-md border border-lumen-border bg-lumen-bg`                                | `WeekTimeGrid.tsx:528`         |
| 時刻の列             | 幅                              | 58.5                                                                                      | `GUTTER = "3.25rem"`                                                               | `WeekTimeGrid.tsx:256`         |
| 1 時間               | 高さ                            | 48（px 固定）                                                                             | `hourHeight = 48`                                                                  | `WeekTimeGrid.tsx:313`         |
| 曜日と日付の見出し   | 余白 / 高さ                     | 4.5×6.75 / 約 53                                                                          | `px-1 py-1.5`、右と下に border                                                     | `WeekTimeGrid.tsx:567-588`     |
| 曜日                 | 文字                            | 14.625・500・大文字・字間広め・text-secondary                                             | `text-xs font-medium uppercase tracking-wide`                                      | 同上                           |
| 日付                 | 文字                            | 14.625・text                                                                              | `text-xs`                                                                          | 同上                           |
| 今日の見出し         | 色                              | 地 hover・字 accent・日付は 600                                                           | `bg-lumen-hover text-lumen-accent font-semibold`                                   | `WeekTimeGrid.tsx:568,575,585` |
| 今日の列             | 地                              | accent-subtle                                                                             | `bg-lumen-accent-subtle`                                                           | `WeekTimeGrid.tsx:752`         |
| 終日のラベル         | 余白 / 文字                     | 4.5 / 14.625・text-secondary・右寄せ                                                      | `px-1 py-1 text-xs`                                                                | `WeekTimeGrid.tsx:603`         |
| 終日のマス           | 最小の高さ / 余白 / チップの間  | 31.5 / 4.5 / 4.5                                                                          | `min-h-[1.75rem] p-1 space-y-1`                                                    | `WeekTimeGrid.tsx:614`         |
| 終日のチップ         | 余白 / 角丸 / 文字 / 帯         | 4.5×2.25 / 4.5 / 14.625 / 左に 2 の accent                                                | `rounded border-l-2 border-lumen-accent bg-lumen-bg-secondary px-1 py-0.5 text-xs` | `WeekTimeGrid.tsx:683`         |
| 祝日のチップ         | 余白 / 文字                     | 4.5×2.25 / 14.625・500                                                                    | `rounded px-1 py-0.5 text-xs font-medium`、色はタグの色                            | `WeekTimeGrid.tsx:635`         |
| 時刻のラベル         | 位置 / 文字                     | 線の 6.75 上・右 4.5 / 14.625・等幅数字・text-secondary                                   | `absolute -top-1.5 right-1 text-xs tabular-nums`                                   | `WeekTimeGrid.tsx:729`         |
| 時刻の線             | 線                              | 1・border                                                                                 | `border-t border-lumen-border`                                                     | `WeekTimeGrid.tsx:762`         |
| 予定のブロック       | 余白 / 角丸 / 文字 / 左右の隙間 | 4.5×2.25 / 4.5 / 14.625・行の高さ詰め / 1                                                 | `rounded px-1 py-0.5 text-xs leading-tight`                                        | `WeekTimeGrid.tsx:824,847-848` |
| 予定のブロック       | 色（タグなし）                  | 枠 schedule-event-border・地 schedule-event-bg・字 chip-event-fg                          | —                                                                                  | `WeekTimeGrid.tsx:281`         |
| ブロックの題 / 時刻  | 文字                            | 500 / 14.625・不透明度 80%                                                                | `font-medium` / `text-xs opacity-80`                                               | `WeekTimeGrid.tsx:871,921`     |
| 繰り返しのブロック   | 色 / 左の帯 / アイコン          | 地 schedule-routine-bg・字 chip-routine-fg / 幅 3・chip-routine-dot / Repeat 16.2・線 2.5 | `pl-1.5`、`w-[3px]`、`size-3`                                                      | `WeekTimeGrid.tsx:277,857-882` |
| Todo のブロック      | 色 / アイコン                   | 地 schedule-task-bg・字 chip-task-fg・枠なし / CheckSquare 16.2・線 2.5                   | —                                                                                  | `WeekTimeGrid.tsx:279,888-893` |
| 完了したもの         | 見た目                          | 取り消し線・不透明度 55%                                                                  | `line-through opacity-55`                                                          | `WeekTimeGrid.tsx:841`         |
| タグの付いたブロック | 色                              | 地をタグの色に置き換え、字はその上で読める色。繰り返しの帯は字の色の 60%                  | `bg-current opacity-60`                                                            | `WeekTimeGrid.tsx:831,844,864` |
| 選択中のブロック     | 輪郭                            | 2・accent                                                                                 | `ring-2 ring-lumen-accent`                                                         | `WeekTimeGrid.tsx:824`         |
| 伸縮のつまみ         | 高さ                            | 6.75                                                                                      | `h-1.5`                                                                            | `WeekTimeGrid.tsx:931`         |
| 今の時刻の線         | 線 / 点                         | 2・accent / 直径 9・accent・左端                                                          | `border-t-2 border-lumen-accent`、`size-2 rounded-full`                            | `WeekTimeGrid.tsx:947,953`     |

### 3.5 月ビュー（Desktop）

| 部品         | 項目                           | 値（px）                                                                              | コードの書き方                                        | 出典                                                       |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| 枠           | 角丸 / 線                      | 6.75 / border                                                                         | `rounded-md border`                                   | `MonthGrid.tsx:247`                                        |
| 曜日の見出し | 余白 / 文字                    | 上下 4.5 / 14.625・500・text-secondary                                                | `py-1 text-xs font-medium`                            | `MonthGrid.tsx:257`                                        |
| マス         | 最小の高さ / 余白 / 中の間     | 184.5 / 4.5 / 2.25                                                                    | `min-h-[10.25rem] p-1 gap-0.5`、右と下に border       | `MonthGrid.tsx:322,349-352`                                |
| ほかの月の日 | 見た目                         | 不透明度 40%                                                                          | `opacity-40`                                          | `MonthGrid.tsx:353`                                        |
| 日付のバッジ | 大きさ / 文字                  | 高さ 22.5・最小幅 22.5・円 / 14.625・600                                              | `h-5 min-w-5 rounded-full px-1 text-xs font-semibold` | `MonthGrid.tsx:364,378`                                    |
| 今日の日付   | 色                             | 地 accent・字 on-accent（マスの地は変えない）                                         | `bg-lumen-accent text-lumen-on-accent`                | `MonthGrid.tsx:380`                                        |
| チップ       | 余白 / 高さ / 角丸 / 文字 / 数 | 4.5×2.25 / 約 24 / 4.5 / 14.625・500 / 1 マス最大 5                                   | `rounded px-1 py-0.5 text-xs font-medium`             | `shared/src/components/schedule/MonthGridParts.tsx:59,262` |
| チップ       | 色                             | 地 chip-{event / routine / task}-bg・字 chip-*-fg。タグがあればタグの色。点は付けない | —                                                     | `MonthGridParts.tsx:93-101`                                |
| 他 N 件      | 余白 / 文字                    | 左右 4.5 / 14.625・text-tertiary                                                      | `rounded px-1 text-xs`                                | `MonthGridParts.tsx:317`                                   |
| マスの ＋    | 大きさ / 位置                  | 31.5 角・右上 2.25 / ホバーかフォーカスで出る                                         | `size-7 top-0.5 right-0.5 opacity-0`                  | `MonthGridParts.tsx:415-421`                               |

### 3.6 詳細パネル（Desktop）と左の引き出し（Mobile）

| 部品                       | 項目                           | 値（px）                                                | コードの書き方                                                                          | 出典                                                           |
| -------------------------- | ------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| パネル                     | 地 / 線                        | bg-subsidebar / 左に border                             | `border-l bg-lumen-bg-subsidebar`                                                       | `RightSidebarContents.tsx:65`                                  |
| パネルの見出し             | 高さ / 余白 / 文字             | 54 / 左 18・右 13.5 / 15.75・600                        | `h-12 pl-4 pr-3 text-sm font-semibold`、下に border                                     | `RightSidebarContents.tsx:65`                                  |
| パネルの中身               | 余白                           | 13.5                                                    | `p-3`                                                                                   | `RightSidebarContents.tsx:100`                                 |
| タブ                       | 間 / 1 つ分                    | 13.5 / 6.75×6.75・高さ約 33・14.625・折り返さない       | `gap-3`、`px-1.5 py-1.5 text-xs whitespace-nowrap`                                      | `ScheduleSidebarTabs.tsx:51-63`・`SegmentedControl.tsx:95`     |
| 今日の流れ: 日付           | 文字                           | 14.625・text-secondary                                  | `text-xs`                                                                               | `ScheduleSidebar.tsx:255`                                      |
| 今日の流れ: 行             | 最小の高さ / 余白 / 間 / 下線  | 42 / 上下 4.5・左 4.5 / 9 / border                      | `min-h-[42px] py-1 pl-1 gap-2`、`border-b`                                              | `shared/src/components/schedule/AgendaList.tsx:200`            |
| 今日の流れ: 時刻 / 点 / 題 | 幅・文字 / 直径 / 文字         | 49.5・14.625 / 6.75 / 15.75                             | `w-11 text-xs` / `size-1.5` / `text-sm`                                                 | `AgendaList.tsx:209,232,238`                                   |
| 今日の流れ: 終日           | 丸いラベル                     | 6.75×2.25・14.625・600・text-tertiary・枠 border-strong | `rounded px-1.5 py-0.5 text-xs font-semibold`                                           | `AgendaList.tsx:205`                                           |
| 今の時刻の区切り           | 余白 / 時刻 / 線               | 上下 6.75 / 14.625・700・accent / 2・accent             | `py-1.5`、`text-xs font-bold`、`border-t-2`                                             | `AgendaList.tsx:297-303`                                       |
| マイルーチンのカード       | 余白 / 間 / 角丸 / 地          | 18 / 13.5 / 6.75 / bg-secondary・border                 | `rounded-md border bg-lumen-bg-secondary p-4 gap-3`                                     | `shared/src/components/schedule/RoutineSummaryCard.tsx:57-73`  |
| マイルーチンの題 / 行      | 文字 / 余白                    | 15.75・600 / 上下 9・下線                               | `text-sm font-semibold` / `py-2 border-b`                                               | 同上                                                           |
| Todo: 絞り込みボタン       | 大きさ / 角丸                  | 36 角 / 8                                               | `size-8 rounded-lumen-md`                                                               | `ScheduleSidebar.tsx:446,458`                                  |
| Todo: 2 つの一覧           | 間 / 見出しの行                | 18 / 最小 31.5・14.625・600・text-secondary             | `gap-4`、`min-h-7`、`text-xs font-semibold`                                             | `shared/src/components/schedule/TodayTodoTray.tsx:483,506-507` |
| Todo: チェックボックス     | 当たり判定 / アイコン          | 49.5 角 / 20                                            | `min-h-11 min-w-11`                                                                     | `shared/src/components/TodoStatusCheckbox.tsx:46,111`          |
| Todo: 行                   | 最小の高さ / 題 / 時刻         | 38 / 15.75 / 14.625                                     | `min-h-[38px] py-1 text-sm` / `text-xs`                                                 | `TodayTodoTray.tsx:291,301,311`                                |
| Todo: ホバーの操作         | 大きさ                         | 27 角                                                   | `size-6`                                                                                | `TodayTodoTray.tsx:333,349`                                    |
| ＋本日分に追加 / ＋Todo    | 余白 / 高さ / 角丸 / 文字 / 影 | 15.75×6.75 / 約 35 / 9 / 14.625・500 / sm               | `px-3.5 py-1.5 rounded-lg text-[0.8125rem] font-medium shadow-lumen-sm bg-lumen-accent` | `shared/src/components/AddPill.tsx:34-36`                      |
| 繰り返し: 一覧 / 行        | 間 / 角丸・地・線              | 6.75 / 8・bg・border                                    | `gap-1.5` / `rounded-lumen-md border bg-lumen-bg pr-1`                                  | `shared/src/components/schedule/RepeatListPanel.tsx:109,143`   |
| 繰り返し: 行の中           | 余白 / 間 / 題 / 頻度          | 13.5×9 / 9 / 15.75・500 / 14.625                        | `px-3 py-2 gap-2 text-sm font-medium` / `text-xs`                                       | `RepeatListPanel.tsx:126,129,158`                              |
| 繰り返し: 削除             | 余白 / アイコン                | 6.75 / 18                                               | `p-1.5`、Trash2 `size-4`                                                                | `RepeatListPanel.tsx:167-169`                                  |
| 引き出し（Mobile）         | 幅 / 出る向き                  | 360（画面幅の 85% まで。390 幅では 331.5）/ 左から      | `max-w-[85vw] bg-lumen-bg-subsidebar shadow-lumen-lg border-r`                          | `MobileDrawer.tsx:84,155`                                      |
| 引き出しの ×               | 当たり判定 / アイコン          | 49.5 / 16.2                                             | —                                                                                       | `RightSidebarContents.tsx:83`                                  |
| 引き出しの ＋追加          | 当たり判定                     | 高さ 49.5                                               | `AddPill` + `max-md:min-h-11`                                                           | `ScheduleSidebar.tsx:249-267`                                  |

### 3.7 アイテムの吹き出し（Desktop・2 回目以降に足す）

| 部品       | 項目                        | 値（px）                              | コードの書き方                                                     | 出典                                                                                                          |
| ---------- | --------------------------- | ------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 吹き出し   | 幅 / 角丸 / 影 / 上下の余白 | 520（2 列で各 260）/ 8 / lg / 4.5     | `rounded-lumen-md border bg-lumen-bg py-1 shadow-lumen-lg`         | `web/src/schedule/todoChipPanel.ts:61`・`shared/src/components/itemActions/ItemActionPopover.tsx:270,290,297` |
| 題と時刻   | 余白 / 文字                 | 13.5×9 / 14.625（題は 600・2 行まで） | `px-3 py-2 text-xs`                                                | `ItemActionPopover.tsx:179`・`web/src/schedule/ScheduleOverlays.tsx:209-216`                                  |
| 操作の行   | 余白 / 高さ / 間 / アイコン | 13.5×6.75 / 約 33 / 9 / 16.2          | `px-3 py-1.5 gap-2 text-xs`                                        | `shared/src/components/itemActions/ItemActionRow.tsx:14-15,41`                                                |
| 詳細を編集 | 余白 / 角丸 / 文字          | 13.5×6.75 / 8 / 14.625・500           | `px-3 py-1.5 rounded-lumen-md bg-lumen-accent text-xs font-medium` | `ItemActionPopover.tsx:250-259`                                                                               |

### 3.8 Mobile の月ビュー

| 部品                 | 項目                     | 値（px）                                                                      | コードの書き方                                                                   | 出典                               |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| 見出しの入れ物       | 余白 / 間                | 左右 16・上 13.5 / 13.5                                                       | `px-lumen-gutter pt-3 gap-3`                                                     | `CalendarNarrowLayout.tsx:185`     |
| 見出しの行           | 部品の間                 | 9                                                                             | `gap-2`                                                                          | 同上                               |
| 月の題               | 文字                     | 15.75・600                                                                    | `text-sm font-semibold`                                                          | 同上                               |
| 絞り込み / ‹ ›       | 大きさ / 角丸 / アイコン | 49.5 角 / 8 / 18                                                              | `size-8 min-h-11 min-w-11 rounded-lumen-md border-lumen-border-strong`、`size-4` | `CalendarNarrowLayout.tsx:90-91`   |
| 今日                 | 高さ / 余白 / 文字       | 49.5 / 13.5×6.75 / 15.75・500                                                 | `min-h-11 px-3 py-1.5 text-sm font-medium rounded-lumen-md`                      | `CalendarNarrowLayout.tsx:185-257` |
| グリッド             | 枠 / 上下の余白          | 上下の線だけ・角丸なし / 13.5                                                 | `border-y`、`pt-3 pb-3`                                                          | `MonthGrid.tsx:246,300`            |
| マス                 | 最小の高さ / 余白        | 99 / 上 4.5・左右と下 2.25                                                    | `min-h-[5.5rem] px-0.5 pb-0.5 pt-1`                                              | `MonthGrid.tsx:322,352`            |
| 日付のバッジ         | 大きさ / 文字            | 18 / 11.25                                                                    | `h-4 min-w-4 text-[0.625rem]`                                                    | `MonthGrid.tsx:377`                |
| 選んだ日             | 見た目                   | 地 bg-secondary・内側に 2 の accent の輪郭                                    | `bg-lumen-bg-secondary ring-2 ring-inset ring-lumen-accent`                      | `MonthGrid.tsx:324`                |
| 予定の題             | 余白 / 角丸 / 文字 / 数  | 左右 2.25 / 4.5 / 11.25・行の高さ 14.625・500 / 最大 4 行、右端はぼかして切る | `rounded-sm px-0.5 text-[0.625rem] leading-[0.8125rem] font-medium`              | `MonthGridParts.tsx:143,168`       |
| あふれ               | 文字                     | text-tertiary                                                                 | —                                                                                | `MonthGridParts.tsx:71`            |
| 文字の大きさ（全体） | 種類                     | 11.25 / 14.6 / 15.8 の 3 種類                                                 | —                                                                                | `measure`                          |

### 3.9 状態

| 状態               | 出るもの                                                                                             | 出典                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 読み込み中         | 「読み込み中…」だけの箱（余白 18×45・15.75・角丸 6.75・地 bg-secondary・border）。骨組みの表示は無い | `shared/src/components/schedule/ScheduleStateCards.tsx:55`     |
| エラー             | 「予定を読み込めませんでした」と「再試行」                                                           | `ScheduleStateCards.tsx:69-74`                   |
| 一部の期間だけ失敗 | グリッドの上に帯（13.5×9・14.625）と「再試行」（11.25×4.5）                                          | `ScheduleStateCards.tsx:147-152`                 |
| 空（グリッド）     | 文言は無く、空のグリッドのまま                                                                       | `WeekTimeGrid.tsx`・`MonthGrid.tsx` を読んで確認 |
| 空（今日の流れ）   | 「今日の予定はありません」（選んだ日なら「この日の予定はありません」）。上下 27・中央寄せ・15.75     | `AgendaList.tsx:317`                             |
| 空（Todo）         | 「本日分の Todo はまだありません」「その他の Todo はありません」。上下 9・14.625                     | `TodayTodoTray.tsx:416,513`                      |
| 空（繰り返し）     | 「ルーチンはまだありません」                                                                         | `RoutineSummaryCard.tsx:65`                      |

## 4. スクリーンショットの一覧

撮影は 2026-10-10 で、メインのクローンの `shots/2026-10-10-design-capture/` にあります。git には入っていません。実画面には本人のデータ（勤務の予定など）が写っているので、気になるものは添付から外してください。§5 の見本データだけでも組めるように書いてあります。末尾が `-full` のものは縦に長い画面の全体版です。

| ファイル名                                                   | 幅      | テーマ          | 写っている状態                   | 添付する回                 |
| ------------------------------------------------------------ | ------- | --------------- | -------------------------------- | -------------------------- |
| `03-schedule-week-desktop-light.png` / `-dark.png`           | Desktop | ライト / ダーク | 週ビュー・詳細パネルの今日の流れ | 1 回目                     |
| `03-schedule-week-desktop-light-full.png` / `-dark-full.png` | Desktop | ライト / ダーク | 週ビューの 0〜24 時の全体        | 枚数に余裕があれば 1 回目  |
| `04-schedule-month-desktop-light.png` / `-dark.png`          | Desktop | ライト / ダーク | 月ビュー                         | 1 回目                     |
| `03-schedule-month-mobile-light.png` / `-dark.png`           | Mobile  | ライト / ダーク | 月ビュー                         | 1 回目                     |
| `05-schedule-side-todayflow-mobile-light.png` / `-dark.png`  | Mobile  | ライト / ダーク | 引き出しの今日の流れ             | 1 回目                     |
| `05-schedule-side-todayflow-desktop-light.png` / `-dark.png` | Desktop | ライト / ダーク | 詳細パネルの今日の流れ           | 2 回目以降（ずれが出たら） |
| `06-schedule-side-todo-desktop-light.png` / `-dark.png`      | Desktop | ライト / ダーク | 詳細パネルの Todo                | 1 回目                     |
| `06-schedule-side-todo-mobile-light.png` / `-dark.png`       | Mobile  | ライト / ダーク | 引き出しの Todo                  | 2 回目以降                 |
| `07-schedule-side-repeats-desktop-light.png` / `-dark.png`   | Desktop | ライト / ダーク | 詳細パネルの繰り返し             | 1 回目                     |
| `07-schedule-side-repeats-mobile-light.png` / `-dark.png`    | Mobile  | ライト / ダーク | 引き出しの繰り返し               | 2 回目以降                 |

計測の JSON（`measure/schedule-desktop-light.json` / `schedule-mobile-light.json`）はライトだけです。寸法はテーマで変わらないため、ダークは撮影だけにしました。

## 5. 最初のプロンプト

枠の中身をそのまま貼ります。試作一式のプロジェクトで続けて送るときは、「外枠」の節を「外枠は今のまま変えないでください」の 1 行に差し替えます。

```markdown
# 今の「予定（Schedule）」の画面を、そのまま写してください

これは新しいデザインの依頼ではありません。Life Editor の今の予定の画面を、下の構成と値のとおりに再現してください。良く見せるための変更はしないでください。色は部品集の lumen のトークンだけを使ってください。添付のスクリーンショットは実際の画面です。値とスクリーンショットが食い違って見えたら、値のほうを優先してください。

## フレーム

- Desktop 1440×900（右の詳細パネルを開いた状態）と Mobile 390×844。それぞれライトとダーク。
- ルートの文字サイズは 18px です。値は px で書きますが、組むときは rem（px ÷ 18）にしてください。4.5px の倍数が多いのは、0.25rem 刻みで組んでいるためです。
- 文字の段: 11.25px（0.625rem）/ 14.625px（0.8125rem・行の高さ 19.5）/ 15.75px（0.875rem・行の高さ 22.5）。太さは 400 / 500 / 600 / 700。
- アイコンは lucide です。どのアイコンも 16.2px より小さくしません（13.5px や 15.75px の指定も 16.2px で描く）。
- Mobile で押せるものの高さは 49.5px（2.75rem）です。

## 外枠

- Desktop: 左のサイドバー 270px、上の見出し行 67.5px（左に「予定」、右に検索欄・元に戻す・やり直す・詳細パネルの開閉）、右の詳細パネル 320px（地 bg-subsidebar・左に線）。残る本文は 850px です。
- Mobile: 上端の帯 49.5px（ハンバーガー・「予定」・元に戻す・やり直す）、下部タブバー 60.4px（朝刊・予定・素材・集中・その他。予定が選択中）。

## Desktop の本文（上から順に）

本文の入れ物の余白は上 13.5・左右 24・下 18px。ツールバー・レンズの行・グリッドの間は 13.5px。

1. ツールバー（部品の間 6.75px。850px の本文では狭い形になる）
   - 左: [今日]（余白 13.5×6.75・高さ約 38・角丸 8・線 border-strong・15.75px 500）、[‹][›]（31.5px 角・角丸 6・間 4.5・アイコン 16.2）、期間の表示「10/4 – 10/10」（15.75px 600）。
   - 右: 祝日のトグル（Flag のアイコンだけ・31.5px 角）、繰り返しのトグル（Repeat のアイコンだけ・余白 11.25×7・高さ約 38.5・角丸 8）、週 / 月のセグメント（外枠は余白 2.25・角丸 8・地 bg-secondary。1 つ分は余白 13.5×6.75・高さ 36・角丸 6・15.75px。選択中は地 bg・500・小さな影）、絞り込みボタン（ListFilter・31.5px 角。効いているときは右下に高さ 18 の accent の丸いバッジ・11.25px 600）、主ボタン「＋」（accent の地・余白 9×7・角丸 8・Plus 18px。狭い形なので文字は出さない）。
   - トグルの押下中は、枠と字が accent、地が accent-subtle。
2. レンズの行（間 9px）: 「平日の仕事 6」「暮らし 10」の 2 つのチップ（件数は表示中の週に入るアイテムの数）。チップは余白 9×2.25・高さ約 26・完全な円の角・14.625px。選択していないものは枠 border・地 bg・字 text-secondary、件数は text-tertiary の等幅数字。
3. 週ビュー（枠は角丸 6.75・線 border・地 bg。0〜24 時を縦にスクロールし、今の時刻 9:20 が見える位置で開く）
   - 時刻の列 58.5px。時刻のラベルは 14.625px の等幅数字・text-secondary で、線の 6.75px 上・右 4.5px。1 時間の高さは 48px（rem ではなく px のまま）。時刻の線は 1px の border。
   - 見出しの行: 曜日（14.625px 500・大文字・字間広め・text-secondary）と日付（14.625px）の 2 段。余白 4.5×6.75・高さ約 53。今日（10/10 土）は地 hover・字 accent・日付は 600。
   - 終日の行: 左に「終日」（14.625px・text-secondary・右寄せ）。マスは最小 31.5px・余白 4.5。チップは余白 4.5×2.25・角丸 4.5・14.625px・地 bg-secondary・左に 2px の accent の帯。
   - 今日の列は全体の地が accent-subtle。
   - 予定のブロック: 余白 4.5×2.25・角丸 4.5・14.625px・行の高さ詰め・列の左右に 1px の隙間。題は 500、時刻は 14.625px の不透明度 80%。タグが付いたものは、地がタグの色に変わり、字はその上で読める色。タグの無い予定は枠 schedule-event-border・地 schedule-event-bg・字 chip-event-fg。
   - 繰り返しのブロック: 地 schedule-routine-bg・字 chip-routine-fg・左の余白 6.75。左端に幅 3px の帯（タグなしは chip-routine-dot、タグありは字の色の 60%）。題の前に Repeat のアイコン（16.2px・線の太さ 2.5）。
   - Todo のブロック: 地 schedule-task-bg・字 chip-task-fg・枠なし。題の前に CheckSquare（16.2px・線 2.5）。完了は取り消し線と不透明度 55%。
   - 下端に高さ 6.75px の伸縮のつまみ。
   - 今の時刻の線: 2px の accent の線と、左端に直径 9px の accent の点。今日の列にだけ引く。
4. 詳細パネル（見出し「詳細」の行は高さ 54・左 18・右 13.5・15.75px 600・下に線。中身の余白 13.5）
   - タブ「今日の流れ / Todo / 繰り返し」: 週 / 月と同じ形のセグメントで、1 つ分は余白 6.75・高さ約 33・14.625px・折り返さない。タブと中身の間 13.5。1 回目は「今日の流れ」を選んだ状態。
   - 今日の流れ: 日付「10月10日(土)」（14.625px・text-secondary）。行は最小 42px・上下 4.5・左 4.5・間 9・下に線。時刻の列は幅 49.5・14.625px、点は直径 6.75、題は 15.75px。終日の行は時刻の代わりに「終日」の丸いラベル（余白 6.75×2.25・14.625px 600・text-tertiary・枠 border-strong）。今の時刻の位置に区切り（上下 6.75・時刻「9:20」は 14.625px 700 accent・2px の accent の線）。
   - その下に「マイルーチン」のカード（余白 18・間 13.5・角丸 6.75・地 bg-secondary・線 border）。題は 15.75px 600、行は上下 9 で下に線。行は題と、右寄せの頻度と時刻。最後に「「繰り返し」タブを開く →」（accent の字）。
   - Todo タブ: 右上に絞り込みボタン（36px 角・角丸 8）。「本日分の Todo」と「その他の Todo」の 2 つの一覧（間 18）。見出しの行は最小 31.5・14.625px 600・text-secondary で、右に accent の「＋本日分に追加」「＋Todo」（余白 15.75×6.75・高さ約 35・角丸 9・14.625px 500・小さな影）。行は最小 38px で、左に丸いチェックボックス（当たり判定 49.5・アイコン 20）、題 15.75px、時刻 14.625px、右に削除（27px 角・ホバーで出る）。
   - 繰り返しタブ: 行の間 6.75。行は角丸 8・地 bg・線 border。中は余白 13.5×9・間 9、左に Repeat のアイコン、題 15.75px 500、その下に頻度と時刻と次の日付 14.625px（例「月・水・金・土 · 20:00 · 10月12日(月)」）、右に削除（余白 6.75・Trash2 18px）。

## Desktop の月ビュー（週 / 月で「月」を選んだとき）

- 枠は角丸 6.75・線 border。曜日の見出しは上下 4.5・14.625px 500・text-secondary。
- マスは最小 184.5px・余白 4.5・中の間 2.25・右と下に線。ほかの月の日は不透明度 40%。
- 日付は高さ 22.5 の丸いバッジ・14.625px 600。今日だけ地 accent・字 on-accent（マスの地は変えない）。
- チップは余白 4.5×2.25・高さ約 24・角丸 4.5・14.625px 500。1 マスに 5 つまでで、残りは「他 N 件」（14.625px・text-tertiary）。地は種類ごとの chip-event-bg / chip-routine-bg / chip-task-bg で、タグがあればタグの色。点は付けない。
- 期間の表示は「2026年10月」。マスにホバーすると右上に 31.5px 角の「＋」が出る。

## Mobile（月だけ）

- 見出しの入れ物は左右 16・上 13.5・間 13.5。行の中は間 9: 「2026年10月」（15.75px 600）、空き、絞り込み・‹・›（どれも 49.5px 角・角丸 8・線 border-strong・アイコン 18）、[今日]（高さ 49.5・余白 13.5×6.75・15.75px 500・角丸 8）。
- グリッドは画面の端から端まで。上下の線だけで角丸なし。上下の余白 13.5。曜日の見出しは Desktop と同じ。
- マスは最小 99px・余白は上 4.5・左右と下 2.25。日付は 18px の丸いバッジ・11.25px。選んだ日（今日 10/10）は地 bg-secondary と、内側に 2px の accent の輪郭。今日の日付のバッジは地 accent。
- 予定は 1 行に 1 つの題（11.25px 500・行の高さ 14.625・余白 左右 2.25・角丸 4.5・地は Desktop のチップと同じ色の決まり）。1 マスに 4 行まで、右端ははみ出しをぼかして切る。点は付けない。
- Mobile に出さないもの: 週ビュー、祝日と繰り返しのトグル、週 / 月のセグメント、レンズの行、「＋予定を追加」、マスの「＋」。
- 左の引き出し（ハンバーガーか日付のタップで開く）: 幅は画面の 85%（331.5px）、左から出る。地 bg-subsidebar・右に線・大きな影・背後は黒 30% の幕。見出し「詳細」の行（高さ 54）の右に ×（当たり判定 49.5・アイコン 16.2）。タブは Desktop と同じ。日付の右に accent の「＋追加」（高さ 49.5）。中身は Desktop の今日の流れと同じ値で、マイルーチンのカードは出さない。

## 見本のデータ（架空・今日は 2026年10月10日(土) 9:20）

- タグ: 仕事 #2563eb / 健康 #16a34a / 家のこと #f59e0b / 勉強 #8b5cf6 / 旅行 #ec4899。
- 保存したグループ: 平日の仕事（仕事・勉強）/ 暮らし（健康・家のこと・お金）。
- 繰り返し: 朝のストレッチ 毎日 6:30–6:45（健康）/ 英語のオンライン会話 月・水・金・土 20:00–20:30（勉強）/ ゴミ出し（燃える）火・金 7:30–7:40（家のこと。10/9 はスキップ済み）/ 週のふり返り 毎週日曜 21:00–21:30（タグなし）。
- 単発の予定: 10/9 部署の飲み会 19:00–21:00（仕事。20:00 の英語と重なるので列を半分ずつに分ける）/ 10/10 チーム定例 10:00–10:30（仕事）・歯医者 16:00–17:00（健康）・母の誕生日 終日（家のこと）/ 10/12 スポーツの日（祝日）/ 10/13 企画会議 13:00–14:30（仕事）/ 10/14 ジムで筋トレ 19:00–20:00（健康）/ 10/16 友人と夕食 19:30–21:30 / 10/24 金沢旅行 終日（旅行）/ 10/28 健康診断 9:00–11:00（健康）。
- 今日の流れ（10/10）: 終日 母の誕生日 / 6:30 朝のストレッチ（完了）/ ここに今の時刻 9:20 の区切り / 10:00 チーム定例 / 16:00 歯医者 / 20:00 英語のオンライン会話。
- 本日分の Todo: 企画書の構成を決める（完了）/ 競合 3 社の価格を調べる / 部長に企画の方向性を相談する / 企画書の図を 2 枚作る（完了）/ 朝 5km 走る（完了）/ クリーニングを受け取る。
- その他の Todo: 電気代の明細を家計簿に写す / 英単語アプリを 15 分 / 企画書の初稿を読み直す（10/11）/ ランニングシューズを買い替える / 冬物のコートを出す / 旅行の宿を比べる。

## 状態（試作パネルか、フレームを分けて見せてください）

- データあり: 上の見本のとおり。
- 空: グリッドは線と時刻だけで、文言は出さない。今日の流れは「今日の予定はありません」（上下 27・中央寄せ・15.75px）、Todo は「本日分の Todo はまだありません」「その他の Todo はありません」（14.625px）、繰り返しとマイルーチンは「ルーチンはまだありません」。
- 読み込み中: グリッドの代わりに「読み込み中…」だけの箱（余白 18×45・15.75px・角丸 6.75・地 bg-secondary・線 border）。骨組みの表示は使わない。
- エラー: 同じ箱に「予定を読み込めませんでした」と「再試行」のボタン。予定が一部だけ出ている場合は、グリッドの上に帯（余白 13.5×9・14.625px）と「再試行」。

最後に、再現できなかったところと、推測で埋めたところの一覧を返してください。
```

## 6. 2 回目以降の直しのプロンプト

型（`_TEMPLATE-reproduce.md` §6）の枠を使います。この画面で先に見るとよい場所は次のとおりです。

- **ツールバーの狭い形**: Claude Design は 1440 幅を見て文字付きのボタンで組みがちです。狭い形（アイコンだけ・間 6.75）になっているかを最初に見ます。
- **1 時間の 48px**: ほかの値が rem なのに、ここだけ px です。rem にされると、ルートの文字サイズを変えたときに合わなくなります。
- **アイコンの 16.2px の下限**: 小さい指定のアイコンが 13.5px のまま描かれていないかを見ます。
- **Mobile の 49.5px**: 44px で組まれていないかを見ます。

## 7. 比べる手順とずれの表

型の §7 の手順で比べます。表は Issue #2153 にコメントします。

## 8. 回の記録

| 回  | 日付 | 送ったもの | 揃った行 / 全行 | 残ったずれ | 効いた書き方・効かなかった書き方 |
| --- | ---- | ---------- | --------------- | ---------- | -------------------------------- |
| 1   |      | §5         |                 |            |                                  |

## 9. 完成条件（指示書そのもの）

- [x] §2 の部品すべてに `file:line` が付いていて、実在する（2026-10-11 に `07ead4ab` で抜き取り確認）。
- [x] §3 の値すべてに出典があり、測れなかった値は「未確認」と書いてある（ツールバーが縮む境の px）。
- [x] §4 に Desktop / Mobile × ライト / ダークの 4 通りがそろっている。
- [x] §5 のプロンプトが自己完結している（リポジトリのパス・「上記参照」が本文に無い）。
- [x] §5 のプロンプトに 4 状態がそろっている。
- [x] frontmatter の Status / Source / Captured が埋まっている。
