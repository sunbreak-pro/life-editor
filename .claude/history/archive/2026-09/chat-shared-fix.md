# HISTORY ARCHIVE 2026-09 (chat-shared-fix)

### 2026-09-01 - [shared-fix] #1368 = Todo のチェックボックスを 1 本に寄せた（基準の「Schedule の現行サイズ」は共有部品ではなかった）

#### 概要

こうだいさんの /goal「#1368 を origin/main から切ったブランチ + CI verify のローカル全緑 + PR まで」を実行し、**PR #1395** に到達（open。merge は P-001 でこうだいさん手番）。

Todo のチェックボックスが画面ごとに 3 通りあり、朝刊の持ち越し行では日付欄が可変幅なせいで左端が行ごとにずれていた。`TodoStatusCheckbox` 1 本に寄せ、日付欄を `w-14` + `tabular-nums` の固定列にした。

#### Issue が「基準」と呼んだものは共有部品ではなかった

Issue は「Schedule rightSidebar の現行サイズに揃える」と指定していて、`TodayTodoTray.tsx:163` の `TodoStatusCheckbox` がそれだと読める。**実測すると `ScheduleSidebar.tsx:370` は `onSetStatus` を渡しておらず**、tray は else 側の手書き `size-5`（20px）ボックスを描いていた。共有部品の側が 18px で、基準は 20px。つまり「共有部品に寄せる」だけでは基準に届かず、**部品のほうを 18 → 20px に上げる**のが正しい向きだった。基準サイズを指定された時は、それが本当に指しているコードを先に確定させる。

#### Issue の Scope が指したファイルに、直す対象が無かった（3 回連続で同じ形）

Scope は持ち越し行のレイアウトを `EveningView.tsx:331` と書いていたが、**持ち越し行の実体は `BriefingView.tsx:682` 付近**（EveningView 側の `meta` はタイトルの右にあり、桁ズレの原因になり得ない）。#1283 / #1284 / #1276 と同じ形で、Scope はヒントであって座標ではない。

#### `onSetStatus` が「見た目」と「書き込み先」の 2 つを分岐していたのが根本原因

tray の分岐は「status を書くか completed を書くか」だけのつもりで、実際には**チェックボックスの見た目まで分岐していた**。1 つの部品が 2 つのホストに 2 つの箱を描いていたのはこれ。分岐を書き込み先だけに絞り、`labels.complete` を退役、`status` / `statusLabels` を必須にした。ついでに `row.status` の読み方も「書けるホストだけが読む」に狭めた（binary ホストで古い status がタイトルに打ち消し線を引く穴があった）。

#### Note 本文だけは部品に置き換えられないので、同じ絵をマスクで被せた

ProseMirror が `<input>` を所有していて TipTap の TaskItem がそこに listen しているため、要素ごと差し替えるとトグルを書き換えることになる。lucide の `circle` / `circle-check` を CSS マスクにして同じ 20px で被せ、input・change ハンドラ・保存経路は無変更。**44px のタップ目標はここだけ意図的に入れていない** — 文中に流れる箱なので上下の行のクリックを奪う。#1183 が守っていた「em で持つ」は #1368 が理由ごと置き換えたので、`web/tests/taskListCheckboxSize.test.ts` を shared の定数との lockstep に書き換えた。

#### マスクは、フォーカスリングを黙って切り取る

`appearance: none` + `mask` で描き直したら **フォーカスリングが完全に消えていた**。マスクはグループ効果なので、input に置いた `outline` は border box の外＝マスクの alpha が 0 の領域に描かれ、そのまま切り取られる（`box-shadow` のリングも同じ道をたどるので、Tailwind 風の直し方は「直したつもりで直っていない」状態を作る）。置き換える前はネイティブの箱が UA のリングを描いていたので、純粋な退行だった。リングはマスクの無い `label` 側に置く。

同じ変更で **強制カラー（Windows ハイコントラスト）でも消えていた**。強制カラーはすべての `background-color` を Canvas に固定するが、このマークはその `background-color` そのもの。React 側の部品が無事なのは、マークが `currentColor` の SVG ストロークで `color` は CanvasText に固定されるから。`forced-color-adjust: none` で opt out し、ユーザーのパレット（CanvasText / Highlight）で描く。

どちらも **レンダリングを見るテストでは絶対に捕まらない**（jsdom にレイアウトが無く、切り取られたリングは効いているリングと見分けが付かない）。守りはソーステキストの assertion で、「マスクされた input にリングを戻したら落ちる」1 本を含めた。

#### merge が先に来ると、後追い push は無言で main に届かない（3 度目）

レビューの修正を push した直後に **PR #1395 / #1396 が最初のコミットの時点で merge されていた**。GitHub 側の PR head は `c35d9733` のまま更新されず、`c0aa5201`（a11y 修正）と `69e95cb6`（この履歴の追記）は remote branch の先端に取り残された。**CI もこの 2 本には一度も走っていない**（`gh run list --branch` が最初のコミットしか返さない）。

気付けたのは `git ls-remote` の先端と `gh api .../pulls/N -q .head.sha` を突き合わせたからで、`gh pr checks` は「pass」と答えていた — 古いコミットに対する pass を。**push のたびに PR の head SHA を実測で照合する**。`memory/push-after-merge-strands-commits` に既にある罠だが、今回は「レビュー結果を反映している最中に merge が来る」形で踏んだ。レビューを回している間は、その旨を PR 本文か outbox に先に書いておくほうがよい。

出し直し = **PR #1410**（`claude/shared-fix-1368-checkbox-a11y`・新しい main から cherry-pick・verify 14 ステップ全緑）と本 tracker ブランチ。

#### 変異テストは、当てる場所を間違えると「守りが空振り」に見える

日付欄の守りを検証するつもりで、同じ class 文字列を持つ **予定行の時刻欄** を書き換えていた。テストが緑のまま通ったので一瞬「テストが空振りしている」と読みかけたが、正しい方を壊したら落ちた。変異を当てたら、当たった場所を行番号で確認してから結果を読む。

#### 変更点

- **shared/src/components/TodoStatusCheckbox.tsx**: マークを 18 → 20px。`TODO_CHECKBOX_ICON_PX` として export（CSS 側が読む唯一の数値）
- **shared/src/components/briefing/BriefingView.tsx**: 持ち越し行を `w-14 tabular-nums` の固定日付列 + `TodoStatusCheckbox`（朱）に。`BriefingLabels` に `todoStatus` / `statusNotStarted` / `statusDone` を追加
- **shared/src/components/schedule/TodayTodoTray.tsx**: 手書きボックスを削除。`labels.complete` 退役・`status` / `statusLabels` 必須化・`extra` の字下げを `pl-13` 一本化
- **web/src/index.css**: task-list の checkbox を `appearance:none` + lucide 2 種の SVG マスク + `--todo-checkbox-size: 20px`。2 コミット目でフォーカスリングを `label:has(input:focus-visible)` へ、強制カラー用の `@media (forced-colors: active)` を追加
- **テスト**: 持ち越し行の 1 桁 / 2 桁を両方含む固定列テスト（shared 4 本）・マークの px（shared 1 本）・CSS と定数の lockstep + フォーカスリングと強制カラーの守り（web 7 本に書き換え）。3 本とも変異テストで「直しを戻したら落ちる」ことを実測済み
- **判断キュー**: D-20260901-shared-fix-2 = 朝刊「今日のスケジュール」の Todo 行も揃えるか（#1369 と同じ `<li>` を触るため見送り）

### 2026-09-01 - [shared-fix] #1359 = セクション再生の中断位置（直すべきは Escape ではなく #1194 の封印だった）

#### 概要

こうだいさんの /goal「#1359 を origin/main から切ったブランチ + CI verify のローカル全緑 + PR まで」を実行し、**PR #1376** に到達（open。merge は P-001 でこうだいさん手番）。

Settings のランチャーからセクションを 1 つ選んで始めたツアーを Escape で閉じると位置が保存されない。**Issue が疑っていた Escape の結線は無罪**で、原因は自分が #1194 で置いた `persist` の封印だった。`stopAt` は両経路とも呼ばれ、正しいステップ ID を持って `persist` まで届いていて、そこの `if (partialRef.current) return;` が飲んでいた。

#### Issue の実測表が Escape を疑わせたのは、2 行が同時に 2 つの変数を動かしていたから

比較していた `briefing-intro` は modal 経路（`useDialogA11y`）、`schedule-create-event` は非 modal 経路（`TourOverlay` 自前のリスナ）。**run の種類と Escape の経路が同時に変わっていた**ので、どちらが効いているか表からは決まらない。欠けていた 2 セル（通し × 非 modal / セクション × modal）を埋めたら、書く / 書かないを決めているのは run の種類だけで Escape の経路は両方とも無罪だった。次に同じ形の表を読むときは、まず交絡していないかを見る。

#### 「素直な直し方」を実装して実測したら、通しツアーが壊れた

セクション再生にも `stepId` を書かせる案を実際に当てて測った。`stepId:"b1"` を持つ人が Materials を再生して m2 で Escape すると保存が `m2` に化け、**次の通し起動が最後のステップから開いて、次へ 1 回で `completed: true`**。1 セクション見ただけの人が、見ていないツアーを使い切って初回の自動提示が永久に沈黙する。#1194 が封印した害そのものが裏口から入ってくる形だった。

**しかもこの状態で既存 42 テストが全部緑のまま通る**。#1194 の suite は `next` で歩く経路しか固定していなくて、Escape 経路のストレージを 1 本も見ていなかった。守りのテストは「起きてほしいこと」だけでなく「起きてほしくないこと」を同じ経路で押さえないと、穴が緑で出荷される。

#### 採ったのは「台帳を分ける」

`TourProgress.sectionStepId` を同じ `life-editor-tour-progress` レコードの中に足し、**読み手を `startSection` だけ**にした（通しツアーは一切見ない）。封印は「partial run は何も書かない」→「partial run は自分の栞しか書かない」へ狭めただけで、`persist` 1 箇所のガードのまま。Escape は栞を置き、Skip は消し、最後まで歩くと消え、`restart` は全部消す。DoD 4 の `skipped` は「再生は両方向とも書かない」で決着（Issue が補足で挙げた `startSection` に `persist({skipped:false})` が無い件は、漏れではなく意図）。

#### 3 コンテキストの独立レビューが、自分の修正の中に実 defect を 1 つ見つけた

栞に読み手を付けた `startSection` で `resumedRef` を立て忘れていた。アンカーが消えている再生（ノート未選択でリロードした直後など）が**前進方向に give-up し続けて何も表示せずに終わり、栞まで焼く** — クリックが効かなかったように見える。#1193 の後退リカバリはまさにこのためにあるので、`resumeAt > 0` で立てるようにして回帰テストを 1 本追加した。DoD が求めたテストは 1 本だが、確定した回帰を無防備で出すほうが悪いと判断して 2 本にしている（PR 本文に明記）。

#### 変更点

- **`shared/src/components/tour/types.ts`**: `TourProgress` に `sectionStepId: string | null` を追加（optional にせず必須にしたので、書き手の漏れを tsc が拾う — 実際に `restart` の literal を 1 件捕まえた）
- **`shared/src/hooks/useTourProgress.ts`**: `parseTourProgress` が `stepId` と同じ述語で検証。旧 3 フィールドのレコードは `sectionStepId: null` に落ちるだけなのでマイグレーション不要
- **`shared/src/context/TourContext.tsx`**: `persist` の封印を狭める / `stopAt` を pause・skip で分岐 / `goTo` の完走ブランチで栞をクリア / `startSection` が栞を読み `resumedRef` を立てる / `restart` が栞も消す
- **`shared/src/context/TourContextValue.ts` + `web/src/settings/SettingsScreen.tsx`**: 「partial run は保存を触らない」と書いてあったコメントを実態に合わせた（このリポジトリはコメントを契約として扱うので、放置は defect）
- **守り 2 本**（`shared/tests/tourSectionRun.test.tsx`）: 栞が書かれること + 通しの 3 フィールドが凍っていることを 1 つの `toEqual` で同時に見る本体と、アンカーが消えた再生が先頭へ戻る回帰テスト。**どちらも却下案 / バグ版に差し替えると赤くなることを実測**（ミューテーションで確認。1 回目は `start` 側の同名行に当たって空振りしたので、`lastIndexOf` で狙い直した）
- **検証**: ci.yml の verify 全ステップ + docs-lint をローカル全緑（shared 282 files / 2791 tests・web 107 / 1003・desktop 29・mcp-server 322）
- **`useTourProgress.ts` が GitHub で `Binary files differ` と出る**: main の時点で `stepIds.join("\0")` にリテラルの NUL バイトが入っているため（初出 #1122・offset 3254）。この PR とは無関係なのでスコープ外に置き、`git diff --text` で読める旨を PR 本文に書いた

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
