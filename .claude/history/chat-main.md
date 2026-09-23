# HISTORY (chat-main)

### 2026-09-23 - 棚卸し 3 本（デッドコード / 未完了 / 製品基準）→ 報告書 + 裁定 4 件（0030 push・デッドコード PR・配布前 Issue 4 本・完成条件の書き換え）

#### 概要

ユーザー依頼「dead コードがないか、他に着手していないものがないか、製品としての基準を満たしていないとしたら何がないかを確認して」。読み取り専用の調査エージェント 3 本（デッドコード / 未完了作業 / 製品基準）を並列に回し、Supabase の migration 台帳は自分で CLI 実測した。結果を HTML 報告書 1 枚にまとめて Artifact で発行し、こうだいさんの回答 4 件（push する / まとめて OK / きめる / かきかえて）を同じセッションで実行に移した。

#### 変更点

- **報告書**: `docs/reports/2026-09-23-product-audit.html`（Artifact https://claude.ai/artifact/6uBiKGVjaDjeHWN98iUdy3）。結論カード 3 枚 = 今日から（0030 push）/ 配る前に（SMTP・Electron・エクスポート・問い合わせ導線）/ 入れない（署名・自動更新・OAuth・Sentry・Tier 3）
- **Issue 起票 5 本**: #1985（デッドコード削除・`[main]`）/ #1986（独自 SMTP・`[web-public]` shared-fix・配布前 1/4）/ #1987（Electron 33 → 44・`[main]` area:security・2/4）/ #1988（JSON エクスポート・section:settings・3/4）/ #1989（ヘルプと問い合わせ導線・section:settings・4/4）
- **PR #1990（docs）**: 移行 SSOT の Phase 5 完了判定を書き換え（自動更新は完成後の判断表へ / MCP 条件は Desktop 起動導線 #1211 + Remote MCP / Phase 4 は完成条件から除外 / §9 Non-goals の「認証ありの公開配布」をマルチテナントに絞る / 5-A・5-B の着地済み項目にチェック）。台帳 D-20260923-main-1 / -2 を作成し ANSWERS.md へ転記。一時 worktree `main-ssot` は push 後に削除
- **PR #1991（デッドコード削除・#1985）**: worktree `main-deadcode`・branch `chore/dead-code-sweep-20260923`。role-engineer が実装 + CI 相当 15 ステップ緑、role-qa が独立監査。中身 = MobileFab / QuickAddSheet（部品 + テスト）/ 関数 3 個 / 再 export 3 行 / i18n 18 キー / web の `@dnd-kit/sortable` / CSS トークン 26 名 / 消した名前を指すコメントと design-system docs の追随。**見送り 2 件** = `materials.tags.usageCount`（`i18n.test.ts` が複数形解決の確認に使う）/ mobile の `@capacitor/preferences`（`supabaseAuthStorage.ts:87` が実行時に `window.Capacitor.Plugins.Preferences` を呼ぶネイティブプラグイン — 監査エージェントの見落とし）
- **tracker**: memory の Desktop ブロックに #1987 と D-20260830-main-3 を反映、直近の完了を 3 件に整理、history 4 エントリ（09-05 ×3 / 09-06）を `archive/2026-09/` へ

#### 実測・知見

- **migration 0030（タグの表示色 = PR #1603・09-12 merge）が本番の台帳に無い**: `supabase migration list --db-url` で 0001〜0029 は remote と一致、0030 だけ remote 空。`WIKI_TAG_ASSIGNMENTS_COLUMNS` が `created_at, is_display_color` を SELECT に含むため、列が無ければ `listAllTagAssignments` が 42703 で落ちる設計。0030 は `add column if not exists` で冪等なので手で当てていても push は安全。**push は auto mode の分類器（Production Deploy）で止まり、列の実在を読む node スクリプトも（Production Reads）で止まった** → 🛑 `cd supabase && npm run db:push` はこうだいさんの手番。Edge Function `delete-account` の deploy 状態はアクセストークンが 401 で未確認（Supabase MCP も同じ理由で Unauthorized）
- **デッドコードの実態**: import グラフ 1,191 ファイルで完全孤立 0、退役機能（Terminal / File Explorer / d3 / Tauri / D1）のコード残骸 0、MCP カタログ 43 = 43。残るのは「バレルに載っているが誰も取り出さない」部品と i18n / トークン。判断が要るものは残した = `dataServiceRouting.ts`（型検査目的・tests 専用）/ Desktop IPC 4 本（`getTheme` 等 — `ThemeContext` が `setTheme` を呼ばず OS の `nativeTheme` に届いていない**配線漏れの可能性**）/ web の `@supabase/supabase-js`（dedupe 方針）/ `electron-updater`（完成後）/ `life_tags_migration_log`（rollback 用）/ `SectionId` 再 export（CLAUDE.md §3.2 連動）
- **未完了の実態**: open Issue 12 件のうちコードで拾えるのは #1974 / #1973 / #1972 の 3 件。close 待ち = #1850 / #1335 / #1121（`gh issue close` は auto mode で止まる）。Remote MCP は計画書 Step 3〜5 が未実施で deploy ワークフローの実行 0 回。移行 SSOT の完成 8 条件は達成 2 のみ（→ PR #1990 で書き換え）。リモートブランチ 510 本は PR 無し 0 / 取り残し 1（`fix/analytics-restore-axis-label-helpers` = #1907 CLOSED の残骸）
- **製品基準**: 認証（サインアップ〜削除）/ RLS 20 テーブル漏れ 0 / 法務 ja・en 本文実在 / ErrorBoundary 2 層 + オフラインバナー / テスト 549 ファイル 約 5,250 件 / typecheck 除外 0 / i18n 差は `_one` 12 件のみ。欠け = 内蔵 SMTP のまま Confirm email ON / Electron 33 系（現行 44・サポートは直近 3 メジャー）/ エクスポート無し / ヘルプ導線無し / Electron に CSP 無し / LICENSE・CHANGELOG・`.env.example` 無し / E2E 自動化無し。`npm audit --omit=dev` の high = web 1（tiptap）/ desktop 4 / mcp-server 4、critical 0
- **記録の片付け候補（未実施）**: 回答済み判断の台帳化 4 件（D-20260905-shared-fix-1 は PR #1913 で実装済み・台帳未作成）/ memory 7 本の「未回答」表記 / `memory/chat-schedule-refine.md:98-100` の conflict 残骸 / CLAUDE.md:59 の閉じた Epic #321 参照 / ANSWERS.md:117 の旧パス / known-issues INDEX 集計行 / 未起票 3 件（ErrorBoundary 不在箇所・狭幅ツアーの z 順・Connect 一括操作の進捗表示）/ 未追跡 = Draft 計画書 `2026-09-02-fable-51-harness-retune.md`（commit か削除の判断）と `shots/` 71 枚 6.4 MB（`.gitignore` 候補）
- **環境**: Bash の複合コマンドで `cd` すると cwd が漂流し、以後の相対パスが全部外れる（`.claude/comm/decisions` に落ちたまま `ls shared/src` が「無い」と返った）。`git -C` / `npm --prefix` / 絶対パスで書く。`MSYS_NO_PATHCONV=1 git -C /c/...` は `-C` 側の変換まで止めて失敗するので `C:/...` 形で渡す。PostToolUse の formatter は `.claude/**/*.md` の表を整形し直すため、触っていない表の hunk（9 行）が diff に混ざった → HEAD の内容を splice で戻した
- **サブエージェントの申告差**: role-engineer は依頼した `Co-Authored-By: Claude Fable 5.1` を使わず自分のモデル名で署名した（squash merge で潰れるので放置）。amend + force-push の依頼は git-workflow の規約を理由に断り、追いコミットにした（正しい判断）

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

> 古いエントリは [`archive/2026-09/chat-main.md`](./archive/2026-09/chat-main.md)・[`archive/2026-08/chat-main.md`](./archive/2026-08/chat-main.md)・[`archive/2026-07/chat-main.md`](./archive/2026-07/chat-main.md)・[`archive/2026-06/chat-main.md`](./archive/2026-06/chat-main.md)・[`archive/2026-05/chat-main.md`](./archive/2026-05/chat-main.md) を参照
