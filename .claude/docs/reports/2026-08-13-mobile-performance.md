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
- `web/src/tasks/KanbanView.tsx:69`

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
- `web/src/tasks/KanbanCardDraggable.tsx:28` — カードごとに `useSortable`
- `web/src/tasks/KanbanColumnDroppable.tsx:36,40` — 列ごとに `useDroppable` + `SortableContext`

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

| 観点               | 未計測の中身                                       | 必要なもの                           |
| ------------------ | -------------------------------------------------- | ------------------------------------ |
| ランタイム（§2）   | 実際の再レンダリング回数・コミット時間             | 実ブラウザ + React DevTools Profiler |
| データ取得（§3.2） | 1 ポモドーロあたりの実 REST 回数                   | 実ブラウザ + Network パネル          |
| 描画（§4）         | 実データでの行数 / DOM ノード数 / スクロールの FPS | 実ブラウザ + 実データ                |
| 描画（§4.4）       | 追従ツールチップの合成コスト                       | 実ブラウザ + Performance パネル      |
| 実機条件（§5）     | throttling 下の LCP / TTI、パース時間              | 実ブラウザ + throttling              |
| 初期ロード（§1.5） | lucide-react の eager / lazy 内訳                  | chunk 単位のモジュール帰属出力       |

これらは **chat-main（playwright MCP + dev server を持つ唯一のレーン）に引き継ぐ**のが筋。本レポートは静的計測とビルド計測で取れる範囲を確定させ、実ブラウザ計測の的を絞ることを役割とする。

---

## 7. 起票を依頼する修正 Issue（`.claude/comm/outbox/chat-mobile-refine.md` へ append 済み）

1. **[perf] 初回ロードの eager JS を減らす — `RichTextEditor` と Briefing のグラフ 3 枚を `lazy()` 化 + `manualChunks` 見直し**（§1。案 A = 4 ファイル + config で実測 gzip −39.4%。案 B まで踏み込めば −52.2%）
2. **[perf] 長いリストの仮想化と、行あたり dnd 登録の削減**（§4。ノート行のタグ重複描画を含む）
3. **[perf] 消費者のいない `timer_sessions` 購読を外す**（§3.2）
4. **[measure] chat-main による実ブラウザ計測**（§6 の 6 項目）
