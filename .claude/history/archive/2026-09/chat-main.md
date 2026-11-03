# HISTORY archive 2026-09 (chat-main)

### 2026-09-19 - 他レーンの受信を実測で裁く → #1677 の依存解除・#1679 を実ブラウザ確認して close

#### 概要

connect-refine-d3 と materials-refine-d7 から受信 4 件。報告はすべて `origin/main` で実測してから裁いた。#1676 の着地を確認して #1677 の依存を解除し、materials の次の 4 本を確定。溜まっていた chat-main の手番のうち #1679 を実ブラウザで確認して close した。

#### 変更点

- **#1677 にコメント**（`issuecomment-5739197309`）: 依存 A が解除された旨と、使える部品 3 つの import 元・責務境界
- **#1680 / #1674 を close + #1722 / #1723 を起票**: どちらも DoD は全項目 PASS だが、#1680 の実装が狭幅で新しい不具合を生んでいた
- **#1671 を close**（`issuecomment-5740202141`）: 4 項目とも合格。レポート = `.claude/docs/reports/2026-09-19-issue-1671-mobile-verify.html`（Artifact v1 = https://claude.ai/artifact/GViM22WEXXGeFkximaYQLm・スクショ 5 枚を `shots/` で同梱）
- **#1679 を close**（`issuecomment-5740155396`）: DoD 全項目 PASS。ローカル main を 7 コミット遅れから `0d508a86` へ ff、dev server + `playwright-ui-verifier` で実測

#### 実測・知見

- PR #1685 は 2026-09-17 14:11 UTC merge・#1676 は CLOSED・#1677 は OPEN（`section:materials`）
- 部品は `shared/src/components/TagHub/` に実在し、`shared/src/index.ts:833` → `components/index.ts:476` → `TagHub/index.ts` の `export *` 3 段で `@life-editor/shared` から届く
- `TagActionsMenu` の責務境界がコード側で明示されている: 削除は「要求」でホストが確認レイヤーを持ち、識別系 3 項目は `TagHubEditField` を返すので `TagHubEditBlock` にそのまま渡せる
- **materials レーンの次の 4 本を確定**（issue-prompter で実測）: 未着手 = #1677 / #1687 / #1688 / #1689（4 本とも依存宣言なし）。除外 = #1680（PR #1693 open）/ #1674（PR #1699 open）/ #1679（PR #1683 merged だが Issue は open）
- 🛑 **#1679 は chat-main の手番**: PR #1683 の本文が「Not checked in a real browser. worktree policy keeps playwright on chat-main」と明記。DoD の「Desktop 幅で全項目が押せる」を実ブラウザで確認してから close する（PR は `Refs #1679` なので自動 close されていない）
- **#1679 は PASS**（実測値）: Daily エディタカードの computed `min-height` = 270px（`min-h-60` = 15rem × root 18px）・`min-h-0` は残存なし。本文が空の日でカード下端 y=414 に対しメニュー下端 y=281 = **余白 133px**。viewport 高さ 700px でも 270px を維持。`elementFromPoint` で各行の中心と下端 3px 手前を叩いて最前面を確認。Mobile 390x844 では kebab がカード外のヘッダー行にあり `overflow-hidden` の影響を受けない。6 セクション巡回で console error 0
- ⚠️ **#1679 は構造としては直っていない**: `Menu` が portal されずカード内に描画される形は修正前のまま。**項目が 3 行を超えると再発する**（現状の余白 133px が 36px 行 3 つ分）。再発時は min-height を積まず portal 化を検討する、と Issue に申し送り済み
- **#1671 も PASS**（390x844・dark・実データ）: #1516 = 末尾 9px の輝度が 400 → 11 で地色に溶ける（`mask-image` 実測 = `linear-gradient(to right, rgb(0,0,0) calc(100% - 9px), rgba(0,0,0,0))`）/ #1515 = スクロール容器が 331 対 331 で祖先に横溢れゼロ（起票時は 339 対 331）/ #1558 = 4 要素とも 49.5x49.5、gap 中央（x=243 と x=263.3）は容器が返り隣を誤爆しない / #1517 = 4 タブの y が 371.4 で揃い高さ 33。console error 増分 0
- **再起票しなかった所見 2 件**（Issue にコメント済み）: ドロワーのタブ帯は 98.3x33 で 44px 床の対象外（`::after` が `content: none`）/ 「Move to today」は `opacity-0` + `group-hover` でデスクトップ Chrome では見えず、`[@media(hover:none)]:opacity-100` の実機挙動はこの環境で確認できない
- **chat-main の実ブラウザ手番を棚卸しした**（merged PR × open Issue の突き合わせ）: `gh pr list --state merged --limit 120` の**タイトル**に Issue 番号を持つものだけを数え、tracker / outbox / docs ブランチの PR 37 本を除外すると 6 件。うち実ブラウザ待ちは #1680 / #1674（本文に "Not checked in a real browser"）と #1637 / #1638（PR 本文の未チェック項目に「実ブラウザ（chat-main）」）。残り 2 件は正常な open（#1644 = 2 本目の PR 待ち / #1642 = リファクタリング継続中）
- **突き合わせは PR タイトルで絞る**: 本文の `#<n>` を拾うと tracker PR が「今日触った Issue」を列挙するため誤検出が 15 件まで膨らむ。実装 PR は `fix(x): ... (#1679)` の形でタイトルに Issue を持つので、タイトルだけ見ると 6 件に落ちる
- 🛑 **#1637 / #1638 の残項目**: #1637 = チップのバブルと Todo 詳細の両方から変換 → Undo → Redo、あわせて「変換 → 別セクション → 戻る」で Undo が消えるか（計画書 #1642 の B-01 = Schedule の Provider が unmount で履歴を全部消す形が 5 本ある）。#1638 = 計画書 §6 の S11 / S12（各操作の直後に Undo → Redo・繰り返しでダイアログが出る）
- **#1722 の再実測は合格 → close**: 360 / 390 / 430 の 3 幅で星グループ右端 297.7 がカード右端（342 / 372 / 412）の内側、星 1 個 49.5x49.5 で 44px 床を維持、`elementFromPoint` で 5 個とも中心が自ボタン。1440 は横 1 行のまま（見出しと星の中心 y の差 3px 未満・星 31.5px）。**読み取り専用カードは呼び出し元が存在せず画面から到達できない**（`DailyView.tsx:672` が常に `onSelectMood` を渡す）
- **Connect Step 12 を通した → BLOCKING 2 件 + 設計差分 3 件を起票**: #1732（右パネルを開いたまま複数選択すると選択バーが崩れる。中央カラム 590px で en は 2 行折り返しでボタンの塗りから文字がはみ出し、ja は「2 件を選択中」が「2 …」に切り詰め。**en と ja で壊れ方が違う**）/ #1733（Mobile のエラートーストが下部タブバーに重なる。タブバー上端 783.6 に対しトースト下端 826）/ #1734（設計差分 3 件 = Mobile 上部バーが M1 と違う・リンク追加シートに「候補（N）」が無い・トーストのアイコンが AlertCircle でなく丸ドット）
- **一括操作 10 件の体感を実測**（計画書 §Risks の宿題）: タグを付ける = 件数反映 2,881ms / DOM 3,744ms、外す = 件数 45ms（楽観更新）/ DOM 2,447ms。選択は直後に解除され Untagged 34 → 24 → 34、開発 9 → 19 → 9 と往復。**「詰まる」とまでは言えないが、押した直後に何も変わらない時間が 1 秒以上ある**。進捗表示は無い
- **計画書は `.claude/archive/2026-09-14-connect-tag-link-workbench.md`**（Status COMPLETED で archive 済み）
- ⚠️ **#1715 は CI 緑でも merge しない**（schedule-refine からの申し送り + `git merge-tree --write-tree origin/main origin/claude/schedule-todo-tab-filter-1641` が **exit 1** で実測）: #1640（PR #1712）がトレイ上の単一作成ピルを廃止して見出し 2 か所へ移したのに対し、#1715 はその行がある前提でフィルタ行を作る。merge すると「+ Todo」ピルが 2 つ・ツアーアンカー `schedule-todo-add` も DOM に 2 つ・`web/tests/scheduleSidebar.test.tsx:431` が落ちる。**CI のチェックは古い base の上で走るので、緑は「いまの main と合う」を意味しない**
- **08:05 UTC 時点の着地**: Connect の 4 本（#1696 / #1698 / #1703 / #1709）と #1714 / #1710 が全部 merged。materials も #1687 / #1688 / #1713（#1677）/ #1720 が merged。**Connect ワークベンチが揃ったので Step 12 の実ブラウザ検証が chat-main の手番になった**
- **#1722 は materials が PR #1724 で修正**（実測から 30 分）: 狭幅だけヘッダーを `flex-col` にして星を独立した行へ出し、`md:` 以上は元の `flex-row` + `justify-between` に戻す。切り替えは `onSelectMood` の有無なので読み取り専用カードは 1 行のまま。44px 床は維持し、保険の `flex-wrap` も追加。**再実測（360 / 390 / 430）は merge 後の chat-main 手番**
- 🔴 **#1722 起票（#1680 の回帰）**: Mobile 幅で夕刊カードの気分の星 5 個のうち 1〜2 個が画面外に出て押せない。`DailyEveningCard.tsx:71` の `MOOD_STAR_BUTTON` が `max-md:min-h-11 max-md:min-w-11` を持つため狭幅で 1 個 50px になり、5 個のグループ 256.5px が見出し（右端 167.9）と `justify-between` で並んでカード（右端 372）をはみ出す。親が横スクロールを出さないので到達不能。実測 = 360 で 82px 超過 / 390 で 52px / 430 で 12px / 540 以上は収まる。**読み取り専用の `<span>` + 15px アイコン（約 83px）なら収まっていた = #1680 で入った差分**
- **#1723 起票（既存・データ損失なし）**: 夕刊だけの日で `stripEveningSection` が `content: []` の doc を返し TipTap のスキーマ検証に落ちる（警告 2 本）。**本文も夕刊も壊れない**ことを実測とコード両方で確認 — `DailyView.tsx:382` の `handleEditorUpdate` が保存前に `mergeEveningSection` で夕刊を戻す安全弁を持つ（`:378` のコメントが明言）。実害はコンソールのノイズだけ
- **#1680 の検証で触った値はすべて戻した**: 9/12 の気分をなしへ・9/10 を 2 へ・振り返りの文字数も元どおり（326 文字）。Daily 8 件 / Notes 20 件のまま増えていない。アップロードは 5 回とも Supabase に届く前に abort したので Storage にオブジェクトは無い
- **IME は CDP で代替確認した**: `Input.imeSetComposition` で変換中にして `keyCode 229` の Enter を送り、段落数が変わらないことを実測。**macOS WebKit の「`isComposing: false` + `keyCode 229`」経路は Chromium では再現できない**ので、そこは未確認のまま残る
- **connect-refine が 4 Issue 分の PR を open にした**（#1643〜#1646 のうち残り 3 Issue）: #1644 = PR #1696（一括タグ API + タグ統合）と PR #1698（複数選択と選択バー）、#1645 = PR #1703（右パネルの近傍モード）、#1646 = PR #1709（Mobile 3 段 + docs 追随・計画書は COMPLETED で archive 済み）、tracker は別枠の PR #1710。**merge 順は #1714 → #1698 → #1703 → #1709 → #1710**（全部 base = main だが後ろが前を含む）。固有分は 571 / 680 / 980 / 844
- **#1696 は 07:16 UTC に merge 済み**（`e432edeb`）。`connectScreen.test.tsx` の race 修正（PR #1714 = `await waitFor` で 9 行）を 4 本に cherry-pick する作業より merge の方が早く、**#1696 だけ +571/-1 のまま = main に race が残った**。#1698 以降は +9 が乗っている
- ⚠️ **squash merge と「前を含む PR」の組み合わせ**: #1698 の差分は #1696 の内容を丸ごと含むが、main 側は squash で SHA が別物。同じ変更を再適用する形になるので、前の PR が merge されるたびに取り込みと衝突確認が要る
- **CI が走らない PR がある**: #1698 / #1703 / #1709 は `statusCheckRollup` が 0 件（起動した形跡なし）。#1710 は FAILURE のまま。**行数と CI は別々に見る** — 「4 本とも緑」と読んだ最初の実測は、checks が 0 件の PR を「bad none」と数えていた
- **CONFLICTING は connect-refine が解消し、ロケール合流を実測で裏取りした**: 3 本とも MERGEABLE に戻り CI も起動。衝突の本体は `ConnectScreen.tsx` / `TagHubView.tsx` / `TagHub/index.ts` / `connectScreen.test.tsx` とロケール 2 本で、コードは「こちらが main の上位集合」として自分側を採用。**危なかったのはロケール**で、自分側を採用した最初の解消では main が先に得ていた 23 キー（`materials.daily.evening*` / `scheduleScreen.undoRepeat*` / `work.history.*` / `attachment.uploading`）が消え `DailyView.tsx` の `t()` が型エラーになっていた。main を土台にキー単位で合流し直したとの報告を実測し、**「main にあってブランチに無いキー」は en / ja とも 3 本すべてで 0 件**
- **`_one` サフィックスの en-only は欠損ではない**: i18next の複数形で、英語だけが one / other の 2 形を持つ。main の時点で 8 件あり #1698 で 2 件増えた（`connect.selection.failed_one` / `selected_one`）。**ja にあって en に無いキーは全ブランチ 0 件**なので、i18n の両 catalog 不変式は守られている。キー数の左右差を見ただけで「片側漏れ」と判定しない
- **main 取り込みで行数が実態に落ちた**: #1698 = +1260 → **+695**（900 行の目安を下回った）・#1703 = +2240 → +1675・#1709 = +3084 → +2520。前の PR の内容が差分から抜けたため
- 🛑 **chat-main の手番が 2 つ増えた**（4 本の main 着地後）: 計画書 Step 12 の実ブラウザ検証（1440×900 の 1a〜2f と 390×844 の Mobile 1a〜1l・light / dark）と、一括操作 10 件の体感実測
- **判断キューは作業コピーに現れない経路で積まれていた**: connect-refine は D-20260919-connect-1 を tracker PR #1710 に載せたので、merge されるまで `.claude/comm/decisions/chat-connect-refine.md` は「open エントリ無し」のまま。指摘して PR 本文へ全文を貼ってもらった。**tracker PR に積んだ判断は merge されるまで誰の目にも触れない** — 急ぐものは PR 本文に貼る
- **D-20260919-connect-1**（Mobile 上部バーに「＋」を置くか）: 推奨・放置時とも A = 現状維持。narrow ヘッダーは shell の形状 enum で、末尾アクションを足すと `MainScreen.tsx`（#1646 の Scope 外）に触るため。レール下端の追加行が narrow でも入口として出ている

### 2026-09-16 (2) - outbox 棚卸し → 起票 8 本（#1667〜#1674）+ 依頼 1 件を実測で差し戻し

#### 概要

ユーザー依頼 3 本（「リモートを取り込んで現状把握 → `issue-prompter`」「各チャットからの起票依頼を確認」「このセッションで起票」）。outbox 21 本と判断キュー 12 本を全数読み、未処理の起票依頼 10 件を裁いて 8 件を Issue にした。依頼が挙げた `file:line` は全件 main で実測し、1 件（F-05）はコードが前提を否定したので起票せず差し戻した。

#### 変更点

- **起票 8 本**: #1667 タグの付け外しが Undo に載らない（A-01）/ #1668 Undo 失敗でも成功トースト（B-10）/ #1669 MCP の削除が dismiss を通らない（E-12・宛先 `[mcp-tools]`）/ #1670 Trash 復元が #932 のロールバックを通らない（F-07）/ #1671 #1409 の schedule 分の実ブラウザ確認（`[main]`）/ #1672 `<kbd>` 5 箇所の書体（shared-fix）/ #1673 briefingEveningLazyMount の flake（briefing）/ #1674 添付アップロードの進捗表示（materials）
- **レポート**: `.claude/docs/reports/2026-09-16-outbox-triage.html`（Artifact v2）。起票結果・差し戻しの根拠・未回答の判断 4 件・night-safe の 6 件を 1 枚に集約
- **issue-prompter**: セッション冒頭で回して 2 レーンへ `/goal` を提示したが、直後にユーザーが 8 PR を merge したため失効した（W0 / W1 / W2 / W7 / W11 と #1643 が全部着地）

#### 実測・知見

- **F-05 は前提が 2 つとも否定された**: `web/src/briefing/hooks/useBriefingWrites.ts:65-66` が `useUndoRedoOptional()` を持ち、予定（`:305-316`）と Todo（`:416-424`）の削除は undo を push している。routine 系に undo が無いのは `:336` が「Schedule も同じくスタックに載せない（cascade は 1 行の再挿入で戻せない）」と理由つきで明言。`fillUpToAnchor` は関数として存在せず `useScheduleItemsRoutineSync.ts:147` のコメントにあるだけで、`:332-334` が「紙面の anchor は常に表示中の日なので fill は定義上 no-op」と書いている。**outbox の起票依頼でも file:line を実測してから起票する** — `rules/docs-consistency.md` §5 はサブエージェント報告だけの話ではない
- **B-10 は依頼より 1 段悪かった**: `shared/src/utils/undoRedo/UndoRedoManager.ts:57` の docstring は「reported via onError」と書くが、`onError` は repo のどこにも配線が無い（`git grep onError` の一致がこのコメント 1 行だけ）。失敗は完全に無音
- **古い起票依頼は全部処理済みだった**: 2026-07〜08 分を Issue 一覧 300 件と突き合わせ、#1001〜#1008 / #1097 / #1220 / #1615 に着地済みを確認。未処理は 09-02 以降の分だけ
- **`gh issue list --state open` は数分で古くなる**: 最初の一覧で open だった #1643 / #1632 が、`--state all` を引いた時点では CLOSED になっていた。PR merge が Issue を閉じたためで、**配布判断の直前に open 一覧を取り直す**

#### 次

- 🛑 ユーザー手番: 未回答の判断 4 件（`D-20260905-shared-fix-1` / `D-20260902-tags-1` / `D-20260902-tags-2` / PR 行数目安の読み替え）と migration 0029 / 0030 の適用確認
- F-05 の差し戻しを schedule-refine の outbox へ伝えるかは未判断
- 新しい手番 = connect-refine が #1644、schedule-refine が W3 / W4 / W6 / W9 / W12

### 2026-09-16 - Connect ワークベンチ計画の Steps 0 — docs PR #1647 + 実装 Issue 4 本（#1643〜#1646）

#### 概要

ユーザー依頼「`2026-09-14-connect-tag-link-workbench.md` の Steps #0 を実行して」。計画書の分担表 順 2〜5 を `section:connect` で起票し、表の「未起票」を Issue 番号に置き換え、#1631 にスコープ注記をコメントした。あわせて、計画書・brief・裁定が chat-main の作業コピーに未追跡のまま置かれていた（worktree から読めない）ので、先に docs PR #1647 で main へ載せた。セッション冒頭では `issue-prompter` を回し、schedule / connect / settings の 3 レーンへ `/goal` を提示している。

#### 変更点

- **docs PR #1647**（`chore/docs-connect-workbench-plan`・一時 worktree `docs-connect-workbench` 経由）: 計画書 + `briefs/connect-relations.md` 新設 + `briefs/connect.md` を SUPERSEDED + `_COMMON-CONTEXT.md` v4.1 + `decisions/D-20260912-main-1.md` + 再定義レポート HTML。コード変更ゼロ
- **起票 4 本**（すべて `section:connect` + `type:feature`）: #1643 タグ編集の統合（D1〜D7・D15・D16）/ #1644 複数選択・一括タグ操作・タグ統合（D8〜D11・D14）/ #1645 右パネルの近傍モードとリンク（D12・D13）/ #1646 Mobile 3 段（M1〜M10）。DoD は計画書の Steps と Acceptance から機械検証できる形（`git grep` 0 件 / 個別テストの緑 / verify 全ステップ exit 0 / PR 行数上限）へ落とした
- **計画書の追随**: 分担表の「未起票」4 箇所を #1643〜#1646 に置換、Status を Draft → IN PROGRESS
- **#1631 へコメント**: タグ編集パネル側の表示は #1643 でパネルごと退役するため、#1631 は Connect 側だけを直す

#### 実測・知見

- **`records.mjs check` が docs PR を止めた**: `D-20260912-main-1` は `status: answered` なのに `comm/decisions/ANSWERS.md` に回答行が無かった。台帳へ昇格したとき回答簿の 1 行を書き忘れると、次に触った PR が落ちる（D ファイル単体では気付けない）。1 行追記して解消
- **`git show <branch>:<path>` は Git Bash でパス変換に食われる**: `origin/chore/...:.claude/...` がバックスラッシュ混じりの 1 引数へ変換され `ambiguous argument` になる。`MSYS_NO_PATHCONV=1` + `MSYS2_ARG_CONV_EXCL='*'` を付けると通る
- **chat-main の作業コピーに未追跡 docs を置いたままにしない**: worktree レーンからは読めず、計画書側も「絶対パスで読むか、先に docs PR で main に載せる」と但し書きを持つ羽目になっていた。main へ載せた後、重複していた作業コピー 6 本は片付けた（tracked 2 本は `git checkout --`、untracked 4 本は削除。内容が push 済みブランチと一致することを `diff` で確認してから）

#### 次

- レーンの着手順は #1631 → #1643 → #1644 → #1645 → #1646。順 2 以降は stacked 可だが、base が main 以外の PR は merge 後に main 着地を実測する
- 🛑 ユーザー手番: PR #1647 の merge（P-001）

### 2026-09-07 - macOS 実機受け入れ（#1301 Step 8）通過 — 移行 SSOT の Phase 3 完了 + 未署名起動の条件を訂正

#### 概要

ユーザー依頼「mac でのアプリ化や実機検証を進めたい。古いアプリの方は削除して OK」。**ローカルビルドを選ばず**、2026-09-05 の run 33958069275 が残していた `desktop-macos` artifact（`Life Editor-0.1.0-arm64.dmg`・99 MB・9/19 まで有効）を Apple Silicon 実機に入れて受け入れを通した。判断根拠は 2 つ — 実 DMG 生成は数 GB 食い、空き 15 GB のこの機械では枯渇で Bash ごと止まる事故歴がある（memory `electron-dmg-disk-exhaustion`）／ `desktop/README.md` 自身が「配る物そのものを受け入れる」と定めている。結果、**移行 SSOT の Phase 3 完了判定 3 項目が全部埋まった**。docs 追随 = PR #1565 open。

#### 変更点

- **旧アプリの始末**: `/Applications/Life Editor.app` は**旧 Tauri 版**と特定して `~/.Trash/Life Editor (tauri-2026-05-16).app` へ退避（`com.lifeEditor.app.newlife` / 26 MB / `Contents/Frameworks` 無し / 2026-05-16。新 Electron 版は `com.life-editor.app` / 244 MB / Electron Framework あり）。**`cp -R` は既存 bundle を置き換えない**ので、退けないと古い方が残り続ける — README の受け入れ手順に明記した
- **通した項目**: `hdiutil attach` → `/Applications` → 起動（**警告ゼロ**）→ **プロセス 4 本**（main / GPU / network utility / renderer = #545 の基準）→ サインインカード描画 → ネイティブ Menu → `app.asar` に本番 Supabase ホスト（packaging を跨いで生存）→ **Dock アイコンが `resources/icon.icns` 由来**（#1301 の «icns が実際にアイコンになるか» が実測で埋まった）→ **メニューバーのトレイ常駐**（`extraResources` + `process.resourcesPath` の prod 経路が効いている = `2026-06-19-step1-desktop-daily-driver.md` Risks 1 行目の懸念が解消）→ **ログイン → 全 Section 表示**（ユーザー目視）
- **訂正した知見（ここが本題）**: README と計画書 R1 の「未署名だから Apple Silicon で拒否される」は**条件が 2 つ抜けていた**。① 拒否は `.dmg` に `com.apple.quarantine` が付いている時**だけ**起きる（Gatekeeper はこの検疫フラグを見て評価に入るので、無ければ評価自体が走らない）。付けるのは LaunchServices 経由 = **ブラウザ / Mail**、`gh run download` / `curl` は付けない → **Release から落とす配布先は全員が当たり、CI artifact を触る開発側は一生見ない**という非対称がある ② 署名は「無い」のではなく **ad-hoc（linker-signed）が実在**する（`codesign -dv` → `Signature=adhoc` / `Sealed Resources=none`。Electron 本体のバイナリがリンカ由来の署名を持つ）。`spctl -a -vv` は `code has no resources but signature indicates they must be present` で reject — **「署名が無いから落ちる」ではなく「壊れた署名として落ちる」**が正確
- **事故 1 件（手順に反映）**: 残っていたログイン確認を自動化しようとして `System Events` の座標クリックを 1 回撃ったところ、**フォアグラウンドが Life Editor ではなく無関係なアプリの購入画面**で、そこに落ちた（購入ボタンとは別座標のため実害なし・即中止）。`activate` はその後もフォアグラウンドである保証にならない。**macOS で画面全体対象の合成クリックは使わない**。観測は `screencapture` + `pgrep` で足り（受け入れの 4 項目はこれで測れる）、資格情報が要る確認は人手に返す
- **docs（PR #1565・4 ファイル）**: 移行 SSOT の Phase 3 チェックボックス群 + 完了判定 3 項目 + Status 行 / packaging 計画書の Status・Step 8・AC・R1・Worklog / step1 計画書の Mac ゲート（トレイ常駐だけ消化・`[~]`）/ `desktop/README.md`（macOS の受け入れコマンド・mac 限定チェック 7・8 = Dock アイコンとトレイ・合成クリック禁止・quarantine の条件・ad-hoc 署名の実態）。`LC_ALL=C bash scripts/docs-lint.sh` exit 0
- **残り = 🛑 ユーザー手番 2 つ**: ① `git tag desktop-v0.1.0 && git push origin desktop-v0.1.0`（draft Release に `.dmg` / `.exe` が載って #1300 / #1301 の DoD が埋まる）② Windows 実機での実アカウントログイン + Todo CRUD。**Linux AppImage の実ビルドだけ未実測**（`release-desktop.yml` に linux ジョブが無い・宣言だけある。起票要否は未判断）

### 2026-09-06 - open Issue 33 件を 9 レーンへ /goal 組み立て + 同日 merge の Mobile 修正 6 本を実ブラウザ検証

#### 概要

ユーザー依頼「現状の把握 + issue-prompter でプロンプト作成」→「chat-main で実行できることを一つ」。`issue-prompter` で open 33 件（open PR 0 本）を 9 レーン 23 件の `/goal` に束ねて表示し、続けて同日に main へ merge された Mobile 幅点検の修正 6 本（#1485 / #1513 / #1520 / #1524 / #1525 / #1527）を `playwright-ui-verifier` で runtime 検証した。結果は PASS 5 / N/A 1、console error 増分 0（0029 起因の 400 は除外）。各 Issue に実測値をコメント。

#### 変更点

- **/goal 配布**: settings 2 / analytics 2 / materials 4 / schedule 5 / briefing 2 / work 1 / connect 2 / tags-docs 1 / shared-fix 2（#1521 + #1512 の共有部品分のみ）/ refactor-core 1（#1388）。采配残 = #1526（`section:settings` と `section:tags` の 2 ラベルで宛先が割れる）/ #1300（コードは main 着地済み・残りはリリース workflow の初回実行と実機受け入れ = 人手）/ #1301（#1300 の着地が前提）/ #1408 #1409 #1335（`[main]`）/ #1121 #716（`[all]` Epic）/ #898 #677（frozen）。#1512 の画面別分は共有部品の着地後に section ごとへ割り直す
- **実ブラウザ検証（main 8560feda・vite 5173 の先客を流用）**: #1513 = ロゴ `word-break: keep-all`・scrollWidth 343 = clientWidth・「夕」「刊」同一行（UI 言語が en だったので ja 文字列は同一要素へ一時差し替えて計測）/ #1520 = ルーチン 0 件で N/A / #1524 = **migration 0029 が本番未適用（remote 最新 0028）で `timer_sessions` が 400 = 本物の 1 系統失敗**のもと status 要素「Some data could not be loaded (work sessions)…」が出て Todos 5 / Notes 8 など他系統が生存 / #1525 = カテゴリ選択でドロワー 332px が閉じ、ペイン width 390 / #1527 = 行タイトル width 260（旧 111）・2 段構成 / #1485（1280×800）= Todo 作成 → ヘッダー Undo で消え、リロード後も復活なし（soft delete でゴミ箱行き = 設計どおり）。検証データ `verify-1485` はゴミ箱から完全削除済み
- **副産物（未起票）**: ノート表示で warning `[web RichTextEditor] TipTap content schema error: Invalid JSON content` が複数回出る。#1521（callout ノード欠落で本文破棄）と同根の可能性があり、#1521 の着地後に再確認する
- **環境メモ**: ローカル `chore/tracker-main-20260906`（origin にも存在）は PR #1530 と同じ 18 行の差分しか持たない残骸で、PR 不要。worktree `docs-1409-report` / `plan-1409` / `tracker-main-20260905b` の削除は引き続きユーザー手番

### 2026-09-05 - #1409 Mobile 幅点検の実行セッション — finding 16 件（#1512〜#1527）起票・レポート PR

#### 概要

ユーザー依頼「1409 の実行を開始して」。計画書 `2026-09-05-mobile-screen-audit.md`（PR #1489 merge 済み）どおりに実行セッションを回した。dev server は先客 5174 を流用し `browser_resize(390, 844)` で固定（`innerWidth = 390` を全報告で実測）。シェル調査 → 7 画面を `playwright-ui-verifier` 直列（フォールバック 0 回・stream 停止なし・5〜25 分 / 40〜190 ツール呼び出し）→ 結合 M1〜M10 → 後始末 をメインが回し、所見はスクリーンショット / コード / SQL / MCP で spot check してから 1 件 1 Issue で起票。レポートを `docs/reports/2026-09-05-mobile-screen-audit.md` に置き、計画書を COMPLETED で archive へ（PR = docs/1409-mobile-screen-audit-report）。所要 約 2 時間（17:44〜19:45 JST）。

#### 変更点

- **環境の注記**: migration `0029_timer_sessions_event_link.sql`（#1375 / PR #1456）が**本番未適用**（remote は 0028 まで）で、`timer_sessions` の GET が `column event_id does not exist` の 400 になる。TimerProvider がグローバル層なのでセクション切替のたびに console error が増える。console 増分はこれを除いて数えた（それ以外は全工程 0）。**分析は `AnalyticsScreen.tsx:147` の `Promise.all` で束ねているため、この 1 本で Todo / イベント / 完了数まで全部 0** → 結合 M2 の分析側は環境起因で PARTIAL、作りの側を #1524 に起票。🛑 ユーザーの `supabase db push` 待ち
- **画面別**: briefing = ロゴ「夕 / 刊」の語中折れ・Todo 行のはみ出し（編集 / 削除の常設）/ schedule = ドロワー Todo 行の 8px はみ出し・月セルの `text-overflow: clip`・繰り返しタブ「N日ごと」の折り返し / materials = `[[` 候補メニューが right 453 で横スクロール / work = 選択シートに繰り返しの発生分が同名 7 行 / analytics = ルーチン名 96px 固定 / connect = **エディタに `callout` ノードが無く MCP が書いたノートの本文が破棄される**（対象外所見から重要所見へ格上げ・`grep callout` が web / shared で 0 件） / settings = カテゴリ選択でドロワーが閉じない・TagEditModal に閉じるが無い・ゴミ箱のタイトル列 111px。横断 = タップ対象 44px 未満（ヘッダー 36 / ドロワー閉じる 32 / タブ帯 33 / 気分★ 35 / 各行ボタン 41・32・24 高）を 1 件に束ねて #1512（important）
- **エージェント報告の棄却 / 格下げ**: schedule「移動ボタンがホバー専用」→ `[@media(hover:none)]:opacity-100` で実タッチは常時表示（実機申し送り）/ schedule「往復で時刻が消える」→ D-20260902-sched-1 = A（本日ユーザー裁定）の決定どおり / work「選び直し導線が消える」→ シートに「選択を外す」行あり（判断待ち）/ settings「ゴミ箱のカテゴリが 4 つ」→ 空カテゴリを畳む実装 / #1486 は PR #1449（#1442）で `role=checkbox` が付いており Desktop 側の再確認で close 可とコメント
- **結合**: M1 / M3 / M4 / M6 / M7 / M8 / M10 PASS。M2 PARTIAL（分析 = 0029）/ M5 PARTIAL（Note は保持されるが予定のアンカー日は今日にリセット → 判断待ち）/ M9 = Note 本文チェックボックス 20×25.6・role 無し（#1523）。**M4 の Desktop → narrow は完全 PASS**（月セル / 朝刊 / ノートのチェックボックス / セクション保持）
- **後始末**: MCP `delete_todo` / `delete_schedule_item` / `delete_note` / `untag_entity` でソフトデリート → 繰り返しは 1280 幅の「予定の操作 → 削除 → すべての予定（過去分も含む）」→ タグは 1280 幅の TagEditModal → **390 幅のゴミ箱で 39 行を複数選択して一括削除**（操作できた）。実測 = `items_meta` 0 行 / `search_all` 0 / `list_wiki_tags` 無し / `timer_sessions` 当日 0 → 0。**残置 = `wiki_tags` の `PWV1409-tag` ソフトデリート行**（ゴミ箱にタグのカテゴリが無く UI から消せない = 判断待ち P-16。#1408 の `PWV1408-tag` も同じはず）
- **判断待ち 16 件**をレポート §6 に列挙（ドロワーのスクリムが下タブを覆う / ドロワーが左から出る / 月グリッド下の余白 / セルの並び順 / Todo 詳細に日時入力が無い / アンカー日のリセット / ヒントのモーダル化と文言 / タグの完全削除経路 など）。`mobile-scope.md` は書き換えず、#7 / #8 行の齟齬は #1522（docs）
- **一時 worktree**: `C:/Users/user/orca/workspaces/life-editor/docs-1409-report`（`docs/1409-mobile-screen-audit-report` + tracker ブランチ）は PR merge 後に削除する。`plan-1409`（PR #1489 merge 済み）も削除対象
- **知見**: (1) playwright のスクリーンショットは cwd 直下に落ちる — `.playwright-mcp/` 配下の相対パスで指定する（scratchpad は allowed roots 外で拒否される）(2) 月セルは「他 N 件」に畳むので画面文字での有無確認は不能 → MCP `list_schedule` で裏取り (3) 同名行の `getByLabel().first()` は同じ要素を叩き続ける → DOM 側で全チェックボックスを直接 click (4) Desktop で開いていた詳細パネルは 390 に戻すとドロワーとして残り、スクリムが下タブを塞ぐ → 幅を戻す前に閉じる

### 2026-09-05 - #1409 Mobile 幅点検の計画セッション（PR #1489）+ origin 取り込み + night-safe 22:48 走の outbox 保全

#### 概要

ユーザー依頼「#1409 の計画セッションを実行し、並列で origin から main を取り込んで現状把握」。Issue 本文の 2 セッション分割に従い**計画セッション**として計画書 `plans/2026-09-05-mobile-screen-audit.md` を書き（ブラウザ未起動）、Desktop 側 #1408 と同じ一時 worktree 経由で PR #1489 を出した。main は 617d4981 → 47d2ba6d へ fast-forward（23 commit・#1408 のレポート / 計画書 archive / schedule 6 PR / analytics #1375 / 添付 sweep #1438 などを取り込み）。

#### 変更点

- **計画書（PR #1489）**: Desktop 計画の骨格（1 画面 1 エージェント直列 + 結合と後始末はメイン直接・`PWV1409-` 台帳・停止条件・フォールバック 2 回連続）に Mobile 固有を足した = ①**390×844 固定**で各報告の先頭に `innerWidth` 必須（768 以上の報告は無効）②画面別の前に**シェル調査**（下タブ 4 + More シート・ハンバーガーの `MobileDrawer`・`sectionDescriptors.tsx` の `narrowHeader` 形・横スクロールと本文潜り #631・入力欄 16px 下限 #1134）③出ない機能は **`mobile-scope.md` の行と照合して「仕様どおり / 不具合 / 判断待ち」に 3 分類**し、判断待ちはレポートに列挙してユーザーへ回す（計画書も実行も `mobile-scope.md` を書き換えない）④結合 M1〜M10（Quick capture → 朝刊 / ドロワー・**Desktop 幅で作って narrow で読む M4**・More シートと下タブ跨ぎの state・ヘッダーと More シートの Undo が同じスタック・フォント下限の横断実測）⑤**タイマーは開始しない**（#1475 の `timer_sessions` 残骸を作らない）⑥繰り返しの削除は narrow に導線が無い仕様（#5）なので後始末で Desktop 幅へ戻す ⑦除外リスト = Desktop 起票 20 件（Mobile でも出れば既存 Issue にコメント）。Desktop 計画の除外 #1371 / #1399 / #1405 / #1406 / #1442 は全部 CLOSED を実測し回帰項目へ ⑧swipe / ソフトキーボード / safe-area / 実タッチは SKIP 明記 + **実機（Epic #716 DoD）への申し送り節**
- **origin 取り込みの詰まり**: `git pull --ff-only` が「未追跡の `outbox/chat-night-safe/night-safe-report.md` を merge が上書きする」で abort。origin 側（PR #1447 で着地）は 09-01 と 09-02 21:01 の 2 走で、ローカルの未追跡は **09-02 22:48 の 3 走目**（未着地）だった。退避 → pull → 3 走目を pulled ファイルへ追記して保全（本 tracker PR に同梱）。3 走目の起票依頼 3 件 = `routine-night-safe.md` / `routine-digest.md` の「登録はまだ」注記更新 / `mobile-scope.md` #16 行の #1035 追随（Epic #716 の docs ゲート）/ 未追跡 Draft 計画書 `2026-09-02-fable-51-harness-retune.md` の始末 — **未処理**
- **現状把握（2026-09-05 実測）**: open PR = #1489 のみ（本セッション前は 0）/ open Issue 25 件（#1467〜#1486 の Desktop 所見 20 + #1409 / #1408 / #1388 / #1335 / #1301）。#1408 は実行完了コメント済みで、残るのはユーザー手番の `timer_sessions` id 18 / 19 と Issue の close。Epic #1121（通しツアー）/ #716（実機目視）はどちらもユーザー手番のまま
- **git 上の注意**: `git show origin/main:<path>` は Git Bash の MSYS パス変換で `:` が `;` に化けて失敗する。`MSYS_NO_PATHCONV=1` を付けるか、退避 → pull → diff の順で回す
- **未追跡のまま残るもの**: `plans/2026-09-02-fable-51-harness-retune.md`（Draft・git 未追跡・night-safe が 2 走連続で指摘）。本セッションでは触っていない
- **一時 worktree**: `C:/Users/user/orca/workspaces/life-editor/plan-1409`（`docs/plan-1409-mobile-screen-audit`）は PR #1489 merge 後に削除する

### 2026-09-05 - #1408 Desktop 全画面の実ブラウザ点検を実行 — finding 20 件（#1467〜#1486）起票・レポート PR #1487

#### 概要

計画書 `2026-09-02-desktop-screen-audit.md` どおりに実行セッションを回した。7 画面を `playwright-ui-verifier` の直列起動で点検し（2026-09-02 に 6 画面・セッションが日付を跨いで 2026-09-05 に settings）、結合 S1〜S10 と後始末はメインが playwright MCP を直接操作。所見はすべてスクリーンショット / コード / SQL で spot check してから 1 件 1 Issue で起票し、レポートを `docs/reports/2026-09-05-desktop-screen-audit.md` に置いて計画書を COMPLETED で archive へ移した（PR #1487 open）。冒頭で issue-prompter も回し、5 レーン分の `/goal` を提示した（配布はユーザー）。

#### 変更点

- **環境**: dev server は同じリポジトリ直下の vite の先客 5174 を流用（8/31 のサインインが残っていた。自分で立てた 5175 はログイン画面 = origin 別で session が無い → 停止）。1280×800・ja・light・console error 0 がベースライン
- **画面別（共通項目は 7 画面すべて PASS）**: briefing = ストリーク「最長 (日)」折り返し / schedule = 詳細パネル開でツールバー 2 行 / materials = 検索 0 件の空状態が「まだありません」+ 中央ボタン・テンプレ幅 818 vs 642 / connect = 右パネル常時空・戻ると選択リセット / work = リセットしたセッションが `timer_sessions` に未完了行で残る（SQL で id 18 / 19 を実測）・disabled ボタンの見た目 / analytics = 期間プリセットが Todo トレンドに効かない（`TodosTab.tsx:40` の `days={30}` を実測）・円グラフのラベル切れ・英語ラベル残り・生 id 行・タイル省略・`<html lang="en">` / settings = ショートカット競合が無警告・再割当後の `Ctrl Digit9` 表記・ヒントの「⌘K」
- **結合**: S1〜S4 / S7 / S10 PASS。**S8 で「アイテムを追加」の Todo タブから作った Todo が Undo で消えない**（Event は消える・2 回再現・リロード後も残る）→ #1485。S5 / S6 は PARTIAL（Todo 側のリンク一覧は製品に無い = チェックリストの前提違い / `timer_sessions` の残骸）。日付跨ぎでテストデータが 9/2 付けになったため、当日付の `PWV1408-main-1〜5` を作って S1〜S3 を回した
- **棄却 / 格下げしたエージェント報告**: 設定の 4 カテゴリのプレースホルダ（`SettingsScreen.tsx:840-843` で by design）/ 予定の「Todo へ変換」の配置（メニュー側にある）/ テンプレ幅の「サイドバーに被る」（中央モーダルとして正常・幅差だけを起票）
- **エージェント運用**: 6 画面は 1 回で完走（9〜22 分・61〜135 ツール呼び出し）。settings は 1 回目が ToolSearch 直後に stream 停止（600 秒無進捗）→ 再起動で完走。フォールバック（メイン直接）への切替は不要だった。settings エージェントが素材で誤って Untitled ノートを 1 件作ってゴミ箱へ入れたので、後始末で完全削除（08-29 以前の Untitled 6 件は未接触）
- **後始末**: MCP の `delete_todo` / `delete_note` / `delete_schedule_item` で 9 件をゴミ箱へ → 繰り返しは UI「すべての予定（過去分も含む）」→ タグはタグ編集モーダル（0 件だと確認ダイアログ無し）→ ゴミ箱で 15 件 + Untitled 1 件を一括完全削除。実測 = `search_all("PWV1408")` 0 / `list_wiki_tags` [] / `list_schedule(09-05〜09-12)` 空 / `items_meta ilike PWV1408` 0 行。設定は light / ja / 18px / ショートカット `{}` へ復元（開始時に残っていた `global:new-task = Ctrl+Digit1` の上書きも既定化）
- **🛑 残るユーザー手番**: `timer_sessions` id 18（task-1788353805055・13 秒）/ id 19（task null・12 秒）。UI にも read-only MCP にも削除経路が無い（#1408 コメントと #1475 の Gate に記載）
- **PR の経路**: main 直下ではブランチを切れないため一時 worktree `main-docs-1408` から `docs/1408-desktop-screen-audit-report` を切り、レポート追加 + 計画書の `git mv` → docs-lint 緑 → push → PR #1487 → worktree 削除
- **issue-prompter（セッション冒頭）**: open PR 0 本・0027 適用済みを実測し、briefing（#1442）/ schedule（#1440 / #1406 / #1405 / #1403 / #1401 / #1371）/ materials（#1439 / #1438）/ shared-fix（#1399）/ tags-docs（#1391 / #1390）/ analytics（#1375）の `/goal` 6 本を提示。采配 = #1408 / #1409 / #1335 / #1300（残り = Release 初回実行と実機 = 人手）/ #1301（#1300 依存）/ #1388（`CalendarTab.tsx` と i18n JSON が schedule 6 件と重なるため後回し）/ Epic 2 本 / 凍結 2 本
- **申し送り（#1409 Mobile へ）**: 横断で出そうなもの = #1481 / #1474 / #1478 / #1486 / #1480。#1476 と #1485 は Mobile の List+FAB でも同じコードを通る。テストデータの日付は実行日に合わせる

### 2026-09-02 - Issue 棚卸し + 5 レーンへ /goal 組み立て + #1408 計画書（PR #1441）+ #1335 作業分（PR #1443）+ 判断 4 件の回収

#### 概要

ユーザー依頼「Issue を整理し、issue-prompter で各 worktree へ渡すプロンプトを作り、画面ごとにエージェントを起動して検証する Issue（#1408）にも手を付ける」。open Issue 20 件を仕分けて 5 レーン 11 件の `/goal` を組み立て、#1408 は Issue 本文の 2 セッション分割に従い**計画セッション**として計画書を書いた（ブラウザ未起動）。あわせて outbox の起票依頼 3 件を処理し、退役レーン宛 3 件の宛先を振り直し、判断 4 件を AskUserQuestion で回収して台帳へ昇格した。

#### 変更点

- **main の分岐解消**: ローカル main に tracker コミット 1 つ（前セッションの直 commit・未 push）だけが取り残され `git pull --ff-only` が失敗。origin 側はその 2 ファイルも `.claude/automation/` も触っていないことを `git diff --stat main...origin/main -- <paths>` で確認してから `git rebase --autostash origin/main`。そのコミットは本日の tracker PR に cherry-pick で載せ替え、main は `git reset --hard origin/main` で origin と一致させた（**chat-main の tracker も PR 経由に統一** — 直 commit は次の pull を割る）
- **Issue 棚卸し（open 20 + 本日 4）**: 配布 = schedule-refine 5（#1371 / #1406 / #1405 / #1403 / #1401）/ shared-fix 1（#1399）/ tags-docs 2（#1390 / #1391）/ materials-refine 2（#1438 / #1439）/ refactor-core 1（#1388）。除外 = #1374（PR #1433 open）。采配 = #1408 / #1409 / #1335 / #1300 / #1301 / #1375 / Epic #1121 / #716 / 凍結 #898 / #677。**宛先振り直し 3 件** = #1399 `[layout-standard]`→`[shared-fix]`・#1390 / #1391 `[docs-workspace]`→`[tags-docs]`（両レーンとも退役済みで worktree が無く、issue-prompter の宛先解決に乗らなかった。Issue コメントで理由を残した）
- **起票 4 件**: #1438（添付の孤児回収 / materials outbox）/ #1439（添付アップロード進捗の方針 — 方針決めの Issue / 同）/ #1440（#1373 で凍った進捗の数字 2 つ / schedule outbox）/ #1442（朝刊「今日のスケジュール」Todo 行のチェックボックスを共有部品へ / D-20260901-shared-fix-2 の裁定から）
- **PR #1433 の migration 版番号衝突を検出**: #1425（2026-09-02 merge）が `0027_attachments_bucket.sql` を先に入れたため、#1433 の `0027_events_payload_reminder_offset.sql` と `0027` が 2 本並ぶ。ファイル名が違うので git は MERGEABLE と言うが `supabase db push` は版番号で並べるので通らない。`0028` への改名を PR コメントで依頼。**ユーザーの db push 順 = 0027 attachments → 0028 reminder → #1433 merge**
- **#1408 計画書 = PR #1441**（`plans/2026-09-02-desktop-screen-audit.md`・一時 worktree `plan-1408` 経由・docs-lint 緑）: 画面別チェックリスト 7 本（タブ / パネルの一覧は型 `BriefingTab` / `ScheduleSidebarTabId` / `MaterialsTab` / `AnalyticsTab` / `TrashCategory` / `SECTION_TAB_IDS` を指して個数を書かない）/ 結合 S1〜S10 / 1 画面 1 エージェント直列 + メイン直接操作のフォールバック（2026-08-31 に playwright-ui-verifier が API のセッション上限で落ちた前例を手順に組み込んだ）/ 停止条件 / `PWV1408-` 台帳 / 後始末（`search_all` = 0 と `list_wiki_tags` 残無しを AC に）。**書いてはいけないもの**を明示 = Daily / 目標ノート / フォーカスノート / `timer_sessions`（削除 API が無い = grep で `deleteSession` 0 件）/ 添付（0027 未 push）
- **#1335 作業分 = PR #1443**: 2026-09-01 に working tree へ置いたままだった `.claude/automation/` 6 ファイル + settings-unattended 2 本を、ユーザー裁定（PR にして出す）に従い `git diff` パッチ + 未追跡 2 本のコピーで一時 worktree `automation-1335` へ移して PR。docs-lint 緑
- **判断 4 件を AskUserQuestion で回収 → 台帳へ**: D-20260901-shared-fix-1 = **A**（ツアー再生は続きから・現状維持）/ D-20260901-shared-fix-2 = **B 相当**（揃える。PR #1395 / #1410 が merge 済みのため別 Issue #1442 で。提示ラベルとキュー原文のズレを D ファイルに注記）/ D-20260902-main-1 = **A**（#1440 は Todo 由来だけに寄せる。キュー未提出のまま回答が先行 — D-20260812-shared-fix-3 と同型）/ #1335 の着地先 = PR。ANSWERS.md へ 3 行転記・shared-fix キューから 2 件削除・#1440 に裁定コメント
- **未処理で残したもの**: #1442 の briefing-refine への `/goal`（起票直後で未配布）/ #1375 の 3 レーン分割起票（#1440 の裁定後に着手可能・未実施）/ mobile-refine からの #1400 / #1402 実機確認依頼（#1409 の実行セッションへ畳む）

### 2026-09-01 - main の CI 赤（TagUsageCard の存在しない import）を PR #1430 で修正

#### 概要

cb445180 以降の main で `shared — build (tsc -b)` が TS2307 で落ちていた。`shared/src/components/Analytics/TagUsageCard.tsx:13` が `./EmptyState` を import していたが、Analytics サブバレルの空状態は `AnalyticsEmptyState` という名前で、`./EmptyState` は存在しない。import 名と JSX タグ名を揃える 2 行の rename で解消し、PR #1430 を open。

#### 変更点

- **原因**: `components/index.ts` が Analytics サブバレルを `export *` で再エクスポートするため、`components/EmptyState` との衝突を避けて意図的に `AnalyticsEmptyState` へ改名してある（`AnalyticsEmptyState.tsx:14-17` のコメントが根拠）。TagUsageCard だけが旧名で import していた（同じフォルダの `MobileAnalyticsView` / `ScheduleTab` / `TimeTab` は全て新名）
- **修正**: `TagUsageCard.tsx` の import 1 行 + JSX タグ 1 箇所を `AnalyticsEmptyState` へ。props（`icon` / `title` / `description`）は両者で完全一致のため振る舞いの変更なし
- **検証**: `shared` の build / typecheck:tests / lint、`tests/analyticsTagUsageCard.test.tsx`（3 passed）、`web` の build — すべて緑
- **経路**: main 直下では feature ブランチを切れないため、一時 worktree `hotfix-emptystate` から `claude/shared-fix-tagusage-emptystate-import` を切って push → PR #1430（open）→ worktree は即削除
- **衝突リスク**: 同じ修正の branch を `materials-refine`（`claude/shared-fix-main-red-20260901`）と `refactor-core`（`claude/shared-fix-analytics-emptystate-import`）が先に切っていた。いずれも未 commit / 未 push だが、両レーンへ「#1430 で着地するので降りてよい」と伝えないと三重作業になる

### 2026-09-01 - アプリ内 Note「Issue報告」を回収して Issue 9 本起票（#1399〜#1407）→ Note 削除

#### 概要

MCP 経由でアプリ内 Note「Issue報告」（Desktop 1 / Mobile 4 / 共通 4 の 9 項目）を回収し、重複チェックと実装箇所のあたり付けをしたうえで #1399〜#1407 として起票した。文が途切れていた 1 項目は起票前にユーザーへ確認して内容を確定。全 9 項目の起票完了後、指示どおり Note をソフトデリートした（「Issue報告のテンプレート」Note は対象外として温存）。

#### 変更点

- **起票 9 本**: #1399（Desktop leftSidebar ブランドヘッダーの縦ずれ・`[layout-standard]`）/ #1400（Mobile サイドバー幅をフォントサイズ非連動へ・`[mobile-refine]`）/ #1401（Mobile 月カレンダー刷新 — 横余白ゼロ・丸点→タイトルの縦リスト・省略記号なし。#1148 の後続）/ #1402（サイドバー swipe 判定を外側にも・#1050 の後続）/ #1403（Event 編集の終日トグルと日付フィールドの重なり・#940 の後続）/ #1404（materials スラッシュコマンドに画像・ファイル添付 — Supabase Storage 前提・🛑 バケット作成はユーザー手番と明記）/ #1405（Event→Todo の逆変換を編集パネルへ・#997 / #1043 参照・Materials 側は触らない）/ #1406（「本日のTodo」タブを「本日分 / その他」の 2 分類へ再編 + ホバー移動 + 移動時は日付のみ変更で時刻保持 — 途切れ項目を AskUser で確定）/ #1407（Materials 切替時のノート表示ロード）
- **Note 削除**: `note-b26afda4-…`（Issue報告）を `delete_note` でソフトデリート（Trash から復元可）
- **ルーティング**: schedule 4 本 = `section:schedule` / materials 2 本 = `section:materials` / shell 3 本 = `shared-fix`（`[layout-standard]` 1 + `[mobile-refine]` 2）。mobile 系 4 本は Epic #716 を参照に付けた

### 2026-09-01 - コード整理監査（Tauri 残骸 / 未使用コード / docs 整合）→ Issue 7 本起票（#1385〜#1391）

#### 概要

ユーザー依頼でコードベースと docs を 3 並列サブエージェント（Tauri 残骸 / 未使用コード / docs 整合）で監査し、file:line の spot check を通った findings を 7 本の Issue として起票した。ファイル・依存としての Tauri は完全に消えており、実装済み計画書の plans/ 残置も #1377 で既知の 1 本（claude-launcher）だけだった。

#### 変更点

- **起票 7 本**: #1385（未使用 `version` カラムのバンプ廃止 — PostgREST が `version = version + 1` を書けないため**全 mutation で version 取得専用 SELECT が 1 本余計に飛んでいる**。LWW cursor は `updated_at` で version は無関係・mcp-server は準拠済みで shared だけが残置）/ #1386（`migrateTodosToBackend` 削除 — 呼び出し元 0 を実測・4 箇所のみ）/ #1387（削除済み `frontend/` FROZEN 前提・撤去済み Provider の陳腐化コメント一掃 — `PRINCIPLES.md:190` は存在しない 3 Provider の Optional バリアントを指示する規範のまま）/ #1388（dead i18n 33 キー + dead CSS — kanban 名前空間は CalendarTab / TagColorControls が 6 キー借用中なので移設してから名前空間ごと削除）/ #1389（参照ゼロ export 5 型 + 使われないテストシーム + `EmptyState` 同名 2 実装の rename）/ #1390（#1293 Trash 移設の design docs 追随 — IA.md が registry に無い Trash をユーティリティ枠として列挙・_COMMON-CONTEXT は Version 3 のまま）/ #1391（add-ipc-channel スキルの「7 関数」が実装 9 と乖離ほか dead path・数値 drift の束）
- **起票しなかったもの**: claude-launcher 計画書の残置（#1377 で既知）/ `fetchAllPages` の shared↔mcp 重複（#677 の承認済み負債・コードコメントに明記あり）/ mapper の過剰 export 30+（公開 API サーフェス方針の判断が要るため #1389 の備考に留めた）/ REFERENCE 計画書の置き場不統一（A/B 裁定として #1391 内に記載）
- **監査の白判定**: Tauri ファイル・依存・IPC = 0 / ScreenLock・FileExplorer・Terminal 残骸 = 0 / import グラフ上の orphan ファイル = 0（src 400+ ファイル）/ plans 14 本の Status enum 逸脱 = 0 / d3・Connect グラフ残骸 = 0
- **運用メモ**: 未使用コード調査のサブエージェントが 600 秒ストール → SendMessage で再開させて完走（SSE バグの既知型）
