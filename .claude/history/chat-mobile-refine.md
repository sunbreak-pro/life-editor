# HISTORY (chat-mobile-refine)

### 2026-08-18 - shared-fix 5 件を PR 化（#1014 / #1039 / #1035 / #1049 / #1050）

#### 概要

`shared-fix [mobile-refine]` の open 5 件を、それぞれ `origin/main` から切った独立ブランチで実装し PR まで出した。#1014 は docs のみ、残り 4 件は Mobile の chrome とモーションまわり。全 PR で CI `verify` ジョブのステップを上から全部ローカル実測 + `docs-lint` / `records.mjs check` を緑にしてから push。

#### 変更点

- **#1014 → PR #1056（merged）**: 係属していた `D-20260810-mobile-1` / `-2`（ともに = A）の docs 追随。§1 の Consumption を「1 タップ更新は含む」に緩め、#1 / #4 / #9 の目標列を実態へ、`#19` 完了トグル / `#20` 気分★ の行を新設。**目標ブロックは #872 で `#18` が既にあるため新規行を作らず注記のみ**にした（DoD は「3 行追加」だったが、数値の非複製原則を優先して PR 本文で逸脱を明示）
- **#1039 → PR #1063（merged）**: narrow のタブ帯 36 → 32px、ヘッダー上余白 12 → 8px。`SegmentedControl` に `size="sm"` を足し、**セクションのタブ帯だけ**が採用（パネル内の用途は `md` 据え置き）。縮めるとタップ領域が痩せる問題は `TAP_TARGET_TALL`（透明な `::after` を高さ 44px でかぶせる）で解き、**36 → 44px と逆に広げた**
- **#1035 → PR #1066（merged）**: narrow ヘッダー行の右端に Undo/Redo を全 7 セクションで表示。行を `web/src/NarrowHeaderRow.tsx` に切り出し、`NarrowHeader: "none"` の意味を「行なし」→「この行に何も出さない」へ変更（Analytics / Trash も行を持つ）
- **#1049 → PR #1069（merged）**: セクション初回表示に 0.3s の fade + 8px rise。`useFirstAppearance`（key ごとに 1 回）で「切替のたびに再生」を回避
- **#1050 → PR #1074（open）**: 左端からのスワイプインでドロワーを開く `useEdgeSwipeOpen` + 開くアニメーション 3 本（narrow ドロワー / scrim / wide パネル）

#### 手順・知見

- **`desktop` の `npm ci` が dev 依存を 133 個取りこぼしていた**（`vitest` ごと欠落 → `desktop typecheck` が `Cannot find module 'vitest/config'` で落ちる）。exit code は 0 だったので install ログのテールだけ見ていると気付けない。**`npm ci` の成功は「入りきった」を意味しない** — 落ちたときは `node_modules/.package-lock.json` のパッケージ数を `package-lock.json` と突き合わせる（513 対 646 で判明）
- **5 本を並行ブランチで出すと MainScreen.tsx と tokens.css が必ず衝突する**。#1039 と #1049 が先に merge された結果、#1066 は MainScreen で、#1074 は tokens.css で CONFLICTING になった。どちらも「相手が消した関数に自分が 1 行足していた」型で、**消えた側の意図（`size="sm"`）を新しい構造へ移し替える**のが解消。tokens.css は両者とも純粋な追加ブロックなので並べるだけ
- **`git merge origin/main` は他チャットの tracker commit を巻き込む**ので `pre-commit-tracker-guard` が止める。merge commit ではこれが正常なので `[tracker-ok]` で通す
- **jsdom にレイアウトが無い制約下でのモーションのテスト**は「宣言のほう」を固定する形にした（`0.3s` / `both` / 最終フレームが `transform: none` / fill-mode 無し）。特に**アニメーションに `forwards` を付けるとドラッグのインライン transform に勝ってしまう**のはブラウザでしか出ない事故なので、CSS 側を読むテストで押さえる価値がある

### 2026-08-13 - Epic #716 の裁定 3 件の着地を実測

#### 概要

2026-08-01 に回答済みなのに台帳の `implemented-by` が空だった 3 件（`D-20260730-mobile-1` / `-2` / `-3`）を現状のコードで実測し、**3 件とも満たされている**と判定した（PR #803 open・コードは 1 行も触っていない）。未達ゼロのため起票依頼は無し。

#### 変更点

- **mobile-1 = A（3 択タッチ行を維持）→ #494**: 行の実体は `shared/src/components/TaskStatusChoices.tsx:41-72`（3 状態を `grid-cols-3`・各ボタン `min-h-11` = 44px・1 タップ確定）。`web/src/tasks/KanbanView.tsx:736-746` が `TaskDetailPanel` の `statusControl` スロットへ Mobile だけに注入し、Desktop（`:731`）は巡回ボタンのまま
- **mobile-2 = B（`BottomSheet` に閉じるボタン）→ #539**: `shared/src/components/BottomSheet.tsx:115-128` に無条件で常設。`closeLabel: string`（`:19`）が必須 prop なので「読み上げ名の無い唯一の出口」を型で塞いでいる。他のシート（QuickAdd / PomodoroTask / GraphSettings / QuickCapture）はすべて `BottomSheet` を包む形で独自の殻を持たない
- **mobile-3 = B（本文だけロック）→ #541**: `LockedBodyGate`（`shared/src/components/materials/LockedBodyGate.tsx:31-64`）が `web/src/notes/NoteDetailSurface.tsx:78-86` で `contentEditor` だけを包む。両サーフェスが同じ `password.isGated(...)` を読み（`NotesView.tsx:354` / `:421`）、判定側（`web/src/notes/hooks/useNotePassword.ts:72`）は幅を見ない
- **台帳に根拠セクションを追加**: `implemented-by` の PR 番号だけでなく file:line を残し、次の読み手が測り直さずに済む形にした

#### 手順・知見

- **「3 択タッチ行」が何を指すかは台帳から読めなかった**（キュー原文が消化済みで、再構成された裁定文には対象部品名が無い）。history の 2026-07-30 行と PR #494 のコミット本文（"a three-choice touch row that sets a status in one tap instead of cycling"）の 2 点で裏取りした。Schedule 側に `リスト｜時間｜月` という紛らわしい別の「3 択」があるので、**ID だけで着手せず指示対象を毎回確定させる**
- **裁定が「現状維持」のときも着地点はある** — その状態を作った PR（mobile-1 なら #494）。`implemented-by` を空のまま置くと「やったのか忘れたのか」が記録から判別できなくなる。維持系の裁定こそ埋める価値がある
- **台帳の更新に実装ゲートは要らないが、docs ゲートは要る**: `scripts/docs-lint.sh`（`LC_ALL=C` 付き）と `node .claude/scripts/records.mjs check` の 2 本で緑を確認した。docs-lint は Windows の Git Bash で 2 分以上かかるので background 実行が前提

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
