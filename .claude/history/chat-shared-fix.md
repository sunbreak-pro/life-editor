# HISTORY (chat-shared-fix)

### 2026-09-21 - [shared-fix] /goal 4 件（#1877 / #1875 / #1852 / #1874）をそれぞれ独立ブランチで PR まで

#### 概要

4 件を 1 件 1 ブランチ・1 PR で出した。どれも origin/main から切り、CI の verify ジョブ全 15 ステップ + docs-lint をローカルで上から回して全部 exit 0 にしてから push した。**PR #1880 / #1884 / #1889 / #1894**（全部 open・merge はしていない = P-001）。

#### 変更点

- **#1877 → PR #1880**: `shared/src/hooks/useTourProgress.ts` の `stepIds.join(...)` に**生の NUL バイト 1 個**が入っていた。`file` が `data` と判定するため grep / rg が binary としてこのファイルだけ無言でスキップしていた。2 文字のエスケープ表記へ置換（実行時は同じ 1 文字・`useMemo` の依存キーにしか使わないので保存データに影響なし）。再発防止に `shared/tests/sourceNulByte.test.ts` を新設し、shared / web / desktop の `src` をバイト単位で走査する
- **#1875 → PR #1884**: `shared/src/components/ColorPicker.tsx` の開いたパレットに `w-fit` を 1 つ。パレットは浮かぶポップオーバーではなく通常の流れのブロックなので、幅が無いと親（Settings の Schedule では 712px）を埋め、`grid-cols-6` の 1 セルが 113px になっていた。テストは 2 件（`w-fit` を持つこと・幅クラスが 1 つだけであること）
- **#1852 → PR #1889**: `shared/src/components/Menu.tsx` に「閉じたらフォーカスを返す」処理。返す先は `anchorRef` があればトリガー、無ければ開いた時点の `activeElement`。テスト `shared/tests/menuFocusReturn.test.tsx` 5 件（うち 3 件は修正前のコードで落ちることを実測）
- **#1874 → PR #1894**: 原因は `Modal.tsx` ではなく `shared/src/hooks/useDialogA11y.ts` にあった。戻り先を**エフェクトの中で**読んでいたが、React は子の `autoFocus` を commit 中（= どのエフェクトよりも前）に適用するので、開いた瞬間に自分の中のボタンへフォーカスを移すダイアログでは「パネルの中の要素」を戻り先として記録してしまう。閉じるときにその要素は一緒に消えるので `focus()` が無言で空振りする。戻り先を**開く瞬間のレンダー中**（commit 前）に取るようにし、戻すときは `isConnected` を見るようにした。`CommandPalette.tsx` は `Modal` ではない自前ダイアログで、戻す処理をそもそも持っていなかったので同じものを足した。`dialogFocus.test.tsx` に 4 件追加（うち 2 件は修正前に落ちる）

#### 決めたこと

- **#1874 で `Modal.tsx` を触らなかった**。フォーカスの復帰は `Modal` が呼んでいる `useDialogA11y` が全部持っており、`Modal.tsx` 側に同じ処理を書くと二重になるうえ、同じフックを使う `BottomSheet` と `MobileDrawer` が壊れたまま残る。Issue の Scope は `Modal.tsx` だったので、この差分は PR 本文に書いた
- **#1852 で Tab による close は戻さない**。Tab は「メニューを抜けて次へ進む」ための操作で、トリガーへ引き戻すと逆のことをする。閉じた時点でフォーカスが body 以外にあるときも戻さない（項目からダイアログを開いた場合、そのダイアログが同じ commit 中にフォーカスを取っている）
- **#1875 は prop ではなくクラス**。呼び出し元 2 つはどちらも別の幅を求めておらず、`cn` は tailwind-merge ではないので呼び出し元が幅クラスを渡しても勝てない

#### つまずき

- **この機の Bash ツールはヒアドキュメント内のバックスラッシュを 1 つ食う**（前回と同じ）。`b'\0'` と書いた python のバイト列が NUL 1 バイトになり、NUL を消すはずの修正で NUL が 2 個に増えた。`bytes([92])` で書き直した
- **`screen.getByText("rename")` は `<span>` を返す**。`MenuItem` はラベルを `<span>` で包むので、フォーカス先の比較には `getByRole("menuitem", { name })` を使う
- **verify を二重起動しかけた**。1 本目の完了通知が出たのに出力ファイルが空だったので再実行したところ、実際は 1 本目がまだ走っていた。同じ作業ツリーで `tsc -b` が 2 本並ぶので、2 本目を `TaskStop` で止めてから 1 本目の結果を待った

#### 検証

`.github/workflows/ci.yml` の `verify` 15 ステップ + `docs-lint` を**ブランチごとに**上から実行し、4 本とも全部 exit 0。GitHub 側の CI も #1880 / #1884 / #1889 は緑を確認済み（#1894 は push 直後で実行中）。実ブラウザでの目視は worktree では回さない規約のため未実施 — Connect のタグ行の「…」、Settings の Schedule と Connect のタグ色、ショートカット編集と Ctrl+K が merge 後の chat-main の手番。

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
