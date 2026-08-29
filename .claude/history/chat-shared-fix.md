# HISTORY (chat-shared-fix)

### 2026-08-30 - [shared-fix] #1194 = チュートリアルに目次を付けた（機構は足さず、run が歩く list を差し替えるだけ）

#### 概要

こうだいさんの /goal「#1174 merge 後の origin/main から切ったブランチ + CI verify ローカル全緑 + PR」を #1194 で実行し、**PR #1246** まで到達。前提の 4 本（#1174 / #1192 / #1193 / #1201）はすべて main に入った状態から切っている。

チュートリアルの入口は Settings の「やり直す」1 つで、押すと必ず step 1 から全セクションを歩く — **目次の無い料理本**。Settings に全画面モーダルを置き、概要 → セクション選択 → 自動遷移して開始、の 3 段にした。

#### 一番効いたのは「機構を足さない」と気付いたこと

`TourContext` は元から**レジストリではなく「この run が歩く list」**に対して動いていた（probe / give-up / 進捗カウンタ / 終端のいずれも `stepsRef.current` 経由）。なので開始位置の指定に必要だったのは `runSteps` state 1 本と、`stepsRef` が持つものを「全体」から「この run の list」へ読み替えることだけ。全体を選ぶ側（`start` / `restart` / `startSection`）に `allStepsRef` を新設して分けた。

#### 部分実行が保存を触ると、あとからユーザーがツアーを失う

`localStorage` の進捗が答えている問いは「**このユーザーはツアー全体を提示され、終えたか拒んだか**」の 1 つだけ。セクション再生にそこを書かせると、Materials の 4 ステップを歩いただけで `completed` が立って以後ツアーが二度と提示されず、途中 Skip では `skipped` が立って「この節はいい」が「金輪際いらない」に化ける。**どちらも画面上は完璧に見える**。書き込みは全部 `persist` を通るので、ガードはそこ 1 箇所に置いた（呼び出し側が覚えておく規約にしない）。

#### 自分のパッチで自分が踏んだ穴を 2 つ潰した

- **probe の deps が全部 primitive だった**: 同じセクションを同じ位置で started し直すと index も isRunning も step id も変わらず effect が再実行されない — 直前に消したふきだしが戻ってこない。明示的な start ごとに必ず変わる dep（`runId`）を 1 本足した。既存の `restart` にも同型の潜在バグがあった
- **`set-state-in-effect` で lint が赤**: 「開いたら概要ページに戻す」を `useEffect([open])` で書いたら eslint に止められた。**閉じる側で巻き戻す**形に変えた（Close ボタン / Modal 自身の Escape・backdrop / 2 つの選択、で全経路を尽くす）。ついでにページ 2 にも Close を置いた — 「戻ってから閉じる」しか出口が無いのは単に悪い

#### step の無いセクションを隠さなかった

選択メニューの可否は `TOUR_SECTION_IDS`（`TOUR_STEPS` からの導出）が決める。手書きの一覧を置かないので、セクション Issue が step を append した瞬間に選べるようになり、それより 1 手前に増えることもない。現状は briefing / schedule / materials が選択可で、connect / work / analytics は disabled +「準備中」バッジ。**隠すとアプリの地図と形が変わったものを覚えさせる**ことになり、押せるようにすると「開いたのに何も出ない」= 壊れて見える。バッジはボタン内のテキストなので読み上げでも「押せない」が残る。

#### Scope 外を 1 箇所触った（PR 本文に明記）

`shared/src/components/Modal.tsx` に `size="full"`（`max-w-none`）を追加。ユーザー確定の「全画面モーダル」を満たすサイズが無く、tour 側で portal / focus trap / Escape / scroll lock を作り直すのは `useDialogA11y` の二重化になるため。既存の `modalWidth.test.tsx` は size を列挙して「max-w-* をちょうど 1 本出す」を見ているので、**その配列に `full` を足さないと新サイズが素通りする**（テスト側の追随が要るタイプの変更）。

#### 検証

- 新規 `shared/tests/tourSectionRun.test.tsx`（9 ケース）は**ホストが実際に遷移するハーネス**で組んだ（`onNavigateToSection` が section state を動かし、そのセクションのアンカーだけが document に居る）。「遷移して開始」は DoD の半分なので、固定 `currentSection` だと残り半分を 2 回検証することになる
- 新規 `shared/tests/tourLauncherModal.test.tsx`（10 ケース）/ `tourRegistry.test.ts` に 3 ケース追加 / 既存 `web/tests/settingsScreenActions.test.tsx` の「カード → restart」を 4 ケースへ差し替え（sink プールに `startTourSection` を追加したので隣の設定へ誤爆すると落ちる）
- **Settings の rightSidebar が picker と同じ `section.*` ラベルを使う**ので、web 側のクエリは `within(dialog)` でスコープしないと 2 つ拾う。最初これで多重ヒットを踏んだ
- `.github/workflows/ci.yml` の `verify` 全 15 ステップ + `docs-lint` をローカルで全緑（shared 272 files / 2654 tests・web 95 files / 902 tests・desktop 1/7・mcp 24/319）
- **PR 直後に main が動いてコンフリクトした**（#1229 の account deletion と #1180/#1181 のテンプレ 3 面が着地）。衝突は 1 箇所だけで、`SettingsScreen.tsx` の `{confirmRequest && …}` の直上に**双方がダイアログを差し込んでいた**もの。どちらかを選ぶ話ではないので両方残した（`TourLauncherModal` → `DeleteAccountDialog` の順）。解決後に verify 15 ステップ + docs-lint を丸ごと取り直して全緑、GitHub CI も 2 ジョブとも pass
- worktree 規約: ブランチを切るたび `.claude/comm/.session-branch` を更新。tracker は実装ブランチに載せず本コミットの専用ブランチへ（D-20260801-main-1）

### 2026-08-29 - [shared-fix] /goal 4 件を PR まで（ツアー系 3 件は「壊れていないのに一度も動いていなかった」種類のバグ）

#### 概要

こうだいさんの /goal「#1138 → #1192 → #1193 → #1201 のそれぞれに、独立ブランチ + ci.yml の verify 相当がローカル全緑 + PR」に着手し、**4 件すべて完了**（PR #1214 / #1217 / #1225 / #1228）。#1194 は Wave 2（#1174 待ち）の指示どおり着手していない。

着手前に読み取り専用の並列偵察（6 観点 + 統合）を回してツアー機構の実装ブリーフを作った。**その最中に main を取り込んだせいでファイルが偵察の足元で動いた**（#1124 の Schedule ステップ 5 本と #1153 の Kanban 退役が入り、ステップ数が 5 → 10 になった）ので、統合の段で全部読み直して突き合わせている。

ツアー系 3 件に共通していたのは「**壊れていないのに一度も動いていない**」という壊れ方。#1201 のアンカーは repo 全体で registry の 1 行にしか存在せず、#1193 は復帰のたびに静かに空振りし、#1192 は指示した操作を自分で塞いでいた。どれも例外を出さず、テストも通る。

#### 変更点

- **#1138（PR #1214）**: `localWeekStart` は `getDay()` をそのまま引く形に（インデックスは元から日曜起点なので、`(weekday + 6) % 7` のシフトが月曜性の正体だった）。**mcp-server 側に月曜前提の週演算は他に無い**ことを走査で確認（呼び出し元も `briefingHandlers.ts:326` の 1 つ）。ドリフトの本体は「1 つの規則が、コードを共有しない 2 パッケージに 2 実装ある」ことなので、**13 キーを両実装に通して一致を見るケース**を足した — `shared/tests/weekStartsSunday.test.ts` は `../src` と `../../web/src` しか走査しないので mcp-server は見えていなかった。cross-package import はテスト専用で、先例は `briefingSection.test.ts`
- **#1192（PR #1217）**: ふきだしは常にアンカーの左下に出て、タグピッカーも同じ場所に開く。候補 B（アンカー配下に `[aria-expanded="true"]` があるあいだ action ステップのふきだしを畳む）を採った。**衝突は構造的**で、ポップオーバーを開くコントロールをアンカーにすれば必ず再発するため。`aria-expanded` は**アンカー本体ではなく子孫**に付いている（アンカーは `NoteDetailSurface.tsx:108` のラッパ span で、フラグは `TagPicker.tsx:190` のボタン）ので子孫クエリで見る。`childList` も監視するのは TagPicker がポップオーバーを mount / unmount するから
- **値まで綴る理由（#1192）**: React は閉じているときも `aria-expanded="false"` を属性として出すので、`[aria-expanded]` だけだと**永久に畳んだまま**になる。`shared/src` + `web/src` の 16 箇所を全部見て、現行 10 アンカーの内側にあるのは TagPicker のものだけ・定常状態で true になるもの（`NoteListRows` の開閉 / `RightSidebarToggle`）は全アンカーの外、まで確認した
- **#1193（PR #1225）**: 「give-up に向きがある」形にした。保存位置は定義上ユーザーが到達したステップで、セクション後半のアンカーは前半が作った状態（ノートが選択済み / Todo タブが開いている）の上にしか無い。リロードはそれを必ず壊すので、**前へ歩くと同じ種類のアンカーばかりに当たって空振りし、空振りした run は resume point を動かさないので次も同じ**。位置を失うのではなくループしていた。resume した run が未表示のあいだだけ後ろへ歩かせると、**着地するだけでなく前提も組み直す**（「ノートを追加して」まで戻る → 作る → 選択される → 後半のアンカーが DOM に戻る）
- **Issue の記述より範囲が広かった（#1193）**: #1124 の merge で状態依存アンカーが 3 本増えていた（`schedule-todo-tab` / `-add` / `-board` はどれも `RightSidebarPortal` の内側で、`isOpen` は `useState(false)` で永続化されない。後ろ 2 本はさらに `sidebarTab === "todo"` を要求するが既定は `"flow"`）。Materials だけ個別に直す候補 A では残っていた
- **#1201（PR #1228）**: `briefing-intro` は #1122 が置いた行で、アンカー `"briefing-today"` は **repo 全体で registry の 1 行にしか無い**文字列だった（= 毎回 2.5 秒待って skip、誰の目にも触れていない）。既存行に本物のアンカーと文言を与える形にした — id を変えると保存済み resume point が指す先を失うし、死んだ行を残すと #1193 の巻き戻しがそこへ歩いて deadline を 1 回捨てる
- **アンカーをページの中に置かなかった理由（#1201）**: `BriefingView` は loading のあいだ masthead の無いスケルトンを返し、タブは **17:00 以降 夕刊が既定**（`defaultBriefingTab`）で `EveningView` が描かれる。どちらの内側でも「時刻によって出たり出なかったりするステップ」になり、#1193 が問題にした条件付きアンカーを自分で再生産する。タブ帯は section descriptor から描かれるので両方の幅・両方のタブ・データ到着前でも存在し、`AppShell` は header slot と narrow の segmented control のどちらか一方しかマウントしないので**担い手は常に 1 つ**
- **テストが実装を守っているか毎回ミューテーションで確かめた**: これが今回いちばん効いた。#1193 の新テスト 6 本は**最初 6 本中 5 本がガードを外しても緑のまま通った** — 原因は `expect(state()).toContain("one|run")` で、プローブ中の readout が `none|run|…` であり **"none|run" が "one|run" を含む**こと。「着地したステップ」と「一度も着地しなかった run」を区別できていなかった。`shownStep()` で field として読む形に直し、**修正を記述した 3 本が落ち / 不変式を記述した 3 本は緑のまま**に切り分けた。同じ発見で既存テスト 1 本の同型の穴も塞いだ
- **#1192 / #1201 も同様に確認**: #1192 は 7 ケース中 4 ケースがガード除去で赤化、#1201 は registry 側 / `useShellChrome` 側のどちらを落としても赤化することを実測
- **検証**: 4 ブランチとも ci.yml の `verify` 全ステップ（shared → web → desktop → mcp-server）+ `docs-lint` をローカルで全緑。#1193 の初回だけ `web/tests/briefingEveningLazyMount.test.tsx` が 1 本落ちたが、**ツアーを一切参照していない**ファイルで単体・フルスイートとも再実行で緑（マシン負荷によるタイムアウト）。判断を変えないよう verify を丸ごと取り直して全緑を確認してから commit した
- **worktree 規約**: ブランチを切るたび `.claude/comm/.session-branch` を更新。tracker は実装ブランチに載せず本コミットの専用ブランチへ（D-20260801-main-1）

### 2026-08-29 - [shared-fix] PR #1190 の CI 修正（コンフリクト解決が実装を丸ごと消していた）

#### 概要

こうだいさんの依頼で PR #1190（#1158 = セクションチャンクのアイドル先読み）の CI 赤を直した。**赤の原因は自分の実装ではなく、8/29 に打った main 取り込みマージ b7517bd6 のコンフリクト解決**。`web/src/lazySections.ts` を main 側で丸ごと採用したため `prefetchLazySections` の 135 行が消え、`MainScreen` の import だけが残って `TS2305` になっていた。最新 main（91009af9 = #1187 まで）を取り込み直して復元し、commit 7370ecc3 / CI 緑 / mergeable CLEAN。

#### 変更点

- **なぜコンフリクトが出たのか**: ブランチが古い main 由来で、その間に **#1152 が Connect セクションごと退役**して `lazySections.ts` から `ConnectScreen` の行が消えていた。同じファイルの同じ場所を両側が触ったため衝突し、解決で main 側を採ったときに**衝突していない追記部分（warm-up ブロック全体）まで一緒に落ちた**。`git diff origin/main...branch` で `lazySections.ts` が 1 行も出てこないのが決定的な症状だった
- **2 本構成へ縮めた**: `web/src/connect/` が存在しないので 3 本目のローダーは削除済みモジュールへの `import()` になる。ローダー表・テストのモック・コメントをすべて Notes + Analytics に揃えた。これで **PR が「Connect を落として絞るか」として判断キューに投げようとしていた問いも消えた**（#1152 が先に答えを出した）
- **実測を取り直した**: 元の PR 本文の数字（285 KB gzip / 10 .js / entry 921.85 kB）は 2 つの退役より前のもの。main を一度チェックアウトしてビルドし直し、**entry 848.77 → 849.47 kB raw（233.09 → 233.31 gzip）・dist は両側とも 7 .js + 1 .css・warm-up が引く union は約 272 KB gzip**（vite の gzip 列）。fan-out は推測せず **ビルド済みチャンクの静的 import 文を読んで**確かめた（`AnalyticsScreen` が `CartesianChart` と 2 つのウィジェットを、`NotesView` が `RichTextEditor` を静的に引く）
- **監査で 1 件、コメントの事実誤認が出た**: フォールバック定数の説明が「jsdom, iOS ≤ 16.3」だったが、repo 同梱の caniuse-lite を引くと **`requestIdleCallback` は Safari が macOS でも iOS でも未出荷**（Technology Preview のみ）。スマホの導線が公開 Web URL（D-20260807-main-1）である以上、**実機では常に `load` + 2 秒の setTimeout が本番経路**で、4 秒のアイドル待ちは Chromium / Firefox / Electron 殻だけの話だった。挙動は `typeof` の feature test なので無傷だが、遅延を調整する人が最初に読む数字なので直した
- **mutation check で守りの穴が 1 つ見つかった**: Save-Data ガード / offline ガード / MainScreen の呼び出し口はどれも外すとテストが赤くなるのに、**順次ループを `Promise.all` に変えても全部緑のまま通った**。モックが同期的に解決するので、どちらでも記録順が map 順になるため。「1 本ずつ」は帯域を食い潰さないための明示的な設計なので、**1 本目のロードを thenable で止めたまま 2 本目が始まっていないことを見る 8 個目のケース**を足し、改変を戻して赤化することまで確認した
- **`rules/frontend.md` に 1 節**: `SECTION_CHUNK_LOADERS` と `lazy()` は同じ specifier を二重に持つので、重い body を足す / 消すときは 2 箇所セットで直す（片方だけだと削除済みモジュールを `import()` することになる）。今回の壊れ方そのものを次の人が踏まないようにするため
- **検証**: ci.yml の `verify` 全ステップ + `docs-lint` をローカルで **15/15 緑**。GitHub 側も `typecheck + test + build` / `docs-lint` とも pass
- **並行作業の退避**: このワークツリーに未コミットで載っていた #1138（MCP の週開始を日曜へ）を `git stash` に逃がしてから着手した。ブランチ側にコミットが 1 件も無いため、**変更は stash にしか存在しない**状態が続いている

### 2026-08-27 - [shared-fix] /goal 3 件を PR まで（1 件は Issue の指定が今のアーキで踏めず、1 件は自分のバグをレビューが捕まえた）

#### 概要

こうだいさんの /goal「3 Issue それぞれに origin/main からのブランチ + CI verify 全ステップ緑 + PR」に着手し、**#1114 / #1134 / #1122 の 3 件すべてを完了**（PR #1142 / #1146 / #1154。#1142 と #1146 はその場でこうだいさんが merge）。

着手前に **origin/main との差が 133 ファイルある古いブランチ**に居たことに気づいて切り直し、**手つかずの origin/main で verify 15 ステップのベースライン**を先に取った（以降の赤を「自分の変更由来か元から赤か」で切り分けるため）。全 3 ブランチとも 15 ステップ緑。

#### 変更点

- **#1114（PR #1142・merged）**: `tagIcon.ts` の `import { icons }` を curated 26 個の明示 import + 明示マップへ。Issue の「着手前に決めること」は **DB を引いて解消**した（`select distinct icon from wiki_tags where icon is not null` = `Clock` / `File` の 2 つだけで、どちらも curated の内側）ので判断キューは不要だった。効きは Issue の見積もり（−28%）より大きく、**同一ブランチで `git stash` 前後を実測して gzip 368.83 → 251.84 kB = −31.7%**（Issue の数字は #994 時点で、その後 main 側の最適化が入っていたため取り直した）。`TAG_ICON_CHOICES` は `Object.keys(TAG_ICONS)` 由来にしてリストとマップがドリフトしない形に
- **自分のテストが自分のバグを捕まえた（#1114）**: `resolveTagIcon("toString")` を null にするテストを書いたら実際に落ちた — オブジェクトリテラルなので `TAG_ICONS["toString"]` が `Object.prototype.toString` に到達し、`createElement` に関数が渡る。**旧実装の `icons` 参照でも同じ穴が空いていた**ので、ついでに `Object.hasOwn` で塞いだ
- **#1134（PR #1146・merged）**: iOS のオートズーム。**呼び出し側 30 箇所の掃除ではなく CSS のフロア 1 本**にした — `DailyEntriesPanel` の日付 input はサイズ指定を自分で持たず Tailwind preflight の `font: inherit` で親の 12.5px を拾うので、クラスを追う掃除では原理的に取りこぼす。`@layer` の**外**に置くのが要件（`text-sm` に勝つ必要がある / すぐ上の icon・tap フロアは逆に `@layer components` に置いて呼び出し側を勝たせている）で、**生成 CSS 上で utilities 層（offset 10761–56523）の外（62126）に出ていることを実測**して確かめた
- **`max()` である理由と逃がし道（#1134）**: ベタ 16px でも DoD の「最小にしても 16px を割らない」は満たせるが、フォントサイズを 19〜25px に上げているユーザーの入力欄を 16px に固定してしまい逆行する。`1em` は親のサイズなので、意図的に大きい 28px タイトルだけ `[--field-font-size:28px]` で除外した（Tailwind の任意プロパティが生成 CSS に出ることも確認）。エディタ本文は `.note-editor .ProseMirror` が specificity で勝つため `web/src/index.css` にもう 1 本必要だった
- **#1122（PR #1154・open）**: ツアー基盤。ステップを**データ**（`{id, section, anchor, copyKey, advanceOn}`）にして、`section` を `SectionId`・`copyKey` を `TranslationKey` で縛った（`sections.ts:45` と同じ手 — 空の吹き出しが画面に出る前に registry の定義位置で落ちる）。anchor は座標ではなく `data-tour-id` 属性（jsdom はレイアウトが無く rect が全部 0 なので、rect 判定にすると**テストでは全ステップが飛びブラウザでだけ正しく見える** = #475 の形になる）
- **Issue の指定が今のアーキでは踏めなかった（#1122）**: 「進捗を DataService 経由で永続化」だが、`DataService` は 12 個のドメイン別 interface の合成で**汎用 KV も設定テーブルも無い**。文面どおりにやるとテーブル + ドメイン + `SupabaseTourService` + routing tuple + `SYNC_DOMAINS` 行 + migration が要り、最後にこうだいさんの `supabase db push`（🛑 人手ゲート）まで行かないと動かない。同種の軽量設定（テーマ / フォント / 言語 / ショートカット / 起動セクション）が全部 `useLocalStorage` なのでそれに揃え、**A/B を D-20260827-shared-fix-1 としてキューへ積んで作業は止めなかった**（P-008）。差し替え先は `useTourProgress.ts` の 1 ファイルに閉じてある
- **レビューが high 1 件を捕まえた（#1122）**: 多観点（状態機械 / a11y / テストの空振り / 配線の波及）で洗って 18 件、1 件ずつ独立に反証にかけて残ったうち実害 9 件を反映。**最も重かったのは自分で書いたヘッダコメントと実装が逆になっていた件** — `goTo` が「飛ばして進んだ」ときも再開位置を書いていたため、anchor が 1 つも無い今の状態でツアーを回すと保存位置が最終ステップまで歩き、後からセクション Issue が最初の anchor を足した瞬間に「2 / 2」から始まって step 1 が二度と出ない。指摘を鵜呑みにせず自分で経路を追って確認してから、`goTo(next, reason)` で walked / gaveUp を分けた
- **フレーム予算 → 実時間（#1122・レビュー由来）**: anchor 待ちを 12 フレームで打ち切っていたが、`currentSection` は `<Suspense>` のフォールバックが出た時点で切り替わるので、**遅延 import されたセクション本体（Notes / Analytics / Connect）が届く前に予算を使い切る**。コールドロードで該当ステップが必ず飛ぶため、実時間 2.5 秒に変えた（テストは Provider の prop で短縮）
- **フォーカストラップを 2 種類に分けた（#1122）**: `advanceOn: { kind: "action" }` のステップは**指している当の控えをユーザーに操作させる**のが目的なので、トラップするとキーボードで完了できなくなる。非モーダル（`aria-modal` なし + `aria-live` で読み上げ）にし、スポットライトも全面スクリムではなく box-shadow にして `pointer-events: none` でページを覆う要素を作らない形にした。重ね順は z-45 = 画面クロムの上・ダイアログ帯（z-50）の下（指示された控えが Modal を開くことがあるため）
- **ガードが本物かを変異テストで確認した**: 「unlayered であること」（#1134）と「1 つも表示できなければ完了にしない」（#1122）は、条件を潰すと該当テストだけが落ちることを実測してから戻した
- **verify ログを 2 プロセスが同時に書いて壊れた**: kill 直後に同じログファイルへ再実行したため NUL 混じりになり `desktop — build` の判定だけが読めなくなった。単体で緑を確認したうえで、記録として信頼できるログを別ファイルに取り直した

### 2026-08-24 - [shared-fix] /goal 残り 4 件を PR まで（3 件は Issue の前提が実測で崩れていた）

#### 概要

前セッションから続く /goal の残り **#1102 / #992 / #1087 / #1079** を、それぞれ「origin/main から切ったブランチ + CI verify 15 ステップ緑 + PR」で完了した（PR #1126 / #1127 / #1128 / #1129。#1126 と #1127 はその場でこうだいさんが merge）。これで対象 7 件すべてが PR に到達した。

**4 件のうち 3 件は Issue 本文の前提が今日のコードと食い違っていた**。#992 は削減対象そのものが存在せず、#1079 は「設定 1 行」がそのままでは踏めず、#1087 は数え方が違った。前セッションで効いた「Issue 本文より今日のコードを信じる」を今回も先に置いたので、実装前に全部つかまった。

#### 変更点

- **#1102（PR #1126・merged）**: 週の始まりを日曜固定にし、`useWeekStartPref` と `life-editor-week-start` を撤去。**純関数の `weekStartsOn` 引数は残した** — 月曜ケースが step-back 演算を検証している唯一のテストで、#860 でドリフトしたのはまさにその演算。畳んだのは配線層（Analytics 4 コンポーネントのフック呼び出し / MonthGrid の prop / useCalendarNav の返り値 / useGoalsDoc の引数）。新テスト `weekStartsSunday.test.ts` が「古い "1" を localStorage に書いても境界が動かない」ことと「`shared/src` と `web/src` に退役シンボルが残っていない」ことを走査する（**取りこぼした消費者は型検査もテストも素通りするので、走査だけが網になる**）
- **#992（PR #1127・merged）**: Issue の「行ごとの `useDroppable`」は**起票時点から存在しなかった**（`NoteListRows.tsx` の droppable は `DesktopTagHeading` 内 = タグ見出しごと 1 個）。行ごとの登録が実在したのは Kanban のカードで、`useSortable` が draggable と droppable を両方登録していた。**`useDraggable` への置換は不採用** — `sortableKeyboardCoordinates` が `droppableContainers.get(active.id)` を引くので、置換すると矢印キーの DnD が無言で死ぬ。`disabled: { droppable: true }` なら Map には残るのでキーボードは無傷、測定と衝突判定からは外れる（盤は `MeasuringStrategy.Always` なのでドラッグ 1 フレームごとにカード枚数ぶんの `getBoundingClientRect` が走っていた）。この経路はテスト 0 本だったので 2 本追加（修正前は 2 ではなく 8 で落ちることを実測）
- **#1087（PR #1128）**: known-issue の採否条件を「常時ロードされる場所から ID 参照を張れるか」に変更（`rules/records.md` §2 が正本・`docs-workflow` は参照に）。**参照 0 は Issue の 7 本ではなく実測 5 本**（007 / 010 / 023 / 030 / 032）。束で扱わず 3 通りに割った: 前提ごと消えた 007 / 010 は削除、今日も再現する 030 / 032 は入口を張る（`rules/records.md` §4 と CLAUDE.md §7.2）、検証不能の 023 は凍結。判断 2 件は D-20260823-shared-fix-1 / -2 として台帳へ（削除は不可逆なので P-007 で同期確認・キューには積まなかった）
- **#1079（PR #1129）**: `pool: "threads"` は**そのままでは入れられなかった**。この repo の TZ pin は `test.env` だけで、threads worker はプロセスを共有するため Node が `process.env.TZ` からゾーンを読み直さない — `TZ=UTC` で mcp-server の localDate が 3 件落ちる。**もっと危険なのは落ちない方**で、`dateKeyOfInstant` と `analyticsCompletedDayKey` は `getTimezoneOffset() < 0` で自分をガードしており UTC ではアサーションごと消えて緑になる（#413 / #420 が守っているバグが素通りする）。pin を config モジュールの代入へ移してメインプロセスで ICU を張り直し、canary も「解決済みゾーン」を見る形に直した。DOM を触らない shared の 86 本は node 環境へ（**拡張子での glob 分割は不可** — `.test.ts` の 35 本は DOM が要る）。jsdom 生成 226s → 147s CPU
- **計測の作法**: この機は同じコマンドでも ±30% ぶれる（冷キャッシュ 116s / 温 69〜90s）ため、**同一ブランチで pool だけ入れ替えた対照**（68s → 59s = −13%）を PR の数字にした。ファイル編集直後の 1 回目は transform キャッシュが無効化されて必ず遅くなるので計測から除いた。Issue の「124s → 90s 以下」は達成（59s）だが、**Issue が測った −36% はこの機では再現していない**
- **偵察**: 前セッションで API エラーにより欠けていた #1079 の偵察を含め、読み取り専用サブエージェント 7 体で先に洗った（#1079 の 5 問 / #992 の DnD 経路 / #1087 の実測と文面）。`useDraggable` がキーボード DnD を殺す件も、web でバレル置換が config なしには 1 行も通らない件も、この段階で判明している
