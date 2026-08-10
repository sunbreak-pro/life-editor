# HISTORY (chat-mobile-refine)

### 2026-08-10 - #632 モバイル FAB の配置定義を 1 本化

#### 概要

Schedule と Notes で別々に書かれていた浮き「+」ボタンの配置を、共有部品 `shared/src/components/MobileFab.tsx` に一本化した（PR #660）。**Schedule 側の実害は解消、Notes 側の「セクションの箱に貼り付く」は未達**で判断キューへ（`D-20260810-mobile-3`）。

#### 変更点

- **本当の欠陥はオフセットではなく「何を基準に置くか」だった**: Schedule は `fixed bottom-6 right-6`。モバイル Chrome の `fixed` は**レイアウトビューポート**（URL バーが隠れた時の高さ）基準なのに、シェルの高さは `100svh`（URL バーが出ている時の高さ）。つまりスクロールで URL バーが縮むたびに「+」の見かけの位置がズレていた。`absolute` + シェル内の `relative` 親に変え、基準をアプリの箱に固定した
- **セーフエリアの余白は落とした**: `BottomTabBar` が既にその帯を持っているので二重取りだった
- **クリアランスは 24 + 56 = 80px**。ホスト側スクローラの `pb-24`（96px）で足りる（#509 の「最後の行の右端が「+」の下に潜って誤タップになる」回帰を作らないための数値）
- **Notes は契約の後半を満たせていない**: Materials は `PageContainer` の `width="wide"` で描画され、その中身は高さ auto。`relative` 親が伸びないので「+」はセクションの箱ではなく**リストの末尾**に付く。直すには `MainScreen.tsx` の `ownsFullBleed` を触る必要があり #632 のスコープ外・Daily のスクロール所有権も動くため、**実装せずキューへ回した（P-008）**。`MobileFab` の HOST CONTRACT・呼び出し箇所のコメント・テストのヘッダに「未達」と明記してある

#### 手順・知見

- **「offsets が一致している」と書いたコメントが嘘だった**のをアドバーサリアルレビューが拾った。共有部品に寄せると「揃った」と書きたくなるが、**揃うのは寸法だけで基準（containing block）は呼び出し側の責任**。契約として明文化しないと次の利用者が同じ勘違いをする
- **jsdom にはレイアウトが無い**ので「箱に貼り付いているか」はテストで固定できない。`shared/tests/mobileFab.test.tsx` は class 文字列（`absolute` である・`fixed` でない）までしか押さえられず、その旨をヘッダに書いた
- **`docs:` の後追い push が main に届かなかった**: `D-20260810-mobile-3` と outbox を `claude/mobile-589-scope-audit` に push したが、**PR #651 が squash merge された後**だったため main に入らず。コード側のコメントが存在しない決定 ID を指す状態になっていた（`push-after-merge-strands-commits` の実例 2 度目）。#660 のブランチで入れ直した
- **マージ衝突は #588（PR #646）の分割**が原因。`NotesView` のモバイル本体が `NotesMobileList.tsx` へ移っていたので、`NotesView` は main を丸ごと採り、自分の変更だけを移設した。`git checkout origin/main -- <path>` は「相手の版を全面採用」が正しい時に一番安全

### 2026-08-10 - #589 mobile-scope「現状維持」9 行のコード実測と追随

#### 概要

Epic #321 に唯一残っていた「現状維持で確定する 9 行が本当にスコープ表どおりか」を、コードで全数照合した（PR #651）。**6 行は表どおり、3 行がズレ**。コードは 1 行も変えず、`mobile-scope.md` を実態に追随させ、実装側のズレ 2 件は判断キューと outbox へ回した。

#### 変更点

- **#9 tags が最も壊れていた**: 引用先 `web/src/wikitag/WikiTagsManagementView.tsx` は**表を書いた 2 日後**の #329（`ca2d6192`）で削除済みで、materials の tags タブごと退役（`useShellNavigation.ts:23` = notes | daily）。タグマスタは #409 で全画面共通モーダル（`web/src/tags/TagEditorHost.tsx`）になり、導線は wide サイドバーのみ（`AppShell.tsx:173,187` → `SidebarNav.tsx:184`）。表が「wide 限定」と書いていたグループ管理は**限定ではなく機能ごと退役**（`useWikiTagsUnifiedAPI` に group 系 API が 0 件・`WikiTagGroup` は型だけ残骸）。さらに **#551 / #566 で色編集がスコープ超過** — `CalendarTab.tsx:1540` の `TagColorControls` が narrow では `:2262` の BottomSheet に載り `setTagColor` でマスタを書き換える
- **#1 / #4 は「目標語のほう」がズレ**: どちらも目標列が Consumption（§1 = 閲覧・確認のみ / 編集不可）だが、briefing は完了トグル（`BriefingView.tsx:330,384,461`）と夕刊の気分★（`EveningView.tsx:195`）が、schedule は行タップの `EventEditorPane` シート（`CalendarTab.tsx:2262` ← `:1498`）・FAB の新規作成・完了トグルが narrow で効く。**`git show <doc-commit>:<file>` と `git log -S` で当時のファイルを開いて確認したところ、表を書いた 2026-07-23 時点で既に同じ配線**（#168 / #249 / #266 / #274 由来）。「30+ PR のどれかが壊した」ではなく最初から目標語が実態より狭い、が正しい読み
- **9 行以外の stale も同 PR で**: §3 の `AppShell.tsx:115` → `:147`/`:153`・`sections.ts:68-131` → `:69-132`・`:147` → `:148`、「tasks は materials 配下」→ #411 で Schedule の 2 つ目のタブへ、#11 行の `WorkScreen.tsx:41,362` → `:42`/`:368`、§5 の「追加実装なし」リストを実際に該当する 6 行へ縮小、§6 に「native 省略ガードは Capacitor 殻でしか発火しない（#600 で主導線と確定した公開 Web URL では幅分岐が効いている）」の注記
- **ヘッダの「実測日 2026-07-23（全 file:line 確認済み）」は #9 の引用が 2 日後に消えた時点で破綻**していたので、初回実測日 + 2026-08-10 再実測のスタンプに置換した

#### 手順・知見

- **9 行を 9 エージェントで並列実測 → drift 主張だけアドバーサリアル検証**の構成にした（20 エージェント / エラー 0）。**一次報告の DRIFT 主張は 3 件が検証で棄却**された — いずれも「実測日より前から同じ配線」で、drift（実測後に変わった）ではなく最初からのズレだったもの。**「今のコードと文書が食い違う」と「文書を書いた後にコードが変わった」を混同すると、無実の PR を犯人にする**
- 監査報告の file:line は採用前にメイン側で 15 点以上を実際に開いて照合した（`rules/docs-consistency.md` §5）。**捏造はゼロ**で、ズレていたのは 3 件のアンカー位置だけだった
- 判断キューを増やすと `docs-lint` が索引 stale で落ちる。`node .claude/scripts/records.mjs index` を**同一コミット**で回す（`rules/records.md` §4）
- **キューのファイルを丸ごと Write で書き直すと、既存の注記を静かに落とす**。実際に「回答済み 3 件は台帳へ昇格済み」の 1 行を落として後から戻した（`6128d86c`）。append 先のファイルは Edit で足す

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
