# HISTORY (chat-mobile-refine)

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

### 2026-07-31 - #471 mobile notes のフル編集（Epic #321 Phase 2）

#### 概要

狭幅のノートを閲覧専用からフル編集へ引き上げた（PR #496 merged）。詳細シートに Desktop main と同じ `NoteDetailPanel` を差し込み、`[[` 補完をタッチ + ソフトキーボード前提の配置に作り替えた。独立レビュー 2 本の指摘（本文消失 1 件を含む）は追撃ブランチで反映。

#### 変更点

- **1 panel 2 面**: シートの中身を `NoteDetailPanel`（`variant="sidebar"`）に差し替え、タイトル / タグ / ピン / 削除 / 本文が両幅で 1 実装に。シートのヘッダーは汎用ラベル（新規 i18n `materials.notes.detailTitle`）
- **サジェストメニューの配置を切り出し**（`web/src/notes/suggestionPopup.ts`）: `visualViewport` 基準で下→上へ反転・左右クランプ・選んだ側の空きで高さ頭打ち（ただし `max-h-72` 相当の 288px を**緩める方向には効かせない** — インライン style がクラスに勝つため Desktop が伸びる）。`/` メニューも同じ配置に載せた。行は 768px 未満で 44px 床（`max-md:`）
- **状態機械をフック化**: `useNoteSheetTarget`（識別 + 本文 hydrate 済み判定 + 消えたリンクの無視）。ホストの 4 Provider と TipTap 抜きで遷移をテストできる
- **QA が掘った本文消失**: シートは開くたびにエディタを mount するのに、その条件が「選択 id の一致」だった。選択はシート閉鎖もリスト再読込も跨いで残るが本文は残らない（#301 は `updatedAt` が動いた行だけキャッシュを捨てて非同期で再取得）ので、その隙間に開くと空の本文で mount → 初回入力が空を保存する。判定を `isContentLoaded`（notes API に追加）へ変更し、シートは `selectedNote` でなく自分の note の本文を読む
- **同 QA の残り**: 高さ上限の天井なし（Desktop で 288→666px に伸びていた）/ キャレット矩形のキャッシュ（キーボードでスクロールすると置き去り → getter 化 + capture フェーズの scroll 監視）/ 非同期 `items()` の追い越しで popup 二重生成・孤児化 / Escape がプラグインを閉じず以後毎打鍵で全件フェッチ（#430 のコスト・Desktop 既存）/ 配置前の popup が可視 / 消えたリンクでシートが閉じる
- **実測で棄却した指摘 2 件**: notes 一覧は検索フィルタ後ではない（改名でシートは閉じない）/ `@tiptap/suggestion` は plugin view の `destroy()` で `onExit` を呼ぶ（シートを閉じても popup は残らない）
- **テスト +40**（web 32 → 72）: 配置の純関数（実機の数値で反転・クランプ・天井）、popup の DOM glue（visualViewport スタブ・ResizeObserver スタブ・破棄時のリスナ解除）、シート状態機械、`[[` の遅延フェッチ（実エディタで items() 呼び出しを観測）
- **運用の教訓（再発）**: #470 と同じく、PR merge 直後に積んだ commit が main に届かなかった。**merge 済み PR に後追い push しない** — 新しい main から切り直して cherry-pick する

### 2026-07-30 - #470 mobile tasks の詳細編集（Epic #321 Phase 2）

#### 概要

狭幅のタスクカードのタップ先を「ステータス 3 択だけのシート」から「Desktop と同じ `TaskDetailPanel` を載せた詳細シート」に置き換え、タイトル / 本文（リッチテキスト）/ タグ / ステータスをモバイルで編集できるようにした（PR #494）。DnD・カンバンのカラム操作は Desktop 専用のまま。

#### 変更点

- **1 panel 2 面**: `TaskDetailPanel` に `statusControl` スロットを追加（加算的・省略時は Desktop の巡回ボタンのまま）。Mobile はそこに新設の共有部品 `TaskStatusChoices`（3 択タッチ行・1 タップで確定）を入れる。`MobileTaskList` は BottomSheet の殻だけを持ち、panel は host（`KanbanView`）が組む
- **副産物**: narrow に初めてタスク詳細の面ができたため、`[[タスク]]` リンク着地で詳細シートが開くようになった（従来は Todo タブへ移るだけでカード選択が見えず、どこへ飛んだか分からなかった）
- **状態機械をフック化**: 開いているタスクの identity を `web/src/tasks/useTaskDetailTarget.ts` に切り出し（board + 4 Provider + TipTap を立てずに遷移をテストできる）。identity は `tree.selectedTaskId` を使わない（選択は永続化 + mount 復元されるため起動直後にシートが開いてしまう）
- **QA で見つけた実バグ**: `BottomSheet` のパネルが `stopPropagation` していたため、シート内では `document` に張った click-outside が発火せず、`TagPicker` のドロップダウンが閉じられなかった（React は portal のイベントを `document.body` で拾うので native ごと止まる）。背景タップ判定に置き換えて解消（旧実装で fail するテスト付き・**シート内にポップオーバーを置く全ケースに効く**）
- **テスト +16**: `shared/tests/taskStatusChoices.test.tsx` / `shared/tests/bottomSheetDismiss.test.tsx` / `web/tests/useTaskDetailTarget.test.tsx`（状態機械 11 件）/ `web/tests/mobileTaskList.test.tsx`。ゲートは shared 1306・web 32・両ビルド・両 lint すべて exit 0
- **docs**: `mobile-scope.md` #6 行と §5 Phase 2 を実態に追随、Epic #321 Phase 2 の該当行にチェック（→ #470 / PR #494）。判断キューに 2 件（ステータス操作の形 / 背の高いシートの閉じるボタン）、outbox に 3 件（タスク本文の `[[リンク]]` が両幅で未配線 / シート + ソフトキーボードの実機確認 / `BottomSheet` のフォーカストラップ欠如）
- **QA 2 本目の小粒回収**（PR #494 merge 後・別ブランチ）: `cn` は素の連結（tailwind-merge 無し）なので `gap-2` と `gap-1.5` が両立し CSS 出力順で 8px が勝っていた → 分岐ごとに gap を持たせて解消。narrow では wide 専用 portal 用の panel を作り捨てていたので `isWide &&` で止めた。narrow→wide 横断で詳細が視界から消える実態にコメントを合わせた（旧コメントは「rightSidebar へ移る」と言い過ぎ）。`MainScreen.tsx` の「mobile Kanban は詳細パネル無し」を更新
- **運用の教訓**: PR を出した直後に merge されたため、後から積んだ tracker commit の push が非 fast-forward で弾かれた。merge 済みブランチへ push すると main に届かない（既知の罠）ので、新しい main から別ブランチを切って cherry-pick した

### 2026-07-30 - #475 `[[リンク]]` クリック遷移の修復 + web 側テスト基盤の新設

#### 概要

ノート本文の解決済み `[[リンク]]` をクリックしても遷移しない不具合を、クリック経路を ProseMirror の座標依存パイプラインから素の DOM `click` へ移して修復した。あわせて `web/` に vitest を新設し、クリック遷移を覆うテスト 12 件を追加した（PR #483）。

#### 変更点

- **原因特定（実測）**: `handleClickOn` の 5 ガードは実エディタで全通過し `onNavigate` も呼ばれる（Issue の「プロップ直渡しが原因」仮説は棄却）。壊れているのは `handleClickOn` に到達する手前 — `eventBelongsToView` / 他プラグインの `mousedown` / `posAtCoords()` が `inside` を atom 自身へ解決すること / `MouseDown.up()` の早期 return の 4 前提。「左端はキャレット・中央〜右はノード選択」の差は、この経路が走っていない署名（走れば `selectClickedLeaf` が左端でもノードを選択する）
- **itemLinkNode.ts**: クリック遷移を `handleDOMEvents.click` へ移行。`closest("[data-item-link]")` + 描画済み `data-*` から遷移先を読むので座標変換に依存しない。未解決リンクは claim せず不活性のまま / cmd・ctrl・shift クリックは ProseMirror の選択ジェスチャに通す
- **RichTextEditor.tsx**: ホストの navigate コールバックを ref getter 経由に統一（`getOnResolvedInserted` / `getCreateNote` と同形）
- **テスト基盤**: `web/vitest.config.ts`（`vite.config.ts` を merge して alias / dedupe の二重管理を回避）+ `tests/setup.ts` + `tests/itemLinkClick.test.tsx`。旧実装での fail 件数はベースラインの取り方で変わる（クリック機構だけ戻す = 5 件 / `itemLinkNode.ts` を pre-#475 に丸ごと戻す = 7 件。差の 2 件は `resolveItemLinkTarget` 未 export 由来）
- **merge 後 QA の追撃（PR #486）**: 別コンテキストの role-qa が実バグ 1 件を検出 — モバイル読み取りシートは自分の `readNoteId` で本文を出し分けるため（`NotesView.tsx:695`）、pending-select が選択だけ動かすとシートが元ノートのまま永久スケルトンに落ちる。`useNoteLinking` に `onPendingSelected` seam を追加してシートを追随させた。あわせて span 内で完結するドラッグの誤遷移をガード（PM と同じ 4px）、`handleClickOn` を claim 専用で復活（遷移後の atom 選択残り対策）、jsdom で `document.elementFromPoint` をスタブ（PM の mousedown が listener 内で throw して run が落ちる）
- **CI / docs**: `.github/workflows/ci.yml` に `web — test` ステップ、`.claude/CLAUDE.md` §7.1 に `cd web && npm run test` と「jsdom にレイアウトが無い」制約を追記
