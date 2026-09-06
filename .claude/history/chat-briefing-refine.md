# HISTORY (chat-briefing-refine)

### 2026-09-07 - 紙面自身のタップ対象を 44px へ（#1559 PR #1569 open）

#### 概要

#1512 の共有部品ぶん（PR #1556 merged）に続く briefing レーンぶん。390×844 で 44×44 を割っていた紙面上の対象を、Desktop の塗られたサイズを変えずに底上げした。手段は 3 通りではなく **2 通りを対象ごとに選び分ける**形で、選択の軸は「隣にボタンが並んでいるか」と「守るべきレイアウトの約束があるか」。

#### 変更点

- **箱ごと広げた（`max-md:min-h-11 max-md:min-w-11`）**: 夕刊の気分★ 5 個（`EveningView.tsx`・35×35 → 44×44。`MOOD_STAR_BASE` を切り出して filled / empty 両分岐に効かせた）と、Todo / 予定 / 持ち越し行の「編集」「削除」（`BriefingView.tsx` の `ROW_ACTION_BASE`）。どちらも隣にボタンが 6px / 2px しか離れずに並ぶため、不可視の `::after` で伸ばすと**隣の当たり判定に重なる**（「削除」を狙って「編集」が反応する）
- **高さだけ `TAP_TARGET_TALL`（不可視 `::after`）にした**: 紙面見出しの「+」（`BlockHeadAddButton`）。隣にボタンが無く、代わりに `-my-1` が担っている「見出し下の罫線を動かさない」という約束がある。`min-h-11` だと罫線が 18px 下がる。上下 9px のはみ出しは section の `py-5` と `mb-3`（12px）に収まり、下の行の当たり判定まで 3px 余る
- **幅は 4 対象とも箱で広げた**: `::after` を横に伸ばすとブロックの右端の外へ出るため（横スクロールの誘発を避けた）。見出しの「+」と行アクションはどちらもアイコン中心が右端から 22px になり、`-mr-1.5` を外した #1514 が作った「右端に真っ直ぐな列」は保たれる
- **Issue に無い 4 つ目**: `web/src/briefing/BriefingScreen.tsx` のトレイ側「+」。「今日のスケジュールに追加」という同じ名前のボタンが**この画面に 2 つ**あり、トレイ側は #609 で 768px 未満のドロワーからも開けるようになっている。点検が見たのは紙面側だけだったが、片方だけ直すと再点検で同じ所見が上がるので揃えた

#### 承知の上で払ったコスト

行アクションの束が 58px → 90px になり、隣の Todo タイトルが 149px → 117px に縮む。#1514 が取り戻した 77px の一部を戻す形（18 文字の Todo が 2 行 → 3 行になりうる）。文字ラベルは `md` 未満で隠れたままなので効果の大半は残る。「破壊的な削除ボタンが床を割ったまま」より幅を払う方を選んだ。戻すなら `ROW_ACTION_BASE` の `max-md:min-w-11` 1 語を消すだけ。

#### 記録

- **テスト**: `shared/tests/briefingTapTargets.test.tsx` 新規 3 case（`sharedTapTargets.test.tsx` のセクション版）+ `web/tests/briefingNarrowTray.test.tsx` に 1 case。jsdom にレイアウトが無いのでサイズを生むクラス契約を固定する形。各 case が **narrow の床と Desktop の不変の両方**を assert する（DoD の「Desktop 幅のサイズが変わっていないことをテストで固定」）
- **ゲート**: CI verify の 15 ステップ + docs-lint をローカルで同じ順に再現し全緑（shared 300 files / 3011 tests・web 117 files / 1117 tests・desktop / mcp-server も緑）。終了コードは `tail` に通さず変数へ取ってから判定した
- **意図しない差分 1 行**: `BriefingView.tsx` の `lucide-react` import が 6 行 → 1 行。main が prettier 未整形で、編集時のフォーマッタが直したもの。整形のみ
- **環境**: この worktree の Bash は PATH が Windows 形式のまま渡り `cat` / `git` すら見つからない。各コマンドの先頭で `export PATH="/usr/bin:/bin:/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:/c/Program Files/nodejs"` を付けて回避した
- 計画書なし（Issue 直行の軽ティア）。スコープ逸脱は上記の 4 つ目 1 件のみで PR 本文に明記。AC 免除なし。判断キュー新設なし


### 2026-09-06 - 390px の紙面を 2 件直す: ロゴの語中改行と Todo 行のはみ出し（#1513 PR #1537 merged / #1514 PR #1544 open）

#### 概要

#1409 の Mobile 幅（390×844）実ブラウザ点検で出た朝刊まわりの minor 2 件を、それぞれ origin/main 起点の独立ブランチで PR まで通した。どちらも「スタイルの書き間違い」ではなく**既定の折り返し規則が狭い幅で表に出た**もので、原因の層が違う（#1513 = CJK の行分割規則 / #1514 = 負のマージンと常設ラベルの幅争い）。

#### 変更点

- **#1513 / `shared/src/components/briefing/BriefingView.tsx` + `EveningView.tsx`**: マストヘッドの h2 に `break-keep`（`word-break: keep-all`）。CJK は既定で**文字と文字の間ならどこでも改行してよい**ので、行が 1 文字分足りないと最後の切れ目が 夕 と 刊 の間に来ていた。keep-all で文字間の改行候補が消え、残る切れ目は「LIFE EDITOR」と紙面名の間のスペースだけになる（狭 = 2 行・広 = 従来どおり 1 行）。英語紙名は元からスペースでしか折れないので en は不変
- **#1514 / 6px のはみ出し**: 原因は `RowActions` の `-mr-1.5`。「ボタンの余白は見た目の余白なので行の空きに食い込ませる」ための指定だが、**このブロックは左右パディングを持たない**ので行の右端 = ブロックの右端で、食い込む先が無く束が 6px 外へ出ていた（343px の枠に 349px = 点検の実測値そのもの）。`BlockHeadAddButton` が同じマージンを持っていたため 2 つ揃えて外した（片方だけだと「+」が下の操作列より 6px 右にずれる）
- **#1514 / 67px のタイトル**: 「編集」「削除」の文字を `md` 以上でだけ出す（`hidden md:inline`）。2 語で 128px を占めていたのが約 77px 返り、18 文字の Todo が 1 行に収まる。アイコンは単独になる狭幅でだけ 13px → 16px（#410 の「13px の矢印単独は操作だと読めない」が、まさに文字を隠した状態のため）。**文字は DOM に残す** ので読み上げ名（「編集: スケジュールで開く」）は不変 — WCAG 2.5.3 は文字が見えているときだけ効き、2.5.8 の 24×24 はアイコンのみで 28×24 で満たす。幅判定に prop でなく `md:` を使ったのは、この View が純表示でホストから幅をもらわないため（rem 基準なのでフォント倍率と一緒に動くのも、文字が入らないことが原因の規則としては正しい向き）
- **テスト**: shared に 6 本追加（#1513 は 2 本 = 両紙のマストヘッドに規則が載っているか / #1514 は 4 本 = 文字が `md` 以上でだけ出る・読み上げ名は不変・アイコンのサイズ切替・「+」も枠内）。jsdom にレイアウトが無いので折り返しとはみ出しそのものは測らず、原因側の規則を固定した。**既存の #585 テストが `-mr-1.5` の存在を要求していた** — その指定こそが今回のはみ出しなので `not.toContain("-mr-")` に反転し、理由をコメントに残した
- **ゲート**: 両ブランチとも `ci.yml` の `verify` ジョブ全ステップ + `docs-lint` をローカル再現して 15 ステップ全緑（`npm ci` の 4 ステップのみ省略 = node_modules 導入済み）。#1514 の 1 回目は `web — build` が exit 127 で落ちたが**単体では exit 0** で、run 自体が停止された巻き添えと判明したため全ステップ回し直して全緑を確認した
- **記録**: 計画書なし（Issue 直行の軽ティア）。スコープ逸脱なし（触ったのは briefing の 2 View と 1 スイート）。AC 免除なし。44px の当たり判定は Issue 本文の指示どおり別 Issue へ委ねた（狭幅のアイコンのみは 28×24 で、WCAG の 24×24 は満たすが 44px には届かない）— PR 本文に明記済み

### 2026-09-05 - ストリークカードの折り返しと朝刊 Todo チェックボックスの名前（#1467 PR #1492 merged / #1486 PR #1499 merged）

#### 概要

#1408 の実ブラウザ点検で出た朝刊まわりの minor 2 件を、それぞれ origin/main 起点の独立ブランチで PR まで通した。#1467 は詳細パネルのストリークカードで右タイルの label だけが 2 行に折れて数値の縦位置がずれる件。#1486 は「今日のスケジュール」の Todo 行のチェックボックスが自分の行を名乗らない件で、**issue の前提が起票後に半分変わっていた**（role / aria-checked は PR #1449 で既に着地済み・残っていたのは名前だけ）ことを PR 本文に明記した上で残りを閉じた。

#### 変更点

- **#1467 / `shared/src/components/Analytics/StreakDisplay.tsx`**: 単位を label 行から数値行へ移し（`2` + 小さい `days`）、label を 1 語だけにした。4 つの `<p>` すべてに `truncate`。原因は「右タイルが仕切り線を自分の列の中に描いている（`border-l` + `pl-3`）ので 13px 狭い」+「label が空白で折り返せる形だった」の重なりで、後者を構造的に潰した。i18n キーの追加なし（`current` / `longest` / `days` の組み替えのみ）
- **#1467 / テスト**: `shared/tests/streakDisplayTiles.test.tsx` 新規 5 件（label が 1 語か / 単位が数値行か / 4 行すべて `truncate` か / 左右タイルの class が完全一致か / 空表示）。jsdom にレイアウトが無いので折り返しそのものは測らず、折り返しようがない構造を固定した。既存の #993 suite は `getByText("Current (days)")` → `getByText("Current")` に読み替え
- **#1486 / `shared/src/components/TodoStatusCheckbox.tsx`**: 任意の `itemName` を追加し、渡されたら名前を `行の名前 — 設定するもの: 今の状態` の順で組む。opt-in なので持ち越し行・夕刊・予定サイドバーの名前は不変（テストで固定）
- **#1486 / `shared/src/components/briefing/BriefingView.tsx`**: 今日のスケジュールの Todo 行が `itemName={todo.title}` を渡す。タイトルボタンは #1442 が意図して残したマウス用の当たり判定なので手を付けていない
- **ゲート**: 両ブランチとも `ci.yml` の `verify` ジョブ + `docs-lint` を全ステップローカル再現して緑（`npm ci` の 4 ステップのみ省略 = node_modules 導入済み）。#1467 = shared 289 files / 2920・web 113 / 1064・desktop 2 / 30・mcp-server 25 / 322。#1486 = shared 288 / 2920 で他は同数。#1486 の web vitest は 1 回目に `briefingEveningLazyMount` が 1 件落ちたが、キャッシュが温まった 2 回目は全緑（#1449 と同じ既知フレーク）
- **記録**: 計画書なし（Issue 直行の軽ティア）。スコープ逸脱なし。AC 免除なし。実装中に浮上した判断 1 件は**実装せず報告に回した**（P-008 = 朝刊 Todo 行のタイトルボタンを外す / `aria-hidden` にするか。クリックできる範囲が変わる設計変更のため）。持ち越し行・夕刊の残 Todo も同じ「名前が状態だけ」の状態で、`itemName` を渡せば 1 行ずつ追随できる点も報告に回した

### 2026-09-01 - 朝刊「今日のスケジュール」の Todo 行に時刻を出す（#1369・PR #1382 open）

#### 概要

Todo 行だけ時刻欄が空で、9:30 に置いた Todo と「今日のどこかで」の Todo が紙面上まったく同じに見えていた。原因は View ではなくデータ側で、`useBriefingAggregation` が `BriefingTodoEntry` を組み立てるときに `scheduledAt` の時刻を捨てていた（View は時刻欄を「必ず空のスペーサー」として描く実装）。時刻の供給を足し、View の時刻欄をイベント行と共用の 1 コンポーネントに統合した。

#### 変更点

- **`shared/src/components/briefing/BriefingView.tsx`**: `BriefingTodoEntry.startTime` を追加。時刻欄を `TimeCell` に切り出し、イベント行と Todo 行が同じ幅・同じ文字スタイルを共有する形にした（空ラベル → 従来どおり `aria-hidden` のスペーサー）
- **`web/src/briefing/hooks/useBriefingAggregation.ts`**: `todoScheduleSlot`（カレンダーのチップと Today トレイと同じ selector）から HH:MM を取る。壊れた instant と潰れた span（#562）は selector 側で all-day に畳まれるため紙面に不正値が出る経路が無い。all-day の `"00:00"` はグリッドの置き値なので**あえて出さず** `""` を渡す
- **並び順は不変**: todos → 区切り線 → 終日 → 時刻付き（#939）。時刻付き Todo も Todo 帯に留まる — 時刻はラベルであって時刻付き帯への昇格ではない、という読み方を DOM 順のテストで固定
- **テスト**: shared 4 本（同一クラスの欄に HH:MM / 時刻なしは空・aria-hidden・「終日」を出さない / 終日イベントのラベル不変 / #939 の行順）・web 2 本（timed は 09:30・all-day と潰れた span は `""` / JST で `00:30Z` → `09:30`）
- **ゲート**: CI verify を全ステップローカル再現し全緑（shared 2793 / web 1005 / desktop 29 / mcp-server 322・docs-lint OK）
- **記録**: 計画書なし（Issue 直行の軽ティア）。スコープ逸脱なし（触ったのは briefing の View と web の hook、およびその 2 スイート）。AC 免除なし。「時刻なし Todo に『終日』と出すか」は Issue 本文の「今まで通り終日扱い」を現状維持と読んで空欄据え置き — PR 本文に明記済みで、変えるならレビューで指摘が来る形にした

### 2026-08-23 - MCP write_briefing の focus を note-focus へ配線（#1097・PR #1107 merged）

#### 概要

#1048 の follow-up。朝刊のフォーカス行は `note-focus` の日付キー付きセクションから読まれるのに、MCP `write_briefing` は focus を Daily の朝刊セクション先頭段落に書き続けており、AI コメントの 1 段落目として表示される意味ズレが起きていた。Issue の B 案（focus を note-focus へ配線し直す — MCP から朝の宣言を書ける導線が残る）を採り、focus → フォーカスノートの当日セクション / paragraphs → Daily の朝刊セクション、と書き先を読み側の現契約に一致させた。

#### 変更点

- **`mcp-server/src/utils/focusSection.ts` 新規**: フォーカスノートのセクションマージ書き込み（shared `focusSections.ts` の write half）。他日の履歴・ノート側の前置きを保持し、unparseable な既存本文は `briefingSection.ts` と同じく throw で拒否
- **`writeBriefing` ハンドラ**: focus → `note-focus`（初回保存で作成・ゴミ箱なら書き込み時に復元・byte-identical マージは LWW bump ごとスキップ）、paragraphs → Daily 朝刊。paragraphs が空なら Daily に一切触れない（見出しだけのセクションは extractBriefing に不可視）
- **`buildBriefingSectionNodes` / `upsertBriefingSection`**: focus 引数を撤去し paragraphs 専用に。tool description も実際の書き先へ全面更新（`focus` は required のまま）
- **テスト**: `focusSection.test.ts`（shared `extractFocus` との round-trip + FOCUS_NOTE_ID 一致 pin）/ `writeBriefingHandler.test.ts`（recorder stub でルーティング pin: focus は notes_payload・paragraphs は dailies_payload・双方 items_meta bump・no-op スキップ）/ `briefingSection.test.ts` を paragraphs-only 契約へ更新
- **ゲート**: CI verify 全ステップをローカル再現し全緑（shared 2503 / web 705 / desktop 7 / mcp-server 318・docs-lint OK）
- **記録**: 計画書なし（Issue 直行の軽ティア）。スコープ逸脱なし（触ったのは mcp-server のみ）。AC 免除なし。A/B は Issue 側の比較提示 + ゴール指定の委任で B を自裁 — 判断キュー新設なし

### 2026-08-18 - フォーカスを夕刊入力へ移設 + Daily に夕刊カテゴリを新設（#1048 PR #1062 / #1046 PR #1068・ともに open）

#### 概要

/goal で briefing レーンの 2 Issue を PR open まで一気通貫。#1048 は朝刊の「今日のフォーカス」を Daily 参照（朝刊セクション先頭段落）から外し、夕刊の入力欄 →予約ノート `note-focus`（日付キー付きセクション・#872 の目標ノート方式）→ 翌朝表示の流れに変えた。#1046 は Daily 本文の下に「夕刊カテゴリ」カード（気分★ / 振り返り / その日のスケジュール）を新設し、夕刊の記録を本文エディタから分離した — 保存表現は従来の「夕刊」セクションのままで **DDL ゼロ・既存データ無変換**（移行方針は Issue body に追記済み）。どちらも origin/main 起点の独立ブランチで、CI verify 全ステップ + docs-lint をローカル全緑にしてから push した。

#### 変更点

- **#1048（PR #1062）**: shared `focusSections.ts` 新規（merge/extract・履歴保持）・`extractBriefing` は全段落を AI コメント化・`EveningView` に「明日のフォーカス」欄・web `useFocusNote.ts` 新規（draft/echo/失敗 Toast）・i18n で `noBriefing` → `noFocus`。mcp `write_briefing` は温存（follow-up 起票依頼を outbox へ・文言判断は D-20260818-briefing-1 としてキューへ）
- **#1046（PR #1068）**: shared `stripEveningSection` / `eveningBodyLines` / `DailyEveningCard.tsx` 新規・web `DailyView` が夕刊抜き本文をマウントし保存時に `mergeEveningSection` で付け直す（本文編集が夕刊を落とせない）・`useDayScheduleSummary.ts` 新規（schedule ドメイン追従）
- **テスト**: shared +22 本（focusSections 11 / strip・lines 6 / DailyEveningCard 5）・web +7 本（briefingFocus 4 / dailyView 3）・mcp round-trip を新契約に追随
