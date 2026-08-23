# モバイル体感速度の実測レポート（#797）

- **日付**: 2026-08-13
- **ブランチ**: `claude/mobile-797-perf-measurement`（base = `origin/main` @ `e132a86a` 時点の main）
- **担当チャット**: mobile-refine
- **成果物の性格**: 調査のみ。本 PR に計装コード・修正は含まない（Issue #797 Scope 準拠）

---

## 0. 結論（優先度順・3 件）

| #   | 候補                                                                                                                     | 実測の根拠 | 修正の効き（実測）                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | **初回ロードが 2.06 MB（gzip 576 KB）で、`lazy()` が全 JS の 8.8% しか外せていない**                                     | §1         | 4 ファイル + config で **gzip −39.4%**（576 KB → 349 KB）／さらに 6 画面 lazy まで踏み込むと **−52.2%**（→ 275 KB） |
| 2   | **長いリストに仮想化が一切なく、行ごとに @dnd-kit の hook が登録される。ノートはタグ数だけ重複描画される**               | §4         | 未計測（仮想化の導入コストは別途見積もりが要る）                                                                    |
| 3   | **`timer_sessions` を消費者なしで購読しており、ポモドーロの start/close ごとに timer ドメインが bump → REST 2 本が走る** | §3         | 未計測（購読を外すだけなので低コストと見込まれるが、数値は未取得）                                                  |

補足として、**候補 1 は「原因が特定できた」ものであり、候補 2・3 は「構造上の負荷源を静的に特定した」段階**です。候補 2・3 が体感の重さにどれだけ寄与しているかは、実ブラウザでの計測（§6）が要ります。

---

## 1. 初期ロード — バンドルと chunk 分割の実態

### 1.1 計測方法

`cd web && npm run build`（vite 8.0.13 / rolldown, 4612 modules, 11.96 s）。
「初回ダウンロード対象」の定義は **`dist/index.html` が参照する JS**、すなわち entry の `<script type="module">` と `<link rel="modulepreload">` の集合（= entry の静的 import グラフ）。動的 import された chunk はここに現れない。
gzip 値はすべて `gzip -c <file> | wc -c`（level 6）で自前計測。vite のログが出す gzip 値とは圧縮レベル差で数 KB ずれるため、本レポート内は自前計測値で統一する。

### 1.2 実測値 — 初回ダウンロードされる JS

| chunk                          |       raw (B) |    gzip (B) |
| ------------------------------ | ------------: | ----------: |
| `index-BmupbwIq.js`            |     1,443,275 |     384,708 |
| `editor-BJ8Vw4d5.js`           |       356,778 |     111,087 |
| `react-vendor-BKwyXVfw.js`     |       196,114 |      60,881 |
| `dnd-B-Hed8W7.js`              |        59,415 |      19,330 |
| `rolldown-runtime-S-ySWqyJ.js` |           694 |         452 |
| **JS 合計**                    | **2,056,276** | **576,458** |
| （参考）`index-EyYgRFm8.css`   |        66,950 |      12,720 |

**遅延ロードされている（初回に落ちてこない）のは 3 chunk だけ**:

| chunk                         |     raw (B) |   gzip (B) |
| ----------------------------- | ----------: | ---------: |
| `ConnectScreen-CuCnbXTo.js`   |     101,340 |     29,830 |
| `AnalyticsScreen-CYwi7gYd.js` |      60,070 |     16,170 |
| `NotesView-BtA7WCHi.js`       |      36,780 |     10,210 |
| **合計**                      | **198,190** | **56,210** |

→ **全 JS 2,254,466 B のうち `lazy()` が外せているのは 198,190 B = 8.8%**。
`web/src/lazySections.ts` のコメントは「those bundles out of the first download」を狙うと書いているが、狙いは達成できていない。

### 1.3 なぜ効いていないか（原因を 2 本特定）

**(a) TipTap（`editor` chunk = 356,778 B / gzip 111,087 B）が初回に preload される**

`dist/index.html` に `<link rel="modulepreload" href="/assets/editor-BJ8Vw4d5.js">` が出る。原因は、`lazy()` されていない 3 画面が `RichTextEditor` を静的 import していること:

- `web/src/briefing/BriefingScreen.tsx:22`
- `web/src/daily/DailyView.tsx:43`
- `web/src/todos/KanbanView.tsx:69`

この 3 画面は `web/src/sectionDescriptors.tsx:14-19` で静的 import されている（`BriefingScreen` は :16、`DailyView` は :15、`KanbanView` は `ScheduleScreen` :17 経由）。
`NotesView` を `lazy()` にしても、同じ TipTap を別の 3 経路が eager に引いているため、初回ダウンロードから出ていかない。

**(b) recharts（245,262 B / gzip 62,975 B）が eager な `index` chunk の中にいる**

検証: 本番 chunk を直接 grep すると、`recharts-wrapper` / `recharts-surface` の marker が `index-BmupbwIq.js` に 1 件ずつ出て、`AnalyticsScreen-CYwi7gYd.js` には 0 件。つまり recharts は lazy 側ではなく eager 側にいる。

経路は Briefing → Analytics ウィジェット:

- `web/src/sectionDescriptors.tsx:16`（eager）→ `BriefingScreen`
- `shared/src/components/briefing/BriefingView.tsx:17-24` が `Analytics/TaskCompletionTrend` と `Analytics/WorkBreakBalance` を**値として** import
- `shared/src/components/Analytics/WorkBreakBalance.tsx:2-11` が `recharts` を import

`shared/package.json:7` の `sideEffects` 設定（#676 で入ったもの）は正しく効いており、barrel 経由の巻き込みは起きていない。これは barrel の問題ではなく、**Briefing が実際に Analytics のグラフ 2 枚を画面に出しているという実装どおりの依存**である。

### 1.4 修正の効きを実測（一時パッチ → 計測 → 破棄）

2 通りの修正案 × `vite.config.ts` の `manualChunks` の有無で 6 通りビルドした。**いずれの一時変更も計測後に破棄済み**（`git status` で確認）。

- **案 A（最小修正・4 ファイル）**: §1.3 で特定した 2 本の辺だけを切る。`RichTextEditor` を `lazy()` 越しにして 3 画面の静的 import を外し、`BriefingView` が使う Analytics ウィジェット 3 つ（StreakDisplay / TaskCompletionTrend / WorkBreakBalance）も `lazy()` にする。**画面は 1 つも lazy にしない**
- **案 B（全画面 lazy）**: 案 A に加えて `sectionDescriptors.tsx` の残り 6 画面（Trash / Daily / Briefing / Schedule / Settings / Work）を `lazy()` にする

| 条件                               | eager JS raw (B) | eager JS gzip (B) | 現状比 (gzip) |
| ---------------------------------- | ---------------: | ----------------: | ------------: |
| 現状                               |        2,056,276 |           576,458 |             — |
| 現状コード + manualChunks 撤去のみ |        2,059,000 |           576,928 |     **+0.1%** |
| 案 A + manualChunks あり           |        1,672,979 |           465,751 |        −19.2% |
| **案 A + manualChunks 撤去**       |    **1,299,667** |       **349,361** |    **−39.4%** |
| 案 B + manualChunks あり           |        1,422,144 |           408,436 |        −29.1% |
| **案 B + manualChunks 撤去**       |      **999,713** |       **275,373** |    **−52.2%** |

読み取れること 3 点:

1. **`manualChunks` は単体では無意味**（+0.1%）。同じバイト列をファイルに切り分けているだけで、初回ダウンロード量は変わらない。
2. **ただし修正を入れた後は `manualChunks` が邪魔になる**。案 A で recharts と ProseMirror は eager な `index` chunk から消える（marker grep で 0 件を確認）のに、`manualChunks` を残すと `editor` chunk（356,778 B）は `modulepreload` に居座ったままで、差分は gzip 116,390 B。名前付き vendor chunk は、その一部でも静的到達可能なら chunk ごと entry の静的 import に昇格するため。
   → **修正は「`lazy()` 化」と「`manualChunks` 見直し」をセットで行わないと、取れる効果の半分を落とす。**
3. **費用対効果は案 A が良い**。案 A（4 ファイル + config）で −39.4%、案 B（さらに 6 画面 lazy）で −52.2%。差の 12.8 ポイントを取りに行くかは別途判断でよく、**まず案 A を入れるのが素直**。なお案 B は着地セクションが Suspense の待ち表示から始まることになるので、その体感トレードオフも併せて判断が要る。

### 1.5 依存パッケージ別の内訳（上限値）

`node_modules` の 1 パッケージ = 1 chunk に強制した計測用ビルドで取得。**パッケージ内の 1 モジュールでも静的到達可能だと chunk 全体が計上されるため、各行は「そのパッケージがグラフに載せている総量」= 上限値**として読むこと。

| パッケージ             | raw (B) | gzip (B) |
| ---------------------- | ------: | -------: |
| lucide-react           | 480,528 |  126,260 |
| @tiptap/core           | 274,797 |   83,007 |
| recharts               | 245,262 |   62,975 |
| react-dom              | 178,381 |   55,560 |
| @dnd-kit/core          |  45,129 |   14,613 |
| i18next                |  43,075 |   13,528 |
| d3-scale               |  28,621 |    8,802 |
| @reduxjs/toolkit       |  25,564 |    9,715 |
| @tiptap/extension-link |  24,072 |   12,007 |

`lucide-react` が単独最大（gzip 126 KB）。namespace import（`import * as`）は 0 件で、97 ファイルすべて named import なので tree-shaking 自体は効いている——それでもこの量になるのは、アプリ全体で使っているアイコン種別が単に多いため。**アイコンだけで gzip 126 KB という数字は、候補 1 の修正 Issue で「eager 側が本当に必要としているアイコンはどれだけか」を別途詰める価値がある**（本調査では eager / lazy の内訳までは分離できていない = 未計測）。

---

## 2. ランタイム — 再レンダリング回数

**回数そのものは未計測。** React DevTools Profiler は実ブラウザが要り、playwright MCP と dev server は chat-main 専用（CLAUDE.md §7.4）のため、この worktree からは実行できない。

代わりに、再レンダリング爆発の典型パターンを静的に走査した結果を記録する（**いずれも「問題なし」側の結論**なので、候補には挙げていない）:

- **Provider の value 識別子の使い捨て**: `.Provider value={{ ... }}` のインライン литерал は **0 件**。`shared/src` の 17 Provider すべてが `useMemo` 済み。
- **Sync bump で全 consumer が起きる問題**: 解消済み。`shared/src/context/SyncContext.tsx:118-149` でカウンタを Provider state ではなく外部ストア（ref + listener）に置き、`useSyncDomains` が `useSyncExternalStore` で数値スナップショットを読むため、無関係ドメインの変更では consumer が起きない（#676 (d)）。
- **Timer の 1 秒 tick が全画面を再描画する問題**: 発生しない。`shared/src/context/TimerContext.tsx:126-130` の `setInterval` は Provider 自身を再レンダリングするが、`children` は props として渡された同一要素なので配下は再レンダリングされない。tick のコストは `useTimerContext` の consumer（NavTimerStatus / WorkScreen）に限定される。

→ **Provider 鎖の上位が更新されて全体が再描画される、という仮説は静的には裏付けが取れなかった。** 実測での確認は §6 に送る。

---

## 3. データ取得 — Realtime の再取得

### 3.1 #499 の再発（読み取りメソッド内の書き込み）: **再発なし**

`shared/src/services/*.ts` の `fetch* / get* / load* / list* / read*` メソッド本体に書き込み呼び出しがあるものを走査した結果、ヒットは 1 件のみ:

- `shared/src/services/SupabaseTimerService.ts:71` — `fetchTimerSettings` 内の `.upsert({ id: 1 }, { ignoreDuplicates: true })`

ただしこれは **`:59` の `if (existing) return rowToTimerSettings(existing);` で早期 return されるため、行が存在する 2 回目以降は upsert に到達しない**。#499 の「ノート編集のたびに `timer_settings` へ POST」は再発していない。

### 3.2 消費者のいない購読が bump を生んでいる（候補 3）

`shared/src/context/SyncContext.tsx:69-95` の `REALTIME_TABLES` は 19 テーブルを 1 チャンネルで購読している。うち `timer_sessions` は **書き込みが多い**（`shared/src/context/TimerContext.tsx:133-155` の `startSession` / `closeSession` が start・pause・reset・phase 終了ごとに 1 行 insert / update する）にもかかわらず、**その変更を読む consumer が存在しない**。SyncContext.tsx:61-65 のコメント自身が「currently have no consumer」と認めている。

結果として、ポモドーロ稼働中は start/close のたびに Realtime のエコーが返り、`timer` ドメインのカウンタが上がり、`TimerContext.tsx:88-123` の 2 本の effect（`fetchTimerSettings` + `fetchPomodoroPresets`）が再実行される。**設定は変わっていないのに REST 2 本**が走る。

- 300 ms の debounce（`SyncContext.tsx:97`）はバースト時のみ効くため、start と close のように時間の離れたイベントは別々に bump する。
- **1 セッションあたりの実 REST 回数は未計測**（ネットワークパネルが要る）。上記は経路の特定まで。

### 3.3 ドメイン割り当ての取りこぼし: **なし**

`REALTIME_TABLES`（19 件）と `syncDomains.ts:63-83` の `TABLE_DOMAIN`（18 件）+ role ルーティング対象の `items_meta`（`syncDomains.ts:49-55`）で全件が写像されており、どのテーブルも「どのドメインにも属さない = 無言の stale」にはなっていない。lockstep テストも存在する（`syncDomains.test.ts` / `syncRealtimeTables.test.ts`）。

---

## 4. 描画 — 仮想化と fixed 要素

### 4.1 仮想化ライブラリは 0（候補 2）

`react-window` / `react-virtualized` / `@tanstack/react-virtual` のいずれも `shared/package.json` / `web/package.json` に**存在しない**。自前の windowing 実装も見つからない。行数の上限・`slice` によるカットも、リスト描画側には無い（`shared/src/components/Kanban/KanbanCard.tsx:78` の `tags.slice(0, MAX_TAG_CHIPS)` は 1 カード内のタグチップ数の制限であって、行数の制限ではない）。

→ **アイテム数 N に対して DOM 行 N 個をそのまま描く。** モバイルの狭い画面では可視行が 5〜10 行程度なので、N が数百に育つと描画・スクロールのコストがそのまま体感に出る。

### 4.2 行ごとに @dnd-kit の hook が登録される

さらに、行は「ただの DOM」ではなく dnd の登録単位になっている:

- `web/src/notes/NoteListRows.tsx:48` — ノート行ごとに `useDraggable`
- `web/src/notes/NoteListRows.tsx:158` — タグ見出しごとに `useDroppable`
- `web/src/todos/KanbanCardDraggable.tsx:28` — カードごとに `useSortable`
- `web/src/todos/KanbanColumnDroppable.tsx:36,40` — 列ごとに `useDroppable` + `SortableContext`

N 行 = N 個の dnd 登録であり、DndContext 側は登録の集合を保持する。行を増やすほど登録コストとドラッグ中の再計算が増える。

### 4.3 ノート行はタグ数だけ重複描画される

`web/src/notes/NoteListRows.tsx:46-47` のコメントが明示している——**"the same note renders under every tag heading it has"**。つまり描画行数は「ノート数」ではなく **ノート数 × 平均タグ数**。タグを多く付ける運用ほど行数が乗算で膨らむ。

- **実際の行数・DOM ノード数・スクロール時のフレーム落ちは未計測**（実データと実ブラウザが要る）。

### 4.4 `fixed` 要素とスクロールの相互作用: 明らかな問題は見つからず

`fixed` を使っているのは 7 箇所で、いずれもオーバーレイ（モーダル / ドロワー / ボトムシート / ポップオーバー / ツールチップ）であり、**スクロールコンテナと重なって毎フレーム再合成を強いる常設の `fixed` ヘッダー / フッターは無い**:

`shared/src/components/BottomSheet.tsx:71` / `MobileDrawer.tsx:53` / `Modal.tsx:54` / `CommandPalette.tsx:228` / `itemActions/ItemActionPopover.tsx:127` / `Analytics/WorkTimeHeatmap.tsx:148` / `web/src/notes/NotePasswordDialog.tsx:118`

ただし `WorkTimeHeatmap.tsx:148` のツールチップだけは `fixed` + マウス追従なので、**スクロール中の合成コストは実測しないと判定できない**（Analytics 画面限定・モバイルの主要導線ではないため候補には挙げない）。

---

## 5. 実機の条件差（低速回線・低性能端末）

**未計測。** Chrome DevTools の throttling も実ブラウザが要り、この worktree からは実行できない（CLAUDE.md §7.4）。

参考として、§1.2 の実測バイト数からの**単純な割り算**（計測ではない）を挙げておく。DevTools の "Slow 4G" プリセット（下り約 1.6 Mbit/s ≒ 200 KB/s）を仮定すると:

- 現状: JS 576 KB + CSS 13 KB = 589 KB gzip → **ダウンロードだけで約 2.9 秒**
- §1.4 の修正後: 275 KB + 13 KB = 288 KB gzip → **約 1.4 秒**

**JS のパース・コンパイル時間、実機の初回描画までの ms は未計測。** バイト数が減れば速くなる方向であることは確かだが、体感がどれだけ改善するかはこの数字からは言えない。

---

## 6. 未計測の項目と、それを埋めるのに必要なもの

> **2026-08-19 追記: 本節の 6 項目はすべて計測済み。実測値は §8 を参照。**

| 観点               | 未計測の中身                                       | 必要なもの                           |
| ------------------ | -------------------------------------------------- | ------------------------------------ |
| ランタイム（§2）   | 実際の再レンダリング回数・コミット時間             | 実ブラウザ + React DevTools Profiler |
| データ取得（§3.2） | 1 ポモドーロあたりの実 REST 回数                   | 実ブラウザ + Network パネル          |
| 描画（§4）         | 実データでの行数 / DOM ノード数 / スクロールの FPS | 実ブラウザ + 実データ                |
| 描画（§4.4）       | 追従ツールチップの合成コスト                       | 実ブラウザ + Performance パネル      |
| 実機条件（§5）     | throttling 下の LCP / TTI、パース時間              | 実ブラウザ + throttling              |
| 初期ロード（§1.5） | lucide-react の eager / lazy 内訳                  | chunk 単位のモジュール帰属出力       |

これらは **chat-main（playwright MCP + dev server を持つ唯一のレーン）に引き継ぐ**のが筋（→ #994 として起票され、2026-08-19 に §8 で完了）。本レポートは静的計測とビルド計測で取れる範囲を確定させ、実ブラウザ計測の的を絞ることを役割とする。

---

## 7. 起票を依頼する修正 Issue（`.claude/comm/outbox/chat-mobile-refine.md` へ append 済み）

1. **[perf] 初回ロードの eager JS を減らす — `RichTextEditor` と Briefing のグラフ 3 枚を `lazy()` 化 + `manualChunks` 見直し**（§1。案 A = 4 ファイル + config で実測 gzip −39.4%。案 B まで踏み込めば −52.2%）
2. **[perf] 長いリストの仮想化と、行あたり dnd 登録の削減**（§4。ノート行のタグ重複描画を含む）
3. **[perf] 消費者のいない `timer_sessions` 購読を外す**（§3.2）
4. **[measure] chat-main による実ブラウザ計測**（§6 の 6 項目）

---

## 8. 実ブラウザ計測（#994 / chat-main・2026-08-19）

**担当チャット**: chat-main（playwright MCP + dev server を持つ唯一のレーン）。§6 の未計測 6 項目をすべて埋めた。

### 8.0 計測環境

| 項目           | 内容                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| ブラウザ       | playwright MCP の Chromium（CDP 直叩き）                                                                 |
| ビルド         | 初期ロード系（§8.5 / §8.6）= `vite build` の本番成果物を `vite preview`（:4173）／ランタイム系 = dev サーバー（:5173） |
| ビューポート   | 390 × 844（モバイル既定）。Analytics だけモバイル nav に無いため 1440 × 900                             |
| データ         | 作者本人の実 Supabase プロジェクト（実データ・実ログイン）                                              |
| 再レンダリング | `__REACT_DEVTOOLS_GLOBAL_HOOK__` の shim を `addInitScript` で先に差し込み、`onCommitFiberRoot` で commit 回数と `actualDuration` を集計 |

**dev / prod の使い分け**: React は本番ビルドで `actualDuration` を記録しないため、**コミット時間は dev ビルドの値**（実機より遅い側に出る）。**commit 回数は dev / prod で同じ**なので、こちらを主指標として読む。

### 8.1 再レンダリング回数・コミット時間（§6 表 1 行目）

| 操作                             | commit 回数         | actualDuration 合計（dev） |
| -------------------------------- | ------------------- | -------------------------- |
| 初回ロード（390 × 844）          | 14                  | 46.6 ms                    |
| セクション切替 → Schedule        | 9                   | 164.5 ms                   |
| セクション切替 → Materials       | 7                   | 12.2 ms                    |
| セクション切替 → Work            | 3                   | 13.4 ms                    |
| ポモドーロ実行中（60 秒間）      | 63（= 62.9 回/分）  | —                          |
| ヒートマップの hover 1 セル      | 1                   | 5.72 ms                    |

読みどころは 2 つ。**Schedule だけ 164.5 ms と桁が違う**（Materials の 13 倍）ので、セクション切替の体感差はここに集中している（#1101 の stale-while-revalidate が効く対象）。もう 1 つは**タイマー実行中の 1 秒 1 commit**で、30 分のポモドーロなら約 1,890 commit になる。ただし 1 commit あたりは軽く、フレーム落ちは観測されなかった（§8.4）。

### 8.2 1 ポモドーロあたりの実 REST 回数（§6 表 2 行目）

**結論: 約 6 本。ポモドーロの長さには比例しない。**

60 秒間タイマーを回して `fetch` を全数記録した結果:

| 時刻      | メソッド | エンドポイント           |
| --------- | -------- | ------------------------ |
| +249 ms   | POST     | `/rest/v1/items_meta`    |
| +338 ms   | POST     | `/rest/v1/tasks_payload` |
| +445 ms   | POST     | `/rest/v1/timer_sessions`|
| +1,058 ms | HEAD     | `/rest/v1/items_meta`    |
| （開始直後）| GET     | `/auth/v1/user`          |
| +60,100 ms| PATCH    | `/rest/v1/timer_sessions`（停止時） |

**開始から 1.1 秒以内に 5 本が集中し、残りの 59 秒は REST 0 本**。つまり「1 分あたり 5 本 → 30 分で 150 本」という線形外挿は誤りで、実体は**開始時の定数コスト + 停止時 1 本**。§0 候補 3（`timer_sessions` の購読）が REST 本数として体感に効いているという想定は、**この経路では裏付けられなかった**。

### 8.3 実データでの行数 / DOM ノード数 / スクロール FPS（§6 表 3 行目）

**結論: スクロール FPS は測れなかった。実データが小さすぎて、モバイル幅でスクロールできるリストが 1 つも存在しない。**

計測時点の実データ: ノート 5 / Daily 3 / Todo 4 / Event 0 / タグ 2。

| セクション | 幅     | DOM ノード数 |
| ---------- | ------ | ------------ |
| Briefing   | 390px  | 158          |
| Schedule   | 390px  | 341          |
| Materials  | 390px  | 103          |
| Work       | 390px  | 123          |
| Analytics  | 1440px | 979          |

`scrollHeight > clientHeight` を満たす要素を全走査しても該当なし。**#992（長いリストの仮想化）は、今日の実データでは再現しない**。#994 の DoD は本計測を #992 の着手条件としているので、判断材料としてはこうなる — 仮想化は「今の体感を直す施策」ではなく「データが増えた後に効く先行投資」であり、着手するなら合成データで閾値（何行から破綻するか）を先に決めるのが筋。

### 8.4 追従ツールチップの合成コスト（§6 表 4 行目）

**結論: 実害なし。加えて、Issue の前提（マウス追従）自体が実装と違っていた。**

`WorkTimeHeatmap.tsx:116-124` の更新契機は `onMouseEnter` / `onMouseLeave` で、**マウス移動には追従しない**（セル単位で 1 回）。セル数は 7 × 24 = 168。

24 セルを順に hover した実測:

- commit 24 回（= 1 hover につき 1 commit・予想どおりヒートマップ全体が再描画される）
- 1 commit 5.72 ms（dev ビルド）
- フレーム間隔: 中央値 16.7 ms / p95 16.8 ms / 最大 17.6 ms → **60 fps を維持、フレーム落ちなし**

`position: fixed` + `left/top` 直指定なので合成だけでなくレイアウトも走るが、168 セル程度では 16.7 ms の予算に収まっている。**修正不要**。

### 8.5 throttling 下の LCP / TTI とパース時間（§6 表 5 行目）

本番ビルド・キャッシュ無効・390 × 844・ログイン済み。

| 指標                    | throttling なし | Slow 4G + CPU 4x |
| ----------------------- | --------------- | ---------------- |
| FCP                     | 636 ms          | 2,820 ms         |
| LCP                     | 1,628 ms        | 3,860 ms         |
| DOMContentLoaded        | 608 ms          | 2,748 ms         |
| TTI 近似（最後の long task 終了）| 608 ms  | 4,731 ms         |
| Total Blocking Time     | 0 ms            | 430 ms           |
| long task 数 / 最長     | 1 本 / 91 ms    | 4 本 / 292 ms    |

初回ロードで実際に落ちてくる JS は **2 本・転送 523 KB（展開後 1,901 KB）**:

| chunk               | 開始      | 転送     | 展開      |
| ------------------- | --------- | -------- | --------- |
| `index-*.js`        | 12 ms     | 405 KB   | 1,521 KB  |
| `RichTextEditor-*.js`| 1,492 ms | 118 KB   | 380 KB    |

**#991 の修正は効いている**（`RichTextEditor` は `index.html` の `modulepreload` から外れ、FCP を塞がなくなった = throttling なしで FCP 636 ms）。ただし**既定画面の Briefing がエディタを描画するため、chunk 自体は 1.5 秒後に必ず落ちてくる**。初回ロードの総量という意味では 523 KB のままで、§1 が狙った「初回ダウンロードから出す」は達成されていない。ここを削るには chunk 分割ではなく、Briefing がエディタを即時マウントしない設計（プレビュー表示 → 編集開始でマウント等）が要る。

Slow 4G での LCP 3.86 秒は、Core Web Vitals の "good"（2.5 秒以下）を超えて "needs improvement" 帯。TBT 430 ms も同様に "needs improvement"（200 ms 超）。

### 8.6 lucide-react の eager / lazy 内訳（§6 表 6 行目）

**結論: eager 側に 99.6% が乗っている。原因は 1 ファイル。**

sourcemap の mappings を復号して出力バイトをモジュールに帰属させた結果:

| chunk                 | 区分  | lucide 分（raw） | アイコンモジュール数 |
| --------------------- | ----- | ---------------- | -------------------- |
| `index-*.js`          | eager | **466.5 KB**     | **1,704**            |
| `RichTextEditor-*.js` | lazy  | 1.5 KB           | 7                    |
| `NotesView-*.js`      | lazy  | 0.1 KB           | 1                    |

eager チャンク（raw 1,521 KB）の**約 30.7% が lucide** で、パッケージ別でも app コード（521 KB）に次ぐ 2 位。

原因は `shared/src/components/tagIcon.ts` の `import { icons } from "lucide-react"`。名前付き import は tree-shake されるが、`icons` レジストリ**オブジェクト全体**を参照した瞬間に全アイコンが opt-in される。同ファイルの BUNDLE NOTE はこのトレードオフを認識した上で「許容できる」と書いているが、実測では**アイコンピッカーの curated 26 個のために 1,704 個を積んでいる**。

**修正の効きを実測**（§1.4 と同じ一時パッチ → 計測 → 破棄の手順）: `icons` 参照を curated 26 個の明示 import + 明示マップに置き換えてリビルド。

| | eager chunk raw | eager chunk gzip |
| --- | --- | --- |
| 現状 | 1,557.90 KB | 417.52 KB |
| 修正後 | 1,103.76 KB | **300.64 KB** |
| 差分 | −454.14 KB | **−116.88 KB（−28.0%）** |

**1 ファイルの変更で初回 JS が gzip 28% 減る。** ただし挙動が 1 点変わる: curated 26 個の外の名前が `wiki_tags.icon` に保存されている場合、現状は解決できるが修正後は `null` になる（呼び出し側の既定アイコンにフォールバック）。採用するなら、保存済みの icon 名を DB で洗い出して curated リストに含めるか、名前→動的 import の遅延解決にするかの判断が要る。

### 8.7 計測の副作用（実データへの書き込み）

計測中に以下が作者本人の実 DB に作られた。**§8.2 でタイマーを「No Todo」のまま開始したことによる**:

- `items_meta` / `tasks_payload`: `task-7df08c2d-ed6a-457b-8f0a-094541addebf`（title = `Untitled todo`, created_at = 2026-08-19 13:03:36 UTC, `is_deleted = false`）
- `timer_sessions`: `id = 13`（開始時 POST → 停止時 PATCH）

**副次的に見つかった 2 点**:

1. **リンク先 Todo を選ばずにタイマーを開始すると `Untitled todo` が自動生成される。** 使うたびに Todo リストにゴミが増える経路になっている
2. **その ID が `task-<uuid>` 形式**で、CLAUDE.md §4 の ID 不変式（TodoNode = `task-<timestamp+counter>`）から外れている。既存行はすべて `task-1786...`（timestamp）で、この 1 行だけ UUID
