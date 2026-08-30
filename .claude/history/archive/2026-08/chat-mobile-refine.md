# HISTORY ARCHIVE (chat-mobile-refine) — 2026-08

### 2026-07-31 - #499 再取得をドメイン単位に分割（ノート 1 保存 = 86 リクエスト問題）

#### 概要

ノートを 1 回保存するたびに全 15 テーブルを 4 周取り直し（実測 86 REST リクエスト）、その周回に `timer_settings` への POST が 4 回混ざっていた問題を、再取得の粒度をドメイン単位に落として解消した（PR #501 merged）。

#### 変更点

- **原因は 2 つ**: (1) Realtime のどのテーブル変更も単一 `syncVersion` を bump し、全消費側が deps に入れていたため全ドメインが全件再取得。Realtime は自分の書き込みも自分にエコーするので、ノート編集の 5 PATCH がそのまま 4 周になる。(2) `SupabaseTimerService.fetchTimerSettings` が「行が無ければ作る」upsert を無条件に投げており、**読み取りメソッドが毎回書き込んでいた**
- **`syncDomains.ts`（新規）**: テーブル → 8 ドメイン（tasks / notes / dailies / schedule / tags / calendars / timer / audio）の対応表 + `domainsForChange()`。`items_meta` は 5 role 共有なので変更行の `role` で振り分け、**hard DELETE はペイロードに PK しか載らない**（`items_meta` の PK は `id` 単独 — `0008` で実測）ため role 不明時は item 系 4 ドメインへ fan-out。取りこぼし = ユーザーが直せない stale / 余分に配る = fetch 1 回、の非対称性から安全側に倒す判断
- **`SyncContext.tsx`**: `domainVersions` を追加（`syncVersion` は互換で維持だが**もう読み手はいない**）。デバウンス蓄積は `syncBumpQueue.ts` に切り出し（Provider の中では実ブラウザ無しにテストできないため）
- **`useSyncDomains(...domains)`（新規）**: 指定ドメインのカウンタの合計。単調増加なので「どれかが動いたときだけ合計が変わる」。`?? 0` で NaN 化を防ぐ（NaN は `Object.is` で等しく、deps が永久に再実行されなくなる）
- **消費側 15 箇所** を自分が読むドメインだけに張り替え。**`MaterialsCountsBridge` はアプリ常駐**で 1 effect が tasks/notes/dailies を一括取得していたため、ドメインごとに 3 effect へ分割（ここを残すと「ノート 1 打鍵で全 role 引き直し」が生き残る）
- **テスト**: `syncDomainWiring.test.tsx`（1 ドメインずつ bump して「自分のドメインで再取得 / 他 7 つでは再取得しない」を両方向で固定）/ `syncBumpQueue.test.ts`（バーストの複数ドメイン保持・flush 済みドメインを次バーストへ持ち越さない）/ `syncDomains.test.ts`（`REALTIME_TABLES` との lockstep）。既存 Sync スタブ 8 ファイルは全ドメイン一律 bump なので**配線ミスを素通りさせる** — これは QA の指摘で判明し、上記 wiring テストで塞いだ
- **手順の変更**: 独立レビューを **PR 提出の前**に回した（#471 → #497、#473 → #500 と「レビュー反映が merge に間に合わず main に届かない」事故が 3 本連続したため。memory `push-after-merge-strands-commits` に運用ルールとして記録）
- **未消化**: DoD の「リクエスト数の実測」は実ブラウザが要るため merge 後に chat-main 側で計測（PR 本文に明記）

### 2026-07-31 - #473 コマンドパレットのモバイルタッチ導線（Epic #321 Phase 2）

#### 概要

コマンドパレットを物理キーボード（`Cmd/Ctrl+K`）専用から解放し、ボトムバー「その他」シート経由でタッチから開けるようにした（PR #498 open）。開けるようにした結果あらわになった、パレット側の 2 つの穴（ソフトキーボードで候補が隠れる / 背景タップで閉じられない）も同 PR で塞いだ。

#### 変更点

- **導線の置き場所**: 「その他」シートの Quick actions 先頭に「コマンドパレット」行（`web/src/MobileShellActions.tsx`）。消去法での確定 — header スロットは `AppShell` の wide ブランチ専用、`Cmd/Ctrl+K` は native mobile が省略する ShortcutConfig Provider 依存、固定タブはセクション移動用。全 narrow セクションが共有する chrome はこのシートだけで、#472 が Undo/Redo で同じ結論に達してスロットを開けている。並びは パレット → Undo → Redo（移動系を先に）。この行だけタップでシートを閉じる（自分の面を開くため）
- **`useVisualViewport`（新規）**: `shared/src/hooks/useVisualViewport.ts`。`vh` はソフトキーボードで縮まないため、`visualViewport` から「実際に見えている範囲」を読む。`useSyncExternalStore` 実装（`useEffect` + `setState` は `react-hooks/set-state-in-effect` が error。スナップショットは値が動いたときだけ再生成しないと identity 比較で無限再レンダになる）。`web/src/notes/suggestionPopup.ts` が `[[` メニュー用にやっている計測の React 版
- **`CommandPalette.tsx`**: 外側を「backdrop」+「visible area に合わせた frame」+「panel」の 3 段に分割。frame は API があれば `top/left/width/height` + `paddingTop = height*0.12` をインライン指定、無ければ従来の `pt-[12vh]` にフォールバック（キーボード非表示時は両者がピクセル一致 = Desktop 無変更）。panel を `flex max-h-full flex-col` にし、リストに `min-h-0` を追加（これが無いと flex 子はコンテンツ以下に縮まず 480px を保ってキーボードの裏へ戻る）
- **背景タップ**: 閉じる判定を `mousedown` → `pointerdown` へ。iOS Safari は素の div に mousedown を合成しないため、Escape キーの無いスマホでは開いたら戻れない一方通行だった。行の実行は `mousedown` のまま（入力欄のフォーカスを保つ `preventDefault` がそこに依存）
- **テスト**: パレットはテストゼロだった。`shared/tests/commandPalette.test.tsx` 10 件（visible viewport 追随・キーボードで縮む・オフセット追随・API 無し時のフォールバック・pointerdown 開閉・Desktop の Enter/矢印/Escape/絞り込み）、`web/tests/mobileShellActions.test.tsx` 3 件（行の並び順・シートを閉じる・履歴空でも活性）
- **docs**: `mobile-scope.md` #17 行を実態へ追随。ついでに #16（Undo/Redo）行が #472 で解消済みなのに「タッチ導線ゼロ / 現状 no-op」のまま stale だったので併せて修正。§5 Phase 2 の該当 2 行も打ち消し済みに
