# HISTORY ARCHIVE (chat-mobile-refine) — 2026-08

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
