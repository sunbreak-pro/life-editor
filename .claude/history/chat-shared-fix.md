# HISTORY (chat-shared-fix)

### 2026-08-30 - [shared-fix] PR #1325 に main を取り込んだ（衝突は「両側が同じファイルの末尾に足した」1 件だけ）

#### 概要

こうだいさんの依頼で **PR #1325（#1278 = NoticePanel の text variant）のコンフリクトを解消**した。PR を出したあとに main が 7 コミット進み（b31ee913 → 7339bd2e）、そのうち **#1306（#1292 = 削除済みリンク先を id ではなく名前で出す）が同じ `web/tests/linkPanel.test.tsx` を触っていた**。解決後は CI 2 ジョブとも pass・`mergeStateStatus: CLEAN`。merge 自体は P-001 でこうだいさんの手番。

#### 変更点

- **衝突は 1 ファイル・1 箇所で、択一ではなかった**: 両側とも `linkPanel.test.tsx` の**末尾に独立した `describe` を append** しただけ（こちらは #1278 の refusal-line テスト 1 本、main は #1292 の deleted-target テスト 3 本）。共有しているのはファイル先頭の `TARGETS` / `openPicker` ヘルパだけなので両方残した。#1194 のときの `SettingsScreen.tsx`（双方がダイアログを差し込んだ）と同じ形で、**「どちらを選ぶか」ではなく「両方置く」が答えになる衝突が 2 回続いている**
- **auto-merge を信じずに差分で確かめた**: `LinkPanel.tsx` は main 側が chip renderer（`deletedTarget` の表示）・こちらが error 行（NoticePanel 置換）で、行が離れていたので自動で入った。マージ後に `git diff origin/main -- web/src/wikitag/LinkPanel.tsx` を取り、**残差が import 1 行 + 置換 1 箇所だけ**であることを実測して #1306 の変更が消えていないことを確認した（PR #1190 で「コンフリクト解決が実装を丸ごと消していた」事故を踏んでいるので、ここは毎回差分で見る）
- **`NoticePanel.tsx` 本体と `shared/tests/noticePanel.test.tsx` は main 側で無変更**。もう 1 つ両側が触った `shared/src/components/index.ts` は export 行の追加同士で auto-merge され、`NoticeSize` が残っていることを確認した
- **verify は丸ごと取り直した**: ci.yml の verify 15 ステップ + docs-lint をローカルで全緑（web は 105 files / 974 tests）。`briefingEveningLazyMount` が**冷えた vite キャッシュで 1 度落ちた**が、単体再実行と warm での全件で緑 — ログの `environment 9.05s → 0.489s` が冷温の差そのもので、memory に記録済みの既知 flake と同じ挙動だった
- **ついでに open PR 全部を現 main へ dry-run した（`git merge-tree --write-tree`）**: #1305 / #1315 / #1321 / #1327 は b31ee913 ベースのままでも clean、**#1246（#1194 のチュートリアル導線）だけ `en.json` / `ja.json` で衝突する**。依頼のスコープ外なので直さず、こうだいさんに報告して指示待ちにした
- worktree 規約: 解決は実装ブランチ `claude/shared-fix-1278-notice-panel-text-variant` で行い、本 tracker は専用ブランチへ（D-20260801-main-1）。merge commit は main 取り込みで tracker ファイルが混ざるため `[tracker-ok]` を付けている

### 2026-08-30 - [shared-fix] /goal 7 件を PR まで（3 件は Issue が名指したファイルに原因が無かった）

#### 概要

こうだいさんの /goal「7 件すべてを、CI verify のローカル全緑を経て PR open にする」を実行し、**PR #1305 / #1315 / #1321 / #1325 / #1327** の 5 本 + **判断キュー 1 件**（#1279）で全件到達した。#1283 と #1284 は Issue の指定どおり 1 ブランチにまとめてある。全 PR は open のまま（merge は P-001 でこうだいさんの手番）。

**7 件のうち 3 件で「Issue が Scope に書いたファイルに原因が無かった」**。#1283 の「ヘッダー帯」は `AppShell.tsx` ではなく `SectionHeader.tsx`、#1284 の重複した × は `AppShell.tsx` ではなく Desktop と Mobile が**共有する** `RightSidebarContents.tsx`（だから breakpoint 条件が無かった）、#1276 の `repeatFilterHidden` の `t()` 呼び出し元は `ScheduleToolbar.tsx:151` ではなく `CalendarDesktopLayout.tsx:270`。着手前に読み取り専用エージェント 7 体で全件を先に洗ったので、実装前に全部つかまった。

#### 変更点

- **#1264（PR #1305）— 折り返しは「詰めた」結果だった**: 幅 264px の吹き出しフッターに ja の `スキップ`（64px）+ 14 文字の `実際に操作すると次に進みます`（168px）+ カウンタ（27px）で 275px。**flex の既定の答えは「全部を少しずつ縮める」**で、その数 px がカウンタを最後のスペースで割り、CJK は字の間ならどこでも折れるので `スキップ` が字の途中で割れた。固定サイズの 3 つを `shrink-0 whitespace-nowrap` にし、**行に `flex-wrap` を足した** — nowrap だけだと今度は文の側が 13 文字 + `す` 1 文字で折れる（直した見た目より悪い）。en は元から収まるので 1 行のまま。`w-72 → w-80` の幅拡張は却下（全ステップの吹き出しが動くうえ、長い文が来れば同じバグが再発する）
- **#1276（PR #1315）— テストがバグを固定していた**: en を `_one` / `_other` に割り、ja は `_other` へ改名（#1242 / #680 と同じ機械的な形）。**`web/tests/connectScreen.test.tsx` が 7 箇所で `"Untagged: 1 items"` を期待していた** — この suite は意図的に本物のカタログを通しているので、非文法な文字列がそのまま pin されていた。`work.sidebar.sessions` は 4 パッケージ全走査で呼び出し元ゼロを実測し、P-002 で削除（`sessionsProgress` / `targetSessions` は生きている兄弟キー）。`shared/tests/tagHubView.test.tsx` の `${count} items` は**あえて触っていない** — あれは props 注入の `formatCount` スタブで、部品が複数形の意見を持たないことこそ §6.4 の趣旨
- **#1275（PR #1321）— straight swap でも a11y は動く**: Trash の手組みバンド 2 箇所を `NoticePanel` へ。**両方に `role="status"` を明示した** — TrashScreen は元の markup が持っていたので維持（テスト 2 本も `findByRole("status")` で引いている）、TrashView の cascade 警告は元は role 無しで、`warning` の既定 `alert` にするとダイアログ自身の読み上げに割り込んで同じ行を繰り返す。「リファクタは読み上げの挙動を変えない」を通した
- **#1278（PR #1325）— Issue の書き方どおりに実装すると壊れる**: Issue は `variant?: 'panel' | 'text'` と書いていたが、それは既存 `card` / `banner` の**改名**で `OfflineBanner` が壊れる。`variant` の 3 つ目の値として `text` を足した。**`size` prop が要るのは `cn` が tailwind-merge ではないから** — `className="text-xs"` は基底の `text-sm` に CSS 記述順で負け、しかも無言で（#830 の Modal と同じ罠）。`id` prop は `NotePasswordDialog` の 2 つの input が `aria-describedby` で指しているため。新規テスト 2 ファイル分 — `notePasswordDialog.test.tsx` はそもそもテストが 1 本も無く、`linkPanel.test.tsx` のエラー経路も未カバーだった。**`selfLink` ガードは UI から到達不能**（ピッカーの `candidates` が既に `target.id !== itemId` で除外済み）なので、実際に届く「書き込み失敗」でテストを書いた
- **#1283 + #1284（PR #1327）— ファイル重複ゼロなので 1 ブランチ**: #1283 は行の `pt-4`（`pb` 無し）が原因で `self-center` が padding box の中心に落ちていた。行を `min-h-14 md:min-h-15` + 縦 padding ゼロにし、`pt-3 md:pt-4` は**タブ帯を持つときだけ**左カラムへ移した（タブの `-mb-px` 下線が行の `border-b` に重なる仕掛けを壊さないため）。**タイトルも同じ 7.5px ぶん下がっていた**ので、controls だけ中央化すると 2 つが割れる。`min-h-15` は Tailwind v4 の動的スペーシングなので、ビルド後の CSS で `calc(var(--spacing) * 15)` が出ていることを実測してから採用した。#1284 は `closeLabel` / `onClose` をペアで optional にして Desktop が渡さない形に。**`RightSidebarProps.closeLabel` は残さず削除**したので型検査が全呼び出し元を洗い、事前調査が見落としていた `web/tests/workScreenLayout.test.tsx` を捕まえた。`#753` の未保存ガードは無傷（× の `requestClose` と toggle の `toggle()` は別経路ではなく、`toggle()` が open 時に `requestClose` を呼ぶ）
- **#1279 は実装せずキューへ**: `D-20260830-shared-fix-1`（PR #1328 + Issue コメント）。Issue 自身が「1 箇所なら公認 / 3 箇所以上なら部品化」の基準を持っていたので、3 通りの独立した grep で**実測 1 箇所**を確定させた。推奨は A（据え置き）だが、同じ右サイドバーの Todo 削除が既に `ConfirmDialog` 経由という反論（C）も併記。どちらを選んでも残る a11y 欠陥 2 つ（arming でフォーカスが body に落ちる / 問いが読み上げられない）も明記した — A を「見て問題なし」と読まれないように
- **verify の回し方**: 全ブランチで ci.yml の verify 15 ステップ + docs-lint をローカル実行。`web — test` は**冷えた vite transform キャッシュで `briefingEveningLazyMount` が落ちる既知の flake**に 1 度当たったが、温めて回し直すと 102 files / 958 tests 緑（memory の記録どおり）

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
