# HISTORY (chat-shared-fix)

### 2026-09-05 - [shared-fix] #1408 の findings 3 件（#1468 / #1474 / #1481）をそれぞれ独立ブランチで PR まで

#### 概要

こうだいさんの /goal「3 件それぞれに origin/main から切ったブランチ + CI verify のローカル全緑 + Issue を参照する PR」を実行し、**PR #1493 / #1498 / #1496** に到達（3 本とも open。merge は P-001 でこうだいさん手番）。

| Issue | PR | ブランチ | 触ったファイル |
| --- | --- | --- | --- |
| #1468 サイドバーのラベル省略 | #1493 | `claude/shared-fix-1468` | `SidebarNav.tsx` + テスト |
| #1474 disabled の primary ボタン | #1498 | `claude/shared-fix-1474` | `styleTokens.ts` / `Button.tsx` / `PomodoroSettings.tsx` / `AudioMixer.tsx` + テスト 3 本 |
| #1481 `<html lang>` | #1496 | `claude/shared-fix-1481` | `ThemeContext.tsx` + テスト |

#### 3 件とも Issue の Scope 行が実際の修正先を外していた

- **#1468** は Scope が「`web/src/` のシェル / サイドバー部品」だが、実体は `shared/src/components/SidebarNav.tsx`。DoD 行の `cd web && ...` では **shared に入れた lint / テストが 1 度も走らない**（CLAUDE.md §7.1）
- **#1474** は Scope が「共有 Button 部品の disabled 表現。個別画面の上書きは不要」だが、**報告された 2 つの「保存」は共有 `<Button>` を通っていない**（`PomodoroSettings.tsx` の `SAVE_BTN` と `AudioMixer.tsx` のインライン）。`Button.tsx` だけ直しても報告画面は 1px も変わらない
- **#1481** だけは Scope（`web/src/main.tsx` 周辺の I18n Provider）が近かったが、言語の持ち主は `shared/src/context/ThemeContext.tsx` で、そこは既に `data-theme` / `data-reduce-motion` / root font-size / root font-family という documentElement 副作用を 4 本持っていた。5 本目を隣に足すだけで済んだ

#### #1468 は「バッジ縮小」か「ラベル優先」の片方だけでは足りなかった

DoD は 3 択（バッジの縮小 / ラベル優先 / 省略の解除）を「いずれでも可」としていたが、**1 つでは全フォント段 × 2 ロケールを保証できない**。

- ラベル優先だけ → 今度はバッジが 1 文字も出せない段が出る
- バッジ縮小だけ → どの段で足りるかがフォントメトリクス次第の賭けになる（実際、調査エージェントの px 見積りは step 1 en で ±3px の境界だった）

**譲る順番を固定する**形にした: ラベルは `basis-auto shrink-0` で絶対に縮まない → 足りなければ `aria-hidden` のバッジが省略される → 最後はボタンの `overflow-hidden` が刈る。加えて **バッジが等幅だったのは Tailwind preflight の `code, kbd, samp, pre { font-family: --font-mono }` がそのまま残っていただけ**（誰も選んでいない）ので `font-sans` で降ろし、実際には譲らずに済む幅を確保した。

#### 実測したこと

- **守りが効くことを全 PR で反転実測**: #1468 = flex 契約と `font-sans` を個別に戻すと 1 本ずつ赤 / #1474 = トークンを `disabled:opacity-50` に戻すと 5 本赤 / #1481 = `setAttribute` を潰すと 2 本赤
- **#1474 のコントラスト比をトークンから計算**（light / dark）: 無効ラベル 3.72 / 4.90、**新しい塗り vs カード面 1.07 / 1.21** — この 3 桁目がリングを必須にしている（塗りだけだとボタンの箱がカードに溶ける）
- **ビルド後の CSS に新ユーティリティが実際に出ていることを確認**: `disabled:bg-lumen-surface-sunken` ほか 7 本、および #1468 の `.font-sans{font-family:var(--font-sans)}`。**`font-sans` は 1474 ブランチのビルドには 0 件・1468 ブランチのビルドに 1 件**で、スキャン経由で生成されていることまで確定できた（未生成なら無言で無色になる）
- `origin/main` に対しても **15 ゲート全緑のベースライン**を先に取った。以降の赤は自分の変更由来と断定できる状態で作業した
- 各ブランチで CI verify 15 ステップ + docs-lint をローカル全緑。終了コードは **`| tail` に通す前に変数へ取って取得**（CLAUDE.md §7.1 の罠）

#### 独立レビュー（並列 9 エージェント）が自分の作業ツリーを読んで blocking を出した

調査 3 + 批評 6 の並列ワークフローを回した。**批評の 1 本が、実装済みの作業ツリーを読んで blocking を 1 件確定させた**: ラベルを `shrink-0` にした結果、ボタンにも footer の div にも `overflow-hidden` が無いため、**将来ロケールで文言が伸びると `w-60` の aside の外＝本文ペインの上に描画される**。ボタンに `overflow-hidden` を足して塞いだ（`overflow` は子孫だけを刈るので focus リングは無傷）。

ほかに採用した指摘: テストの置き場を `web/tests/` から `shared/tests/` へ（変更が shared 完結なので配置表と逆だった）/ `themeContext.test.tsx` の `beforeEach` に i18next シングルトンのリセットを追加（`setLanguage` がモジュール状態を書き換え、Provider の既定値がそこから導出されるため、リセットが無いと以降のマウントが全部 ja で起動する）/ collapsed 行のテストを「#1468 の柵ではない」と正直に書き直した（className だけの差分なので修正前も緑）。

#### 運用メモ

- **`git push` が Git Credential Manager の対話を要求して失敗する**。`git -c credential.helper='!gh auth git-credential' push` で通した（この機は `gh auth setup-git` が未実行）
- worktree 規約: ブランチを切るたび `.claude/comm/.session-branch` を更新（4 回）。tracker / outbox / decisions は実装ブランチに載せず本コミットの専用ブランチへ（D-20260801-main-1 / D-20260802-sched-1）

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
