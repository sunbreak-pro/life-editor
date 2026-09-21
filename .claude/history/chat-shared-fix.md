# HISTORY (chat-shared-fix)

### 2026-09-21 - [shared-fix] #1804 — `aria-busy` の全箇所に目で見える手がかりを足した

#### 概要

`disabled`（押せない）と「処理中」が同じ見た目を共有していた件。**PR #1811**（open・merge はしていない = P-001）。`D-20260905-shared-fix-1 = A` の条件として切られた Issue で、A を選べた理由が「busy 表示の弱さは別 Issue で解く」だったもの。

決めた形は **スピナー + ラベル差し替え + `disabled`（二重送信の防止）を `Button` の `busy` / `busyLabel` の 1 つの口から出す**。同じ 3 点セットを 6 画面が手書きしていたので、形を 1 箇所に集約した。

#### 変更点

- `shared/src/components/Button.tsx` — `busy` / `busyLabel` を追加。`busy` は `disabled` を含意する（既存の呼び出し側が全部 `disabled={busy}` を手で書いていたため、挙動は変わらない）
- `shared/src/components/styleTokens.ts` — `BUSY_SPINNER`（コントロール用）/ `BUSY_STALE`（古い値を残したまま再取得する領域用）の 2 トークン。`BUSY_SPINNER` は `shared/src/index.ts` からも re-export（web の生 `<button>` が使うため）
- `web/src/notes/NotePasswordDialog.tsx` — **手がかりゼロだった唯一の箇所**。スピナーと `labels.busy` を足した。shared の `Button` には寄せていない（寄せると `disabled:opacity-40` が `DISABLED_FILLED_BTN` に変わり、#1803 が保留にしている塗りを勝手に動かすことになる）
- `AuthCard` / `EmailConfirmationCard` / `PasswordResetRequestCard` / `PasswordUpdateForm` / `SettingsProfile` / `AttachmentCleanupPanel`（2 ボタン）— 手書きのスピナーを `busy` プロップへ。見た目は同じで、`LoaderCircle` の import が 5 本消えた
- `DeleteAccountDialog` — ラベル差し替えだけだったのでスピナーが増えた
- `shared/src/components/Analytics/ScheduleTab.tsx` — 再取得中に古い範囲の数字が出たままで印が `aria-busy` だけだったので `BUSY_STALE` で減光
- `shared/src/components/SegmentedControl.tsx` — `aria-busy={disabled}` を削除。`disabled` は「変換中」と「まだ効かない」の両方で渡るのでトラック側では区別できず、実際に走っている唯一のホスト（`FrequencyEditor`）は自分のラッパーで `aria-busy` + `role="status"` を名乗っている
- `.claude/rules/frontend.md` §デザイン規約 — 「`aria-busy` を単独で立てない」を 1 行追加
- テスト: `shared/tests/buttonBusyCue.test.tsx` 新規 6 本 / `web/tests/notePasswordDialog.test.tsx` に送信中の 2 本 / `shared/tests/analyticsRangeFetch.test.tsx` の再取得ケースに減光の assert

#### 判断

- **スケルトンで待たせている箇所（Analytics / TagHub / WorkHistoryList）と TrashView の行、`FrequencyEditor` は変更なし** — すでに目に見える手がかりを持っている
- **`disabled` の塗り自体は触っていない**（#1803・保留中）

#### つまずき

- **この機の Bash ツールはヒアドキュメント内のバックスラッシュを 1 つ食う**。`querySelector(".motion-reduce\:animate-none")` と書いたつもりが `\:` になり、eslint の `no-useless-escape` とテスト 1 本が落ちた。CSS エスケープが要る assert は避け、`getAttribute("class")` を `toContain` で見る形に書き直した（スピナーは `<svg>` なので `.className` は `SVGAnimatedString` で使えない点も同じ理由で注意）
- **`web/tests/` に jest-dom の matcher は入っていない**（`shared/tests/` には入っている）。`toHaveAttribute` は `Invalid Chai property` で落ちるので素の `getAttribute()` で書く。`typecheck:tests` が先に教えてくれる
- **空きメモリが 1.5GB を切ると eslint / vitest が exit 134（OOM）で落ちる**。並行チャットが重いときの偽の赤なので、空きを確認してから回し直す（20GB 空いた状態では 15 ステップ全部が exit 0）

#### 検証

`.github/workflows/ci.yml` の `verify` 14 ステップ + `docs-lint` をローカルで上から実行し全部 exit 0（shared 324 suites / 3306 tests・web 148 suites / 1380 tests・desktop・mcp-server）。実ブラウザでの目視は worktree では回さない規約のため未実施。

### 2026-09-21 - [shared-fix] サイドバー footer の「タグを編集」行を削除（Connect 吸収で nav と重複していた）

#### 概要

左サイドバー footer の「タグを編集」行を削除した。**PR #1794**（open・merge はしていない = P-001）。

#1643 でタグ編集モーダルが Connect セクションに吸収されてから、この行の中身は `setSection("connect")` だけになっていた。nav の「つながり」行と行き先が同じで、同じ列に同じ画面への入口が 2 つ並んでいた状態を畳んだもの。

#### 変更点

- **`shared/src/components/SidebarNav.tsx`**: 行の JSX・`onOpenTagEditor`・`labels.tagEditor`・`TagsIcon` import・`tagEditorLabel` の導出をまとめて削除
- **`shared/src/components/AppShell.tsx`**: 同じ 2 つの prop の通り道（型・分割代入・SidebarNav への受け渡し）
- **`web/src/MainScreen.tsx` / `web/src/hooks/useShellChrome.tsx`**: ホスト側の受け渡しと `shellLabels.tagEditor`
- **`shared/tests/sidebarNav.test.tsx`**: #409 の describe（5 tests）と未使用になった `cleanup` import を削除
- **docs 3 本**（`CLAUDE.md` §8 / `requirements/mobile-scope.md` #9 / `requirements/tier-2-supporting.md` §Connect）: 「wide の導線 = サイドバー行」という記述を現状に合わせた

#### 決めたこと

- **narrow の「その他」シートは残す**。狭幅にはサイドバーが無く、ここが Connect への唯一のクイック導線になる。`nav.tagEditor` の i18n キーも同じ理由で残した
- **prop ごと落とす**（label だけ抜いて口を残さない）。`onOpenTagEditor` は #1643 以降 `setSection("connect")` しか渡されておらず、残すと「サイドバーからも任意の画面を開ける」という嘘の拡張点になる

#### 検証

CI `verify` のステップ（shared / web / desktop / mcp-server）+ `docs-lint` をローカルで上から順に実行し全部 exit 0。集計は `tail` を挟まず変数へ取ってから終了コードを見ている（§7.1）。残った eslint warning 2 件（CommandPalette / UndoRedoContext）は本変更以前からあるもの。実ブラウザ確認は worktree では回せないため chat-main の手番。


### 2026-09-20 - [shared-fix] #1773 ツアーを Escape で中断して再開すると 4/10 に巻き戻る（reveal がタブ選択まで戻していなかった）

#### 概要

5/10 で Escape → リロードすると 4/10 に 1 つ戻る件を直した。**PR #1777**（open・merge はしていない = P-001）。

#1748 の `reveal` は詳細パネルを開くところまで。ところが `schedule-todo-add` と `schedule-todo-board` を持っているのは Todo トレイで、トレイが描かれる条件は「パネルが開いている」**かつ**「Todo タブが選ばれている」の 2 つある。再開時は両方とも初期値（`isOpen` = false / `sidebarTab` = "flow"）に戻るので anchor が無く、probe が 2.5 秒を使い切り、#1193 の後方 give-up が 1 つ前の `schedule-open-todos` に落ちていた。

#### 変更点

- **`shared/src/components/tour/anchors.ts`**: `TOUR_REVEALS.scheduleTodoTray`（`"schedule-todo-tray"`）を新設。「パネルが Todo タブに立っている状態」を指す 1 つの前提
- **`shared/src/components/tour/registry.ts`**: step 5 / 6 を `scheduleTodoTray` に。**step 4（`schedule-open-todos`）は `detailPanel` のまま** — そのタブを押すこと自体がその step のレッスンで、トレイまで開くと代行になる
- **`web/src/hooks/useShellNavigation.ts`**: `requestTodoTray`（`pendingTodoTray` を navigation 抜きで上げる）。ツアーは Schedule に立ってからしか reveal しないので離脱ガード（#753）を通す理由がない
- **`web/src/AppProviders.tsx` / `MainScreen.tsx`**: `onRevealTodoTray` を配線。狭幅の stand-down（drawer z-50 が吹き出し z-45 を覆う）は分岐の手前に置いて新しい名前にも効かせた
- **`shared/tests/tourResumeTodoTray.test.tsx`（新規）**: 実レジストリを歩いて 5/10 で Escape → 再マウントで 5/10 に戻ることを固定。旧ホスト（`detail-panel` しか知らない）で 4/10 に巻き戻る側も 1 本置いて症状自体を pin した
- **`web/tests/tourTrayRevealWiring.test.ts`（新規）**: インテントは実フックで、配線は source text で（AppProviders / MainScreen はフルチェーン無しに mount できない）
- **`TourContext.tsx` は変更なし**。Issue の Scope に入っていたが、reveal の仕組みは #1748 のままで足りた

#### 決めたこと

- **`reveal` の名前を 1 つ足す**（step に 2 つ目のフィールドを生やさない）。step の側から見れば「トレイが開いていること」は 1 つの前提で、2 つに割るとホストが両方を正しい順で解釈する義務を負う
- **タブは直接セットせずインテント経由**。タブは `CalendarTab` の state で、シェルは昔から「頼む」側（`pendingTodoTray`）。しかもインテントの消費側がパネルも開くので、ツアーが要る 2 つが 1 回で揃う
- **狭幅は引き続き辞退**。どのタブが下にあっても drawer がバブルを埋める事実は変わらない

#### 検証

CI `verify` の 15 ステップ（shared / web / desktop / mcp-server）+ `docs-lint` をローカルで上から順に実行し全部 exit 0。集計は `tail` を挟まず変数へ取ってから終了コードを見ている（§7.1）。


### 2026-09-20 - [shared-fix] #1748 Desktop 初回ツアーの Todo 3 ステップを前準備フックで直す

#### 概要

Desktop（幅 1440）の初回ツアーで `schedule-open-todos` / `-create-todo` / `-complete-todo` が一度も表示されず飛ばされる件を、ツアー基盤に前準備を足して直した。**PR #1757**（open・merge はしていない = P-001）。

原因は 3 つのアンカーがすべて `ScheduleSidebar` にあり、そのサイドバーが `RightSidebarPortal` 経由でしか描かれないこと。`RightSidebarContext` は `isOpen` を永続化せず毎セッション閉じて始まるので、`portalTarget` が null のまま 3 ステップとも 2.5 秒の probe を使い切っていた。

| 触ったファイル                                | 中身                                                     |
| --------------------------------------------- | -------------------------------------------------------- |
| `shared/src/components/tour/anchors.ts`       | `TOUR_REVEALS`（`detail-panel` 1 つ）を新設              |
| `shared/src/components/tour/types.ts`         | `TourStep.reveal?: string`                               |
| `shared/src/components/tour/registry.ts`      | Todo の 3 行に `reveal`                                  |
| `shared/src/context/TourContext.tsx`          | prop `onRevealStep`。probe の締切を測る前に 1 回だけ呼ぶ |
| `web/src/AppProviders.tsx`                    | `TourRevealHost`（`useRightSidebarOptional()?.open`）    |
| `shared/tests/tourRevealDetailPanel.test.tsx` | 新規 4 本                                                |

#### 決めたこと

- **候補 A（前準備）を採り、B（パネルを開く 1 ステップ）を落とした**。B は狭幅で成立しない（`MobileDrawer` z-50 が吹き出し z-45 を覆うので、従った瞬間に説明が消える）。さらに `totalSteps` が教えない 1 歩で増える。Issue が「狭幅にも同じ仕組みを」と書いている条件を満たせるのは A だけ
- **`reveal` は文字列でホストが解釈する**。ステップはデータのまま（registry がホストの state を掴む関数を持たない）で、開けるかどうかを知っているのはホストだけ。`onNavigateToSection` と同じ切り分け
- **狭幅では辞退する**。開くとアンカーは見つかるが説明が読めないまま action 待ちで止まる。飛ばされる（従来どおり）より悪い。z 順が直った時点でホストの 1 行を外すだけになる
- **開くのはパネルだけで Todo タブは開かない**。タブを押すことが `schedule-open-todos` のレッスンそのもので、代わりにやると教える対象が消える
- **4 / 5 番目にも `reveal` を付けた**。中断からの再開はパネルが閉じた状態でそのステップから始まるため
- **ホスト側は必須フックではなく `useRightSidebarOptional`**。`web/tests/appProvidersOrder.test.tsx` は Provider をマーカー div に差し替えるので、必須フックだと 3 本が throw で落ちた（実際に 1 回赤にしてから直した）

#### 検証

CI `verify` の 14 ステップ（shared / web / desktop / mcp-server）+ `docs-lint` をローカルで上から順に実行し全部 exit 0。`web/src/schedule/**` は未変更（#1642 の Scope）。

### 2026-09-19 - [shared-fix] /goal 4 件（#1668 / #1667 / #1670 / #1672）をそれぞれ独立ブランチで PR まで

#### 概要

こうだいさんの /goal「4 件それぞれに origin/main からのブランチ + CI verify のローカル全緑 + Issue 参照の PR」を実行。**PR #1691（#1668・実行中にこうだいさんが merge）/ #1697（#1667）/ #1702（#1670）/ #1704（#1672）**。merge は自分ではしていない（P-001）。

| Issue | PR              | 中身                                                                                                                                                                     |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #1668 | #1691（merged） | `undo()` / `redo()` が結果（`{ command, ok, error }`）を返す。投げたコマンドは元のスタックへ戻し反対側へ移さない。Provider に `onCommandFailed`、Host は danger トースト |
| #1667 | #1697           | タグの付け外しを Undo スタックへ。書き込みを `writeAssign` / `writeUnassign` に分け Undo / Redo が再生。TagPicker は失敗で danger トースト                               |
| #1670 | #1702           | `restoreScheduleItemFromTrash` を 1 本の判定にし、Trash 画面と ScheduleItems の両方が通る。楽観更新を撤去                                                                |
| #1672 | #1704           | `<kbd>` 5 箇所を `font-sans` に統一（方針 A）。source scan テストで preflight 任せを 0 に保つ                                                                            |

#### 決めたこと

- **#1668 の失敗コマンドは捨てずに元のスタックへ戻す**。通信断のような一時的失敗なら Undo をもう一度押せば再試行できる。恒久的に失敗し続けるコマンドがあると、その下の履歴には届かなくなる（PR 本文に明記）
- **#1667 の履歴はフック内で `useUndoRedoOptional`**。Notes / Dailies は Provider 側で注入しているが、Issue の Scope が `useWikiTagsUnifiedAPI.ts` と `TagPicker.tsx` の 2 ファイルなので Provider を触らない形にした。注入があればそちらが勝つ
- **#1667 は「すでに付いているタグの付け直し」を履歴に積まない**。サービスが冪等（#1593 の revive）なので何も変わっておらず、Undo でユーザーが触っていないタグを外してしまう
- **#1672 は A（sans）**。B（等幅を明示 + #1468 差し戻し）はサイドバーのラベル省略が戻るため

#### 検証

4 ブランチとも CI `verify` の全ステップ + `LC_ALL=C bash scripts/docs-lint.sh` をローカルで exit 0。終了コードは `tail` を挟まずに変数へ取ってから表示している（§7.1）。

#### 知見

- **gate を一括で回すと vitest が負荷でタイムアウトする**: shared の `weekStartsSunday`（source scan・5s 上限）と web の `briefingEveningLazyMount` が各 1 回落ちたが、単独では shared 3111 件・web 1213 件とも緑。gate スクリプトのテストステップに「失敗したら 1 回だけ再実行」を入れた（#1673 = PR #1692 が lazy-mount 側の暖機を main に入れている）
- **バックグラウンドの bash を TaskStop しても子プロセスが生き残る**: 止めたはずの gate が走り続け、次の実行と同じログへ交互に書き込んで「2 回分が混ざった 1 本のログ」になった。ログ名は実行ごとに変える
- **Toast の variant に `error` は無い**（`info` / `success` / `warning` / `danger`）。`tsc` で初めて落ちた
- **ソース走査テストはコメントも拾う**: `<kbd>` を説明するコメントが検出に混ざったので、走査前にコメントを落とす必要があった

### 2026-09-12 - [shared-fix] #1583 = ツアーの「スキップ」を 1 ステップだけ飛ばす操作に（全体をやめる導線は別ボタンへ）+ #1512 の着地確認

#### 概要

こうだいさんの /goal「#1512 と #1583 それぞれに origin/main からのブランチ + CI verify のローカル全緑 + Issue 参照の PR」を実行。**#1583 は PR #1594**（open）。**#1512 は実装が全部 main に着地済み**で新しい PR は出していない（出すものが無い）。

| Issue | 状態                                                                   | 根拠                                                                                                                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1512 | close 待ち（コメント投稿が分類器に止められた）+ 規約化 = PR #1597 open | PR #1556 merged / 子 #1557〜#1562 全 CLOSED / #1578 = PR #1585 merged（`531b89e6` が origin/main 上）。#1597 = `rules/frontend.md` Gotchas に 44px の当て方 1 項目（`docs/1512-narrow-tap-target-rule`・verify 15 ステップ + docs-lint をこのブランチでも通した） |
| #1583 | PR #1594 open                                                          | `claude/shared-fix-1583-tour-skip-step` = `10ac1a75` + 1 commit                                                                                                                                                                                                   |

#### #1583 で決めたこと

- **`skip` は `next` と同じ機構**（`goTo(index + 1, "walked")`）。違いは「誰が押せるか」だけ — `next` は action ステップで描かれないが、Skip はやりたくない操作を飛ばすための導線なので常に出す。最終ステップの Skip は Done と同じ `{ stepId: null, completed: true, skipped: false }`
- **旧挙動（`stopAt(true)`）は新設の `end` へ**。ラベルは「ツアーを終了」/ "End tour"（`tour.endTour`）。`skipped: true` を書く唯一の経路で、フラグの意味（以後オファーしない）と autoStart のゲートは不変。partial run（Settings の再生）の封印（#1194 / #1359）もそのまま — 再生中の Skip は 1 歩進み、最後まで飛ばすと栞 `sectionStepId` を消すだけ
- **「ツアーを終了」の置き場は進捗カウンタの隣（左）**。右のボタン群（ja「スキップ」+「実際に操作すると次に進みます」= 240px）を変えないことで #1264 の折り返し設計を保つ。左群は `shrink-0` + `whitespace-nowrap` なので最悪でも行が折り返すだけで文字は割れない。Skip / End の両方に `DIALOG_AUTOFOCUS_SKIP`
- テスト: `tourProvider.test.tsx` に describe「Skip passes one step, never the tour」4 件（次へ進む / 最終ステップで完了 / action ステップを操作なしで通る / unmount → 再 mount → `start` で次のステップから再開）、`tourSectionRun.test.tsx` に再生中の Skip 1 件。旧実装では `waitFor("two|run")` がタイムアウトし、End ボタン自体が存在しないので既存の書き換え 2 件も落ちる（role-qa の読みで確認）

#### 検証

verify 15 ステップ + docs-lint をローカルで通した（Monitor で 1 本にまとめ、各ステップの exit code を tail の前に取る）。**mcp-server test の 1 件だけ赤** — `remoteRegistry.test.ts` が `utils\verification.ts` を `utils/verification.ts` と比べており（#1589・2026-09-12 の main）、Windows のパス区切りの問題。`git diff origin/main -- mcp-server` は空。role-qa（ファイル変更禁止で起動）は PASS・確定 defect 0・懸念 5 件のうち docstring 精度 2 件だけ直した。

#### 知見

- **open Issue でも「残りは close だけ」がある**: #1512 は本文の対象が全部着地していて、最後のコメントに close 条件まで書いてあった。/goal の文面は「継続」だったが、着手前に `gh pr list --search` と子 Issue の state を引いたので二重実装を避けられた
- `gh issue close --comment` は auto mode の分類器に「外部システムへの書き込み」として止められる（`gh pr create` / `gh pr edit` は通った）
- python の heredoc で `\v` を含む文字列を書くと垂直タブに化ける（PR 本文の 1 行が `utilserification.ts` になり、`gh pr edit --body-file` で出し直した）
