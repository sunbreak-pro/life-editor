# HISTORY (chat-schedule-refine)

### 2026-09-02 - /goal 6 件（#1371 / #1403 / #1440 / #1405 / #1406 / #1401）を全部 PR まで

#### 概要

Schedule の小さなバグ 2 件と仕様寄りの 4 件を指定順に処理し、PR を 6 本出した（#1450 / #1452 / #1454 / #1458 / #1463 / #1464）。全ブランチ origin/main から独立に切り、CI `verify` 全ステップ + `docs-lint` をローカルで exit 0（例外は下記の #1403 の web vitest）。仕様の裁定が要る 2 点は判断キュー（D-20260902-sched-1 / -2）に積み、安全側を実装した。

#### 変更点

- **#1371 = PR #1450 「＋+Todo」の二重プラス**: `AddPill` が lucide の `Plus` を描くので、文言側の「+ 」を落として "Todo" にした（Materials の "Note" / 「ノート」と同じ作法）
- **#1403 = PR #1452 終日トグルと日付欄の重なり（Mobile）**: #1036 は flex 列に `min-w-0` を入れて列を縮められるようにしたが、**中の `<input type="date">` は縮んでいなかった**。WebKit は `appearance: none` が無い date input を intrinsic 幅に固定し `w-full` を無視する。input 自身に `appearance-none min-w-0`、行の gap を `gap-3` に。`ItemCreatePanel` の同一行にも同じ 2 クラス
- **#1440 = PR #1454 凍った進捗数字 2 つ（C = 表示ごと畳む）**: 「今日の流れ」見出しの `{done}/{total}` と `RoutineSummaryCard` の進捗バーを撤去し、背後の集計（`todayDone` / `routineDone` / `narrowDayCounts`・カードの count props・`scheduleScreen.doneSummary`）も落とした。列・mapper・MCP の `set_schedule_complete` は温存。A / B は C の上に足す形なので、先に C を出しても後戻りにならない
- **#1405 = PR #1458 Event → Todo を Desktop の編集パネルにも**: 変換基盤・Undo・ルーチン拒否ダイアログはすべて既存（#625 / #739 / #997 / D-20260810-sched-5）で、#998 が narrow シート限定にしていた `convert` prop を両幅に渡すだけだった。**「無い」と書かれた Issue でも grep して「どこまで有るか」を先に測る**（#1000 の教訓の再演）
- **#1406 = PR #1463 「本日のTodo」タブを 本日分 / その他 の 2 分類に**: 本日分 = 旧 placed / unplaced を `singleList` で合流、その他 = `pickOtherTodos`（未配置 + 他の日に配置済みの葉 Todo・後者は "9/5 14:00" を添える）。ホバーで出る移動ボタン（`hoverActions`・`[@media(hover:none)]` では常時表示）。**その他 → 本日分は日付だけ変えて時刻を保つ**（`todoMoveToTodayWrite`）、**本日分 → その他は日付を外す**（`todoMoveOutWrite`・Undo ラベル `todoRemoveFromToday` を新設）。Briefing のトレイは新 prop を渡さないので描画不変
- **#1401 = PR #1464 Mobile 月グリッド刷新**: compact セルを固定 70px にし、グリッドを `flex-1` で伸ばすのをやめた（縦長の正体は `auto-rows-fr` × `flex-1` で余りが全部行の高さになっていたこと）。gutter は見出し行だけに残し、グリッドは端から端（compact では角丸と左右罫線も外す）。丸点を**タイトルの縦リスト**（3 行・4 件以上は 2 行 + "+N"）に替え、長い題名は `overflow-hidden whitespace-nowrap` だけ（`truncate` = 省略記号は使わない）で端で切る。Desktop は `compact` ゲートの外で無変更
- **検証の例外（正直に）**: #1403 のフル web vitest は `briefingEveningLazyMount` の 1〜2 件が負荷で落ちた（既知の flaky・memory `cold-vite-cache-fails-lazy-mount-tests`）。同ファイル単体は緑、他の 5 本のフル実行では同テストが通っている。他ステップは全部緑
- **prettier の追い commit**: python で当てたパッチは PostToolUse の整形フックを通らないので、push 後の `prettier --check` で 7 ファイルが未整形だった。#1403 / #1440 / #1406 の 3 本に整形だけの commit を積んだが、**#1452 / #1454 は push の前に merge されていて取り残された**（push-after-merge の 4 度目）。#1463 分だけ PR に載った
- **main が赤になり fix PR #1466 を出した**: 4 本が数分間隔で merge された直後、`web — lint` が `'workTime' is assigned a value but never used` で落ちた。#1456（#1375・analytics レーン）が `ScheduleEventEditor` に `workTime` を足し、#1458（#1405）が隣の `convert` prop を書き換えたため、GitHub 側の merge で `workTime={workTime}` の 1 行が消えていた（値は計算されるが pane に渡らない = 作業時間の表示も消えていた）。1 行復元 + 取り残された整形 3 ファイルの prettier を同梱し、origin/main から切った `style/prettier-schedule-20260902` で PR #1466

### 2026-09-01 - /goal 5 件（#1362 / #1370 / #1367 / #1373 / #1374）を全部 PR まで

#### 概要

Schedule の見た目と概念を整理する 5 件を指定順に処理し、PR を 5 本出した。#1411 / #1413 / #1414 は merge 済み、#1424（#1373）は origin/main 取り込みのコンフリクトを解消して `MERGEABLE/CLEAN`、#1433（#1374）は DDL があるため 🛑 `supabase db push` 待ちで open。

#### 変更点

- **#1362 = PR #1411（merged）now 線の時刻ラベルを消した**: 週・日ビューの now 線から左端のキャプションを外し、線とドットだけにした。`WeekTimeGridFormat.nowLabel` と `defaultFormatNowLabel` が呼び出し元ゼロになったので型ごと削除。**テストが「時刻の文字列」で now 線を探していたので、消した瞬間に何も掴めなくなる** — `data-week-grid="now-line"` / `"now-dot"` のフックを足して、3 本のテストをそちらへ寄せ替えたうえで「キャプションが無いこと」を 1 本追加した
- **#1370 = PR #1413（merged）作成パネルを 2 タブに畳んだ**: type が event / task / note の 3 つだったのを 2 つにし、ノートは**両方のタブの中で開閉するディスクロージャ**に移した。`target` / `setTarget` / `selectType` と `source` / `setSource` の間接層が丸ごと不要になる。i18n は `scheduleScreen.typeNote` を落として `attachNote` / `noteSourceLabel` / `noteSourceNew` / `noteSourceExisting` の 4 本へ
- **#1367 = PR #1414（merged）サイドバーの Todo 行を Todo のチェックボックスにした**: 「未着手 / 着手中 / 完了」は**予定の語彙**（時計から導かれる 3 値）で、Todo は done か否かの 2 値しか持たない。朝刊は既に後者の言い方をしているので、同じ Todo を見せる 2 面が状態の呼び名で食い違っていた。`AgendaListLabels` の `todoStatus` / `todoStatusLabels` は **optional にせず必須にした** — 言葉の無い Todo 行が黙って何かにフォールバックするのが、まさにこの Issue の再発形だから
- **#1373 = PR #1424（open・CLEAN）予定から完了概念を全部外した**: ステータスピルとトグルを全面撤去し、`ScheduleStatusTag.tsx` / `utils/scheduleStatus.ts` とその 2 本のテスト、`schedule-tag-*` トークン、i18n 4 キー（`scheduleScreen.complete` / `statusNotStarted` / `statusInProgress` / `statusDone`、`briefing.toggleComplete`）を削除。51 ファイル・334 追加 / 1,005 削除。**判断が要ったのは取り消し線**: MCP の `set_schedule_complete` は残す仕様なので、Event 側で素通しすると「消す手段が画面に無いのに永久に消える」。`variant === "task"` でゲートして AgendaList / WeekTimeGrid（ブロックと終日チップ）/ MonthGrid の 4 箇所に同じ形で入れた。`completed` 列と `BriefingScheduleEntry.completed` はデータとして温存（夕刊の `!s.completed` フィルタが読む）
- **#1374 = PR #1433（open・DDL 待ち）予定ごとのリマインダー**: 開始の N 分前に通知。アプリ内トーストは全プラットフォーム、OS 通知は Desktop のみ。**保存はオフセット**（`events_payload.reminder_offset_min`）で絶対時刻ではない — 絶対時刻だと予定を動かすたびに再計算が要り、その計算にはタイムゾーンの知識が要るが、`scheduleItemMapper` は「TZ を知らない純粋関数」だと自分のヘッダで宣言している。既存の `reminder_at` は 0008 以来ずっと全書き込みが literal null で実データ 0 行なので、互換性の負債ゼロで乗り換えられた（列は DROP せず残置）
- **リマインダーの既定値は読み取り時に解決せず作成時に行へ書く**: 読み取り時フォールバックだと NULL が「通知しない」なのか「まだ決めていない」なのか DB から区別できず、Settings の既定を変えた瞬間に過去の予定が勝手に再武装する
- **配信はタイマーではなくスイープ**: 予定ごとに `setTimeout` を張ると Realtime bump のたびに張り直しになり、結局「もう出したか」の集合が要る（集合があるならタイマーは 2 つ目の仕組みで何も買っていない）。加えて Chromium はバックグラウンドのタイマーを丸め、スリープで発火ごと消す。`useMinuteClock` で 1 分ごとに `Date.now()` と比べ直す形なら、スリープ・スロットル・時刻変更のどれの後でも答えを出し直せる。**台帳はモジュールスコープ**（`useRef` だと StrictMode の再マウントで捨てられ dev だけ 2 回出る = レビューで一番見られる DoD 項目がそこで壊れる）
- **停止中に来た分は `due <= now && now < start` の 1 行**: 開始後に「もうすぐ始まる」と言われても行動は変わらないが、09:50 に届くはずの通知を 09:58 に開いた人へ出さないのは取りこぼし。この条件はリード時間（最大 60 分）が自然な上限になるので、遡り定数も「最後にスイープした時刻」の永続化も要らない
- **Electron は IPC を 1 本（`notify:show`）だけ足した**: preload の公開関数が 9 → 10 で **#529 Risk 1 の上限ちょうど**。`desktop/tests/ipcContract.test.ts` が実物から数えているので黙って超えられない。**`isNativeMobile()` でゲートしていない** — `getDesktopNotificationBridge()` が Electron 以外で null を返すのが既にゲートで、Provider 層で mobile を切るとスマホでアプリ内通知まで死ぬ
- **#1424 のコンフリクトは #1367 の squash merge が原因**: ブランチを #1367 の元コミット `c892f789` から生やしたが、#1367 は squash で main に入ったので元コミットが main の祖先でなくなり、同じ 3 ファイル（`AgendaList.tsx` / `agendaList.test.tsx` / `useScheduleDayLabels.ts`）が衝突として返ってきた。**全ハンク ours を「判断」ではなく「証明」にできた** — merge base 以降にその 3 ファイルを触った main のコミットは #1367 の squash 1 本だけで（`git log <base>..origin/main -- <file>`）、その中身は分岐元とバイト単位で同一（`git diff c892f789 70a45aeb -- <file>` が空）。つまり main は自分が既に持っているものしか持ち込まない。マージ後に `ScheduleStatusTag` / `utils/scheduleStatus` / `schedule-tag-*` / 削除した i18n 4 キーの参照ゼロも実測した
- **#1374 で 1 本落ちたテストが本番の実バグを連れてきた**: ダミー DataService に `updateScheduleItem` が無く、リマインダー既定値の追い書きがそこで死んでいた。**stub を足すだけで済ませなかったのは、追い書きの失敗が `onSaved(null)`（= 作成失敗）として呼び出し側に伝わっていたから** — 行は保存済みなのにエディタが書き込んだばかりの行の上に開きっぱなしになる。追い書きだけを個別に catch して「リマインダー無しで保存済み」に落とし、その挙動をテストで固定した
- **検証**: 5 本すべて CI `verify` 全ステップ（shared → web → desktop → mcp-server）+ `docs-lint` をローカルで exit 0。#1424 は main 取り込み後のツリーで再実測

### 2026-08-31 - #1343 詳細パネルのタブ 3 つを 1 行に揃えた

#### 概要

予定の詳細パネルで「今日の流れ」「本日の Todo」がラベル途中で 2 行に折れ、「繰り返し」だけ 1 行だった件。`SegmentedControl` に opt-in の `singleLineLabels` を足し、ラベルを nowrap にして溢れをトラックの `flex-wrap` に吸わせた（PR #1355 open）。

#### 変更点

- **原因は幅の算数**: 既定 320px のパネル − ボディの `p-3` − トラックの `p-0.5` / `gap-0.5` を 3 分割し、さらにセグメントの `px-3` を引くと、**既定ルートフォント 18px（`constants/fontSize.ts` の既定は 16 ではなく 18）ではラベル 1 つあたり約 67px**。ja は「今日の流れ」約 79px・「本日の Todo」約 83px で入らず、「繰り返し」約 63px だけ入る。en も同じ形（"Today's flow" / "Today's Todo" が折れ "Repeats" は折れない）
- **#1207 との関係**: あちらはセグメントを flex 中央寄せにして**折れたラベルの高さを揃えた**だけで、折れること自体は残っていた。#1343 はその続き
- **直し方は #1264 と同じ**: CJK はどの 2 文字の間でも改行できるので、詰まった flex 行は必ずどこかで折る。**まず `whitespace-nowrap` で折るのを禁じ、溢れは別のものに吸わせる**（ツアーフッター #1264 は `shrink-0 whitespace-nowrap` + 行の `flex-wrap`）。ここではトラックに `flex-wrap` を足したので、パネルを最小 240px まで縮めてもフォントスライダー上端でも、**ラベルを刻む代わりにトラックが 2 行に落ちる**（3 つとも同じ高さ = Issue の代替 DoD を満たす）
- **320px に収めているのは実質パディングと文字サイズ**: `px-3 text-sm` → `px-1.5 text-xs`。`flex-1` が幅を決めるのでパディングは見た目にほぼ出ない（**長いラベルが取れる下限を下げるだけ**で、短いラベルは中央のまま動かない）。文字は `text-xs` が `tokens.css` で 0.8125rem に持ち上げてあるので 18px ルートで約 14.6px（`text-sm` は約 15.8px）
- **opt-in にした理由**: 他 4 つの呼び出し元（`FrequencyEditor` / `ItemCreatePanel` / `ScheduleToolbar` / mobile section band）は元から 1 行に収まる。特に `FrequencyEditor` の en "Every N days" はスマホ幅のシートに 4 セグメントで、**折り返してよいラベル**。既定を変えるとそこが溢れる
- **サイズ表を 2 本目として書いた**（`SINGLE_LINE_SIZE_CLASSES`）: `cn` はただの文字列連結なので、`px-*` を 2 つ載せると「後勝ち」ではなく Tailwind の出力順で決まる（#830 と同じ罠・`rules/frontend.md` §Gotchas）。**1 要素に届くパディングと文字サイズはそれぞれ 1 クラスだけ**、を型（`Record<SegmentedControlSize, string>`）で担保する形にした
- **テスト**: jsdom にレイアウトが無いので「1 行に収まった」は観測できず、クラス契約を固定した — nowrap + flex-wrap の対 / パディングと文字サイズが 1 クラスずつ / **opt-in していない 4 トラックが今も折り返せること**。`ScheduleSidebarTabs` はテストが 1 本も無かったので `shared/tests/scheduleSidebarTabs.test.tsx` を新規追加（switcher の opt-in・1 タブ時に switcher ごと消えること・tabpanel の `aria-label`）
- **検証**: CI `verify` ジョブと同じ順でローカル全緑（shared 281 files 2,773 / web 106 files 990 / desktop 1 files 7 / mcp-server 25 files 322）+ `docs-lint` OK。**実ブラウザでの ja / en 確認は chat-main の手番**（worktree は build / 型検証まで = worktree-policy）
- **i18n の文言は変えていない**: Issue が「最後の手段」としていたラベル短縮（「今日の流れ」→「流れ」等）は採らず、`todayFlow` / `tabTodo` / `tabRepeats` は現状維持

### 2026-08-30 - #1242 タグフィルタの aria-label に単数形を与えた

#### 概要

Schedule ツールバーのタグフィルタが、タグ 1 件選択で "Filtered by 1 tags" と読み上げられていた。`scheduleScreen.filterActive` を `_one` / `_other` に分けて i18next に形を選ばせた（PR #1267 open）。

#### 変更点

- **en / ja カタログ**: `shared/src/i18n/locales/en.json` の `filterActive` を `filterActive_one`（"Filtered by {{count}} tag"）と `filterActive_other` に分割。`ja.json` は `filterActive_other` へ改名（日本語は 1 形・既存 `todoCount_other` と同じ綴り）。**呼び出し側は無変更** — `web/src/schedule/scheduleCopy.ts:211` は既に `count` を渡していて、直す場所は「呼び出し側の三項」ではなくカタログの側だった
- **前例をそのまま踏んだ**: `materials.todos.todoCount` が #680 で同じ壊れ方（"1 todos"）をして同じ形で直っている。テストも `shared/tests/i18n.test.ts` のその 2 本のすぐ下に置き、en は count 0/1/2・ja は 1/2 を `t()` 経由で assert する形を揃えた
- **見つからなかった理由が構造にある**: この文字列は `ScheduleToolbar.tsx:165` の `aria-label` にしか行かないので、**画面を見ている限り絶対に出ない**。実ブラウザ巡回で読み上げを聞いて初めて出た（chat-main の #1226 merge 後 P4 巡回）
- **分割は将来の退行を「静か」から「大声」に変えた**（実バンドルで実測）: 呼び出し側が `count` を落とすと、分割前は "Filtered by {{count}} tags" というそれらしい英文に落ちたが、素のキーが消えた今は生の `"scheduleScreen.filterActive"` が DOM に出る。逆に en を revert すると新テストが赤くなることも確認済み（テストがトートロジーでないことの担保）
- **`i18nKeys.test.ts` は en/ja の非対称を最初から許す作り**: 複数形サフィックスを基底キーに畳んでから突き合わせるので、en が `_one` + `_other`・ja が `_other` だけという形はこのテストが受け入れるために書かれた形そのもの。`_other` 必須チェックもサフィックス付きキーだけを見るので ja 側も通る
- **検証**: CI `verify` の全ステップ + `docs-lint` をローカルで exit 0（shared 274 files / 2,677 tests・web 100 files / 937 tests・desktop 1 file / 7 tests・mcp-server 24 files / 319 tests）。レビューで挙がった 2 件の指摘は独立検証で両方 refute（1 = ja テストが改名を pin しない → #778 で意図的にそう分割した設計・#680 と同一 / 2 = count→aria-label の配線が未固定 → 差分外の既存コードで、提案された修正では名指しの変異を検出できない）
- **同じ潜在バグが 6 本残っている**（この PR の対象外・outbox へ起票依頼）: `scheduleScreen.repeatFilterHidden`（同じツールバーの**可視**ラベル "1 repeats hidden"）/ `materials.tags.usageCount`（"1 items"）/ `connect.itemCount`（"1 items"）/ `todos.todoDeleteCascadeConfirm`（破壊的確認の本文 "its 1 child todos"）/ `itemConvert.childrenBlocked`（"subtask(s)" のごまかし）/ `work.sidebar.sessions`（1 形かつ**呼び出し側が 1 つも無い**）。**5 本は aria-label ではなく画面に出る文字列なので、今回のより見え方が悪い**

### 2026-08-29 - #1173 カレンダー台帳の退役（タグフィルタ + グループ）と #1207 セグメント揃え

#### 概要

Calendar ツールバーの歯車をフィルタアイコンに差し替え、既存 WikiTag のマルチセレクト + 名前付き Group でカレンダー台帳を完全代替した（PR #1226・GitHub CI 両ジョブ pass）。あわせて、ドロワーのセグメントラベルが折り返しの有無で縦位置がずれる件を直した（PR #1233）。どちらも origin/main から独立に切り、CI `verify` の全 14 ステップをローカルで exit 0。

#### 変更点

- **なぜ台帳が要らなかったか（#1173）**: `calendars` 行は `{ title, tagId }` = **ちょうど 1 つのタグへの保存済みビュー**。「カレンダーを作る」は「タグフィルタに名前を付けて保存する」以上のことを一度もしていなかったので、ユーザーに 2 つ目の名詞を発明させていただけだった。歯車という導線もその意味を隠していた
- **DDL ゼロで着地（最重要）**: `wiki_tag_groups` + `wiki_tag_group_assignments`（0008 tables 10/11）が**作られたまま参照ゼロ・本番 0 行**で残っており、RLS 4 ポリシー・`supabase_realtime` publication・`REALTIME_TABLES` がすべて済んでいた。新表を切ると 🛑 ユーザー `supabase db push` まで機能が死ぬので流用を選択。親 + join の正しいモデルも同時に手に入った（判断台帳 = `D-20260829-sched-1`）
- **述語は UNION（OR）**: タグを 2 つ目に足す行為は「それも見せて」と読める。AND だと life-tag は 1 アイテム 1 個が普通なのでほぼ空になる。`|tagIds| = 1` で現行挙動に厳密退化するため、#468 で固定した既存テストがそのまま真
- **チップは保存せず導出**（rule 5）: グループ適用は「そのタグをチェックリストへコピーする」なので、点いているチップはチェックの関数。別に持つと、適用後に 1 つ外した瞬間に嘘になる
- **`public.calendars` は退役-in-place**: `REALTIME_TABLES` に残したまま `schedule` ドメインへ再ルート。これで `syncRealtimeTables.test.ts` の publication 突合とハードカウントが**無改変で緑**（`routine_groups` が #352 以降取っている形と同じ）。DROP は別 PR で outbox に申し送り
- **`tagGroups` は独自 sync ドメイン**（#993 の逆向き）: `tags` に相乗りさせると、グループを保存するたび `useWikiTagsUnifiedAPI` の bulk 3 本（タグ + 全ページ assignment + connection）を引き直すことになる
- **#1207 は 1 段下で直した**: `ScheduleSidebarTabs` は `{ id, label }` を素通しするだけで、padding もラベルの箱も `SegmentedControl` のもの。トラックが全セグメントを最も高いものへ引き伸ばすため、ブロック要素だと 1 行ラベルが上端に貼り付く。セグメント自身を flex 中央寄せにして解決（折り返さない既存 5 consumer は見た目不変）
- **反省 — 検証後に触ったコードを検証し直さなかった**: `TagFilterPanel` のリネーム欄を verify 完走後に足し、`useEffect` 内 `setState` が `react-hooks/set-state-in-effect` で CI だけ赤になった。repo 既存の「render 中に調整する」形（`ColorPicker` の `prevSeed`）へ直して再検証（PR #1226 の 2 コミット目）。**ゲートを通した後にソースを触ったら、そのゲートの緑は無効**
- **ローカル検証の罠 2 つ**: (1) `cd` した persistent shell から background で走らせると cwd がずれて**全ステップが「ディレクトリが無い」で失敗しているのに最後の echo で exit 0 に化ける** → 絶対パス + `FAIL` フラグ集約に変更。(2) `docs-lint.sh` は長時間走ると Git Bash の fork 枯渇（`Resource temporarily unavailable`）で刺さる — GitHub 側の docs-lint ジョブで代替した

### 2026-08-29 - #1168 merge 後の 2 巡目（#1187 のツアーアンカー付け替え）

#### 概要

PR #1168（#1124 のツアー）が main に着地したため、予告どおり後着地側の #1187 が 6 ファイルの衝突を解消し、Todo 系ツアーアンカー 3 本を退役した Kanban 板からサイドバーのトレイへ付け替えた。MERGEABLE + CLEAN に復帰（`b2753770`）。

#### 変更点

- **コンフリクト解消（6 件）**: `useShellChrome.tsx` は #1153 のタブ帯退役を採用（`scheduleTabDefs` ごと削除・不要になった `TOUR_ANCHORS` import も落とした）/ `CalendarTab.tsx` は import 両取り / `KanbanView` `KanbanBoardSurface` `MobileTodoList` `kanbanView.test.tsx` の 4 件は modify/delete で削除を採用
- **アンカーの付け替え**: `schedule-todo-tab` → サイドバーの switcher（`SegmentedOption` に任意の `tourId` を新設し `ScheduleSidebarTab` は構造的に素通し。`HeaderTabs` が #1124 で持った受け口と同型）/ `schedule-todo-add` → トレイの作成ピル / `schedule-todo-board` → トレイ本体
- **報告の付け替え**: 「Todo を開いた」は `ScheduleSidebar` の effect（`RightSidebarPortal` が閉じている間 children を描かないので、生きている = 見えている）。完了は `CalendarTab` で `setTodoStatus` / `toggleTodoStatus` を源流で包み、トレイのチェック・詳細のトグル・詳細のステータス行の 3 経路を 1 箇所で拾う。作成は `handleCreateTodo`（唯一 todo を作る経路）
- **文言**: `scheduleCompleteTodo` が「カードを完了列へドラッグ」、`scheduleOpenTodos` が「Todo シート」と消えた板を教えていたので en / ja とも現在の面に合わせた
- **テスト**: 板と一緒に消えた 3 ケースを `web/tests/scheduleTourTodos.test.tsx` へ（サイドバー側は実描画 8 件・`CalendarTab` 側はソーステキスト assertion）。`scheduleCopy.test.ts` に「`tourId` を持つのは todo タブだけ」を追加
- **検証**: CI `verify` の全ステップ + `docs-lint` をローカルで exit 0（shared 2,533 / web 836）

### 2026-08-29 - PR #1168 / #1187 のコンフリクト解消

#### 概要

並行して main に着地した #1167（Materials のツアーステップ）と #1148（narrow の日別リスト退役）が原因で衝突していた 2 本の PR を、最新の `origin/main` に対して解決して push した。両方 MERGEABLE + CLEAN に復帰。

#### 変更点

- **#1168（`claude/sched-1124-schedule-tour-steps`・5 件）**: tour registry のヘッダコメント（Schedule 節と Materials 節を両方残す）/ en・ja の `tour.steps`（両側のキーを歩く順に）/ `shared/src/index.ts` の tour フック export（両方）/ `CalendarNarrowLayout.tsx`（#1148 の退役を採用し、`schedule-add-event` アンカーを `ScheduleSidebar` の見出し行のピルへ移設 — wide 側は `ScheduleToolbar` のままで、両者は `onAdd` の有無により同時に描画されない）
- **重複フックの解消**: `useTourAction` が自前で作っていた optional context hook を、main が同目的で足した `useTourContextOptional` に寄せた（マーカーに出ない衝突）
- **#1187（`claude/sched-1153-retire-todo-tab`・4 件）**: `CalendarTab.tsx` 3 hunk（import は両取り / `openSidebar` のコメントは両方の理由を併記 / 3 つ目は #1148 の narrow 値と #1153 の todo intent という無関係な 2 ブロックだったので並置）/ `ScheduleSidebar.tsx`（`activeScheduleSidebarTab` は呼び出し側ごと退役済みなので削除を採用）/ `scheduleSidebar.test.tsx`（両側の describe を残す）/ `mobile-scope.md`（#4 行は main 版、#1153 行はこちら）
- **検証**: 両ブランチとも CI `verify` の全ステップ + `docs-lint` をローカルで exit 0。#1168 は GitHub Actions も緑
- **残件**: #1124 のツアーアンカー 3 本（`scheduleTodoTab` / `scheduleTodoAdd` / `scheduleTodoBoard`）は #1153 が削除する面に付いている。付け替えは後着地側の担当（`2026-08-29-schedule-todo-tab-retirement.md` L100）で、#1168 を先に merge するなら #1187 側でもう 1 往復要る

### 2026-08-29 - /goal 4 件（#1140 / #1124 / #1148 / #1153）を全部 PR まで

#### 概要

schedule-refine の担当 4 件を 1 Issue = 1 ブランチ = 1 PR で提出した。#1140 は merge 済み（PR #1163）、残り 3 本は open（#1168 / #1178 / #1187）。4 本とも origin/main から独立に切り、CI `verify` の全ステップ + `docs-lint` をローカルで exit 0。

#### 変更点

- **#1140 変換の role ゲート（PR #1163・merge 済み）**: `convertEventToRoutine` の `items_meta` bump は `.eq("role","event")` を持ちながら `mErr` しか見ておらず、0 行ヒットが無言で素通りしていた。続く attach は `item_id` + `.is("routine_item_id", null)` だけで絞り role を見ないので、Todo へ変換済みの id を渡すと **§10.5 の残骸にルーチンが繋がり、変換は SUCCESS を返すのに二度と purge できない routine ができる**（0011 の FK が NO ACTION で、purge の step 2 は `role='event'` しか消さない）。bump に `.select("id")` を足し、0 行なら名前付きエラーで止める。**bump が attach より前に走ることが唯一の防具**なので、その順序の意味を doc に書き足した
- **#1140 の副作用 2 つ**: purge の step 2 が読み戻して取りこぼしを名指しする（従来は step 3 で Postgres の生 FK メッセージが出るだけで、どの occurrence が原因か分からなかった）。`useRoutinesAPI.permanentDeleteRoutine` は拒否されたら楽観削除を戻す — **今までは Trash から消えて DB に残り、再試行の手がかりも消えていた**。チャンク書き込みの読み戻し用に `forEachIdChunkReturning` を追加
- **#1124 Schedule のツアーステップ（PR #1168）**: #1122 の `TourProvider` の上に 5 ステップ（予定を作る → 時間を変える → Todo シートを開く → Todo を作る → 完了）+ `data-tour-id` + ja/en コピー。**全ステップが `advanceOn: action`** で、ボタンを見せるだけでは進まない。アンカーは「ステップ開始時に画面にある物」しか使えないため、開かせたい物（編集パネルの時刻欄）ではなく durable な面（カレンダー / ボード）を指す。通知はホスト（CalendarTab / KanbanView）側で包み、context-free なフックには触っていない。`useTourAction` は optional（保存はツアーの有無を気にしない）かつ identity 固定（ツアーが進むたびにハンドラを作り直さない）
- **#1148 narrow の日リスト退役（PR #1178）**: メインを月グリッド単独にし、日付タップでアンカー移動 + ドロワーがその日を開く。「今日の流れ」タブが narrow で選択日追従になり（ラベル / アジェンダ / #774 の空状態 / #691 の dayflow）、**選択日が今日でなければ now ラインを出さない**。Desktop は 1px も動かさず、マージも `isWide` の裏に置いたまま上へ移した。作成ピルはサイドバー見出し行へ（`D-20260827-sched-1` = A）。主役のジェスチャーは `selectNarrowDay` として独立モジュールに切り出し、テスト可能にした（CalendarTab は jsdom に載らない）
- **#1153 Todo カンバンの退役（PR #1187・計画書 → 実装の 2 commit）**: Schedule をタブ無しの 1 画面に戻し、Todo を右サイドバーのトレイへ縮退。**-4,600 行**。トレイの行タップが詳細オーバーレイを開き、未スケジュール行のタイトルもボタン化、作成ピルを見出し行に追加。詳細オーバーレイが**カンバンの本文エディタと `[[` 配線を引き取った**（DoD が明記していた部分）。サイドバーの Todo タブは narrow でも出るようにした（退役前は狭幅が専用タブから触っていたため、畳んだままだとスマホから Todo に触れなくなる）。シェルの 3 経路（`nav:tasks` / `global:new-task` / `[[` の task）は「行き先」から「セクションへ移動してフラグを立て、セクションが消費する」形へ
- **計画書**: `.claude/docs/vision/plans/2026-08-29-schedule-todo-tab-retirement.md`（#1153 の Issue が計画先行を要求。IN PROGRESS のまま — archive は merge 後）
- **判断台帳**: `D-20260827-sched-1`（#1148 の作成ピルの置き場 = A。Issue が推奨案を提示していたためキューには積まず、理由と却下した B を台帳へ）

### 2026-08-24 - #1098 と #889 を出し切り、その過程で並行エージェントの事故を 1 件踏んだ

#### 概要

`items_meta` DELETE の role ガード（#1098 = PR #1113・**merge 済み** main `53ed85b0`）と、`CalendarTab.tsx` の分割完了（#889 = PR #1131 open・**1,538 → 983 行**で DoD の 1,000 行を達成）。加えて #1113 のコメントと census の誤りを直す追いかけ PR #1132 を open。3 本とも CI `verify` 全ステップ + `docs-lint` をローカルで exit 0。

#### 変更点

- **#1098 = PR #1113**: DELETE 10 箇所（`SupabaseScheduleItemsService` 5 / `SupabaseRoutinesService` 5）に role 絞り込み。**実害は 3 つだけ** = caller から id を受け取って読み戻さない `deleteScheduleItem` / `permanentDeleteScheduleItem` / `bulkDeleteScheduleItems`。残り 7 つ（R2 クリーンアップ 3・変換ロールバック・`deleteRoutine`・`permanentDeleteRoutine` の 2 つ）は**穴を塞いでいない**ので、コメントでそう書き分けた —「全部の DELETE が role を名乗る」は読み手が検算できるが「今日たまたま安全な 4 つを除いて全部」は検算できない
- **`permanentDeleteRoutine` は miss が静かでない唯一の場所**: 0011 の複合 FK が `ON DELETE NO ACTION` なので、step 2 が 1 件見逃すとその `events_payload` 行が routine を指したまま残り、**step 3 が FK 違反で落ちる**。これは受ける側のトレードで、purge が失敗して診断可能な残骸が残るほうが、Todo を hard delete して `tasks_payload` ごと連鎖で飛ばすより回復できる
- **テストは「対」で書く**: 変換済み行が残る、**かつ**同ロールの対照行はちゃんと消える。前者だけだと「何にも当たらないよう綴りを間違えたガード」も通る。**DELETE の生存はキャプチャした行オブジェクトで判定できない** — mock の delete 分岐は配列ごと差し替えるので、テスト側の参照は削除成功後も生き残る（`metaIds(db)` を語彙にした）
- **static census を追加**（DoD の「数え上げテスト」）: 2 つのサービスをディスクから読み、DELETE 全数を `method → role` で pin。**3 つの site が `forEachIdChunk` のアロー内**にいるので正規表現では追えず、括弧の深さを数えながらチェーンを歩く walker にした。ガードを 2 箇所で外す変異テストで、それぞれ 3 本が赤くなるのを実測
- **`convertEventToRoutine.test.ts` を同 PR で直した**: delete モックが最初の `.eq()` から**チェーンではなく Promise** を返していたので、足した role フィルタが `TypeError` になる。しかもそれは service の catch → `logServiceError` → `console.warn` に飲まれ、write レコードは最初の `.eq()` で push 済み。**ロールバックが何もしていないまま 2 ケースとも緑のままだった**
- **【事故】並行エージェントが repo を書き換え、commit を reset した**: #1098 のレビュー中に `deleteScheduleItem` が検証用の形（`const q = this.client.from("items_meta");` + `q.delete().eq("id", id)` = ガード無し・チェーン分断）に書き換わり、その細工が最初の push に載った。犯人は**セッション中断を跨いで生きていた別ワークフローの implement エージェント**。停止させた role-qa は「書いていない」と答えたが、`git reflog` の `reset: moving to HEAD~1` が残っていた。**修復は追いコミットで**（force-push はしない）。皮肉なことに、この細工を捕まえたのは同 PR の census の自己チェック（`.delete(` 生カウント 5 対 walker 4 の不一致）
- **#889 = PR #1131**: ビュー 4 本（`CalendarDesktopLayout` / `CalendarNarrowLayout` / `ScheduleOverlayHost` / `ScheduleEventEditor`）+ フック 5 本（`useScheduleSelection` / `useScheduleDayLabels` / `useEditorCloseGuard` / `useScheduleTodayAgenda` / `useCancelDeferredPopover`）へ分解し、**2 本の return を三項 1 本に統合**（どちらも `{sidebarPortal}` で開き `{overlaysEl}` で閉じていた = Desktop が `<ConfirmDialog>` を落としたのと同じ drift の形）。**挙動ゼロは className と `t()` キーの多重集合を機械照合して実証**（増減ゼロ・新規追加ゼロ）
- **`ScheduleStateCards` だけ `shared/` へ**: 他は `web/src/schedule/`（`ScheduleSidebar` が確立した先例 = shared の部品を組むだけの層に 25 個のラベルを通さない）だが、これは**何も組んでいない純粋な markup** で `AgendaList` / `MonthGrid` と同類。当初 web に置いてヘッダーが `ScheduleSidebar` の理屈を引いていたのをレビューが指摘 — そのまま残すと「再利用可能な部品を shared から締め出す」先例になっていた
- **転送コールバックこそがこの改修の壊れ方**: narrow の prev/next を入れ替えても 760 本が全部緑だった。**1 つ押して、その spy だけが動き、兄弟 spy は黙っている**形に書き直した（swap と prop 落としを区別できる）。9 本の item ジェスチャのうち 6 本が未検証だったのも埋めた
- **新規 3 本が無検証だった**（`ScheduleOverlayHost` / `useScheduleTodayAgenda` / `useCancelDeferredPopover`）: レビューが「壊しても 776 本が全部緑」を実証。`isWide` の close 畳み込み swap で 7 本、`popoverTodoChip` を null にして 3 本、`!isDismissed` 落としで 3 本が落ちるところまで書いた
- **新規テストのレース**: `ScheduleOverlayHost` の 4 ケースが `askConfirm`（**同期で呼ばれる中間**）を待っていて、`clearDirty` と `close()` が 2 マイクロタスク後に来る前に次へ進んでいた。ゲートを 1 回赤にした。**終端の効果を待つ**形に直し、6 回連続緑を実測
- **main が動いていた**: 待っている間に #1102（PR #1126）が入り、週初め設定を配線ごと退役させていた。レビューはこれを「`weekStartsOn` という prop を新規追加した」と報告したが、**比較相手の main が動いた側**。取り込んで配線を落として解消
- **#1132（追いかけ）**: #1113 のコメント 4 つの誤りを訂正。最大のものは `permanentDeleteRoutine` の「2 つの経路で到達する」— **`convertEventToTodo` は routine 由来のイベントを最初に突き返す**ので経路 (a) 単独では `routine_item_id` が NULL の残骸しか作れず FK には無害。(a) のあとに (b) が続いて初めて詰まる = **1 本の経路の 2 段階**で、(b) を直せば完全に閉じる。census の自己チェックも `.delete(` の生カウントから「`.from("items_meta")` が動詞に到達するか」へ差し替え（生カウントは `from("events_payload").delete()` と `claimed.delete(key)` で誤爆する — 両方実測）。role 判定も入れ子の引数テキストを読まないよう top-level リンク限定に

### 2026-08-18 - 担当キューの残り 9 件を、1 Issue = 1 ブランチ = 1 PR で出し切った

#### 概要

`section:schedule` の残り 9 件（#1044 #1034 #1033 #1000 #998 #997 #996 #995 #889）をすべて PR にした。全部 origin/main から独立に切り、**1 本ごとに CI `verify` の全ステップ（shared → web → desktop → mcp-server）+ `docs-lint` をローカルで exit 0 まで通してから** push している。提出時点で #1080 / #1081 / #1082 / #1085 は merge 済み、残り 5 本 open。判断キュー 3 件と outbox の起票依頼 2 件を別ブランチに分けた。

#### 変更点

- **#996 = PR #1080（role ガードの横展開）**: schedule 系の `items_meta` UPDATE を全数監査して **18 箇所中 16 箇所が id だけで当てていた**ことを実測（`SupabaseScheduleItemsService` 8 / `SupabaseRoutinesService` 8）。全部に `.eq("role", ...)` を足して 18/18 に。**安全な結末はエラーではなく 0 行ヒット** — PostgREST は「1 行も当たらなかった UPDATE」をエラー無しの成功として返すので、古い操作は静かに消える。行を読み返す 3 本はさらに強く、`assertItemsMetaPair` が `task` 行を event として写すのを拒否して reject する。**DELETE と `SupabaseTodosService`（変換の反対側）は Issue のスコープ外なので触らず outbox で起票依頼**
- **#1033 = PR #1081（narrow のハンバーガー）**: Schedule だけが `tabs` シェイプに乗っていて、その埋め合わせに **CalendarTab が 2 本目のハンバーガーを月見出しの行に自前で描いていた**。descriptor を `tabs+hamburger` に倒して自前の方を削除 — `NarrowHeaderRow`（#1035）が既に「ハンバーガー → タブ → アクション」の順で描くので**新しい描画コードはゼロ**。副作用として narrow の Todo タブでハンバーガーが空のドロワーを開くので、機構を足さずキューへ（D-20260818-sched-2）
- **#1034 = PR #1082（FAB → 「+追加」）**: DoD の「同一の部品」を確かめたら **Materials の「+ノート」は部品ではなくインラインの `<button>` が 2 コピー**だった。`shared/src/components/AddPill.tsx` に切り出して 3 箇所とも差し替え。日付キャプションの行を `shrink-0` にしてアジェンダのスクローラの外へ出したので、予定がいくら伸びてもボタンは動かない。FAB 用の `pb-24` は 3 分岐すべてから削除。**`MobileFab` はホストがゼロになったが残した**（配置の理由が 3 件のバグから学んだ高価な部分・退役は P-002 の grep が要る別判断）
- **#995 = PR #1085（sticky フッター）**: `BottomSheet` に footer スロットを足さず、**パネル 2 枚に opt-in の `stickyFooter` prop** を足す形にした。シートの子はパネル自身のカードなので固定したい行はもうその中にあり、シート側に足すと `ResponsiveDetailFrame` と `ItemDetailOverlay` の `actions` との整合が要る。**Desktop 不変は構造で担保**（既定 off + ホストが `!isWide` を渡す）。z-index はあえて付けない（TagPicker / TimeRangeField のポップオーバーが `z-20` で、上に積むと開いたドロップダウンを埋める）
- **#1044 = PR #1088（ロール表示 → ヘッダーのグリフ）**: 実物は Issue の想定と 2 点ずれていた — 「Todo」は `TodoDetailPanel` ではなく **TagPicker がタグ行のキャプションに描いていた kind バッジ**で、**どちらのパネルもヘッダーを持っていない**（タイトルはフレーム側）。フレーム連鎖に `titleIcon` スロットを足し、`ItemRoleBadge` の compact に `role="img"` を付けた（素の `<span>` の `aria-label` は `generic` ロールで確実に露出しない = 言葉を消した面では退行になる）。**新規 i18n キーはゼロ**
- **#998 = PR #1090（narrow の変換入口）**: Desktop の入口はバブルの中にあり `isWide` で描画が切られていたので、narrow には入口が存在しなかった。`EventEditorPane` に optional な `convert` バンドルを足して、**保存フッターの中ではなく削除の上**に置いた（フッターはパネル唯一のコミットで、#995 以降は固定ストリップ）。`requestEditorConvert` は閉じるときと同じガードを通すが**合意された破棄でも pending フラグをクリアしない**（変換はこの後に自分の質問を投げるので、拒否されると下書きが画面に残る）
- **#997 = PR #1092（変換の Undo）**: 「逆変換 + スナップショットのパッチ」。逆変換だけでは**種類は正しいが形が違う行**に着地する（どちらの方向も自分を完全に指定した payload を UPSERT するので、触れていない列は NULL / false で返る）。`eventRestore` / `todoRestorePatch` を純関数として `shared/src/utils/itemConversion.ts` に置き、パッチのキー集合をリテラルでテストに固定した。Todo 側は **role を先に戻す**（`tasks_payload` はそれが着地するまで存在しない）ので呼び出し順序も assert
- **#889 = PR #1094（作成パネルの抽出）**: 開く 4 本 + 確定する 5 本を `useScheduleCreateFlow.ts` へ。**1,636 → 1,479 行**。9 本のうち 3 本（`openCreatePanel` / `finishCreatePanel` / `scheduleTodoAt`）は外部呼び出しゼロなので private のまま。挙動保存は**機械で確認**した（rename を当てた HEAD 版と diff して、差分は依存配列 2 行だけ）。`useCreatePanelNotes` を残したのが「context-free = Provider 無しで `renderHook` に載る」を成立させていて、これが**この一連の処理が初めてテスト可能になった**理由
- **#1000 = PR #1095（作らずに固定した）**: 求められている面は **#761 が #626 の上に既に載せていた**。作り直すと `todoDetailId` を奪い合い未保存ガードが二重化するので、代わりに継ぎ目 2 つを塞いだ — 日リストの合成 id と `itemTapRoute` の接頭辞判定が**一致している保証がどこにも無かった**こと、および `ScheduleTodoDetail` が narrow でシートであること（`wide` ハードコードへの退行は既存ケースを全部緑のまま通す）。production 行数ゼロ
- **判断キュー 3 件 + outbox の起票依頼 2 件**を `chore/tracker-schedule-refine-20260818b` に分離（D-20260801-main-1 / D-20260802-sched-1）

### 2026-08-18 - Mobile narrow の 2 件: 追加パネルの溢れ（#1036）と月ビューのドット打ち切り（#1045）

#### 概要

`section:schedule` の Mobile Issue 2 件を 1 本ずつ PR にした（**#1054 / #1059 とも open**）。どちらも直したのは shared の部品だけで、`CalendarTab` は 1 行も触っていない。**2 件とも「足りない情報が画面に無い」型**で、片方は CSS の自動最小サイズ、もう片方は打ち切りの黙殺。CI の `verify` を上から全ステップ + `docs-lint` を回して exit 0（shared 2,375 pass / web 570 pass / desktop 7 pass / mcp-server 301 pass）。

#### 変更点

- **#1036 の原因は「広すぎる幅」ではなく `min-w-0` の不在**: flex アイテムの `min-width` は既定 `auto` で、**中身の min-content 幅が縮まない床**になる。素の `<input>` が申告するのは表示中の "HH:MM" ではなく**ブラウザ既定の約 20 文字分の箱**なので、`flex-1` を 2 つ並べた時間フィールドは床だけで 370px 前後 → 375px では右へ抜けるしかない。**`w-full` では直らない**（親が intrinsic minimum を計算する間、パーセント幅は無視される）。日付行も同型で、`<input type="date">` の床と `shrink-0` の終日スイッチのあいだに縮む余地がゼロ = これが「終日ボタンと重なる」の正体
- **直したのはクラス 3 箇所だけ**（`TimeRangeField` の開始 / 終了列・`EventEditorPane` と `ItemCreatePanel` の日付列）。挙動・DOM 構造・props は無変更。Todo / ノートのタブでも出ていたのは、`isAllDay` が event ターゲット限定で**todo タブでは常に時間フィールドが描かれる**ため
- **jsdom は寸法が全部 0 なので溢れ自体は検証不能**（CLAUDE.md §7.1）。実ブラウザ確認は DoD どおり chat-main の手番として残し、代わりに**クラスの綴りを固定**した。今回の退行は「ユーティリティが書かれていなかった」ことで、`cn` は tailwind-merge ではなくただの文字列連結だから 1 クラス落ちても無言で戻る — 先例は `bottomSheetSafeArea.test.tsx` の safe-area ガード。**終日スイッチの `shrink-0` も同じテストで固定**（日付が縮めることに意味があるのは隣が縮まないからで、片側だけでは守りにならない）
- **#1045 は上限が 2 つあることが本体**: 月グリッドはチップ 2 個 / ドット 3 個で切るのに `overflow` が 1 つしか無く、共有すると**ドット行の下にチップ側の数字**が出る（8 件の日が「+5」ではなく「+6」）。density ごとに数える形へ
- **文言は Desktop と同じ `formatMoreCount` を使い回した**（en = `+N more` / ja = `他 N 件`）。同じ事実に 2 つ目の言い回しを作らないため、i18n カタログの追加はゼロ。`text-[0.625rem]` は rem（Settings のフォントサイズ設定に追従させる）・`whitespace-nowrap`（セルが画面幅の 1/7 しかなく、折り返すとその行だけ背が伸びて 6 週分の行がガタつく）
- **`CalendarTab` は無変更で済んだ**: narrow の分岐は**元から `formatMoreCount` を渡していて**、compact 側がそれを一度も呼んでいなかっただけ。Issue 本文が警戒していた #889 の分割（#1051）との衝突も出なかった
- **テストは数字そのものを固定した**（4 件）。同じセルに上限が 2 つある以上、「マーカーが出ている」だけの assert は**間違った上限で数えた値も通す**。既存の「compact ではチップを描かない」ケースは今も緑（7/09 は 3 件ちょうどで、ドット上限に収まる）だが、意味が「チップ側の数字が漏れていないこと」に変わったのでコメントを足した

### 2026-08-17 - main の赤（担当外 mcp-server）を解除し、#889 の 3 ユニットを着地させた

#### 概要

前夜提出した 4 PR（#990 / #1016 / #1018 / #1022）の merge 中に **main が CI 赤**になり、全レーンの PR が緑にできない状態になった。原因は `mcp-server` の `searchAll` の戻り値型で、schedule レーンの担当外だが修正を出している人がいなかったため、こうだいさんに確認のうえ着手（PR #1031）。あわせて #1018 のコンフリクト解消と、他レーン 2 本（#1029 / #1030）の CI 再発火まで見た。最終的に #889 の 3 ユニットは全部 merge 済み、`CalendarTab.tsx` は **2,234 → 1,778 行**。

#### 変更点

- **PR #1031（mcp-server / main の赤）**: `searchAll` が `{ totalHits: number }` だけを返していた。`return { ...result, totalHits }` で `number` が index signature（`DomainPage<unknown>`）に代入できず、**TS が signature を広げるのではなく丸ごと落とす**ためドメインのキーが全部消える。**実行時は正しく `.todos` を返しており、忘れているのは型だけ**。`result` を `Partial<Record<Domain, DomainPage<unknown>>>` に変えて根本から直し、`searchPaging.test.ts` の `as Record<string, unknown>`（型の嘘を迂回するためのキャスト）を外した。新規 `searchAllShape.test.ts` 6 件は **`as` を 1 つも使わず** `.todos` を読む形
- **なぜ今日まで赤くならなかったか**: 支えが 2 本あって同時に外れた — 既存テストのキャスト迂回と、mcp-server に `typecheck:tests` ゲートが無かったこと。**#1010（D-20260816-main-2）がゲートを足し、#1003（PR #1021）が `.todos` を素直に読むテストを足した** = 単独ではどちらも緑の意味的な合流事故
- **#1018 のコンフリクト解消**: #1016 が先に merge されて衝突。**衝突は import 2 行だけ**で、互いに「相手が消したものを自分はまだ持っている」形だったので**どちらも残さない**のが正解だった。本体は自動マージされ、`overlaysEl` が `frames.todoDetail` に新しい `<ScheduleTodoDetail>` を受け取る形で噛み合った
- **`gh run rerun` の落とし穴**: pull_request の run は**記録済みの merge commit を再生する**ので、base が直っても古い base のまま同じエラーで落ちる。反映には新しい pull_request イベント（push or close→reopen）が要る
- **merge ref の実測**: #1030 は close → reopen を 2 回やっても赤のままだった。`git fetch origin refs/pull/1030/merge` で GitHub が建てている merge commit を直接取ると**その時点では修正を含んでおり**、再計算の遅れだったと分かった（#1029 は 1 回で通った）。**再発火の前に「GitHub は今どの base で建てているか」を確かめる**のが正しい順序

### 2026-08-16 - 判断キュー 2 件の昇格と、#889 で見つかった Desktop の確認ダイアログ欠落

#### 概要

判断キューの残り 2 件（D-20260816-sched-2 / sched-3）をユーザー回答（どちらも A）を受けて台帳へ昇格し、`chat-schedule-refine` の open エントリをゼロにした（PR #990）。続けて #889 を 3 ユニット提出（PR #1016 / #1018 / #1022）。**うち #1016 は分割の副産物として実バグを掘り当てた** — `CalendarTab` の 2 つのレイアウト分岐がそれぞれ手でオーバーレイを数え上げていて、**Desktop 側にだけ `<ConfirmDialog>` が無かった**。`useConfirmDialog().ask()` はその dialog が答えたときにしか解決しないので、Desktop では確認が永久に返らない（編集途中の詳細が閉じられない／子持ち Todo の削除が走らない／Event↔Todo 変換が止まる）。例外もトーストも出ないため、8 ゲートすべて緑のまま通っていた。全 PR で CI 緑。

#### 変更点

- **判断台帳**: `D-20260816-sched-2.md`（props を束ねた部品のテストは**ケース本体を変えずファクトリだけ畳む** — 挙動変更ゼロの証明は「同じケースが部品の差し替えだけで緑」という形でしか取れない。#889 以降の同種リファクタにも適用）/ `D-20260816-sched-3.md`（一括生成の R2 cleanup は現状維持。事前チェックが 2 系統そろった今 23505 に到達するのは生成器との競合時だけで、撃ち直しは**最も衝突しやすい瞬間に往復を 1 本増やす**経路を常設することになる）。`ANSWERS.md` への転記も当チャットが受任
- **#1016 オーバーレイ群**: `web/src/schedule/ScheduleOverlays.tsx` を新設し、両分岐は `{overlaysEl}` を置くだけに。順序で意味を持つのは #707（確認ダイアログが最後）だけなので、それだけ明示した。作成面の幅分岐も 1 つに畳んだ（`QuickCaptureSheetProps extends ItemCreatePanelProps` なので pools / handlers / labels が丸ごと共通）。**変異テスト**: `!isWide &&` を戻す（= 修正前を再現）と Desktop の 2 ケースだけが落ち、他 15 件は緑
- **#1018 Todo 詳細面**: `ScheduleTodoDetail.tsx` へ本体・フレーム・**#736 のガードをまとめて**移した。ガードは元々 400 行離れており、守る対象は「このパネルを畳む 3 つの出口」に限られる — **4 つ目の出口を足す人の目の前にガードが無い**のが問題だった。**変異テスト**: 「Todos へ」のガードを外すと 3 ケースが落ちる
- **#1022 繰り返し半分**: `useScheduleRepeats.ts` へ。**jsdom に `CalendarTab` が載らないせいで、この範囲は今日まで 1 行もテストできていなかった**。規則 3 つはどれもマークアップに現れない（#408 の一覧はタブが開くまで走査しない / 行き先の日を生成してから移動する / フィルタ解除が先）。**変異テスト 2 本**でそれぞれ対応する 1 ケースだけが落ちることを確認
- **コメントの訂正 1 件**: 旧コードは「BottomSheet はマウントされたままなので sheet は open 状態より長生きする」と書いていたが、`BottomSheet.tsx:103` は `if (!open) return null`。アンカー日が要る本当の理由は「`initial.date` が #940 以降 required で、`QuickCaptureSheet` は `initial` を自分の prop として受ける」ため
- **行数の実測**: 2,234 →（#1016）2,054 /（#1018）2,075 /（#1022）2,117。**1 ユニット 110〜180 行**なので、1,000 行到達にはこの規模があと 6 本以上要る

### 2026-08-16 (4) - 監査由来 3 件 + #940 + #889 の 4 ユニット（PR 8 本）

#### 概要

D-20260816-sched-1 を台帳へ昇格（PR #959）したうえで、#932 / #933 / #934 / #940 を各 1 PR、#889 を 4 ユニットに割って提出した。全 PR で `shared` lint / build / test・`web` lint / build / test・`web typecheck:tests` の 7 本を exit 0 で確認。**8 本すべて同日中にこうだいさんが merge**（#964 / #966 / #968 / #972 / #974 / #976 / #982 / #987）。

**運用面で 3 つ踏んだ**: ① **#982 だけ CI が一度も発火しなかった** — push しても空コミットでも close→reopen でも `gh run list --branch` がゼロ件で、origin/main を取り込んで push した時にようやく走った。`gh pr checks` の「no checks reported」は「遅い」ではなく「走っていない」。② **push-after-merge を 3 度目に踏んだ** — PR #959 が merge された後に積んだ tracker commit がブランチに取り残された（`chore/tracker-schedule-refine-20260816-5` へ cherry-pick で回収）。**tracker ブランチにも「PR を立てたら以後 push しない」が要る**。③ **merge 解決中の `git add -u`** が他レーンの tracker を巻き込み、guard が正しくブロックした（merge commit では unstage すると merge が壊れるので、この場合に限り理由付きの `[tracker-ok]`）。

#### 変更点

- **#932（sev:important・PR #964）**: ルーチンのオカレンスをゴミ箱に入れると `(routine_item_id, source_date)` の席が空き、生成器がその日を新しい行で埋め直す。あとから復元しようとすると 2 行が同じ席を要求し、`0008` のトリガが書く `is_deleted_cache = false` が partial UNIQUE に 23505 で弾かれる。**呼び出し側が全員この例外を握り潰していた**ので「押しても戻らない」だけが残っていた。**要点は「これは失敗ではなく拒否」**という読み替えで、`bulkRestoreScheduleItems` の戻り値を `{restoredIds, conflictedIds}` に変え、**書く前に**衝突を解決する形にした（1 日の衝突でカスケード全体が落ち、手作りの種イベント #296 まで取り残されていたのが直る）。競合で 23505 が返ったチャンクは **id 単位で撃ち直す**（PostgREST はどの行が負けたか言えないため）。単発の `restoreScheduleItem` は生の制約名ではなく `ScheduleRestoreConflictError` を投げ、Trash 画面が「その日にはもう同じ繰り返しがあります」と「復元できませんでした」を撃ち分ける
- **#933（PR #966）**: 事前チェックが **DB としか照合していなかった**ので、同じバッチ内に同じ席を狙う行が 2 つあると素通りしていた。`events_payload` への INSERT は 1 文なので 23505 で全行が巻き戻り、R2 cleanup が直前の `items_meta` を全件消す = 30 日分の月埋めが 0 件になる。**cleanup 自体は正しい**（payload が 1 行も入らない以上 meta は全部が孤児）ので、直したのは事前チェック側。**DoD 2 の「どの経路で重複が入るか」は「現行 3 経路からは入らない」と実測**（`reconcileRoutineScheduleItems` は 1 要素配列 / ビルダーは日付 × ルーチンで 1 度ずつ / `routines` は fetch で配列ごと置換されるか id ガード付き。唯一ガードの無い追記が `useRoutinesAPI.ts:134` の redo だが連続発火できない）。**到達不能と分かっていて塞いだ**のは、成立条件がどこにも書かれていない前提で、破れたときの代償が制約違反の重さに全く見合わないため
- **#934（PR #968）**: `permanentDeleteRoutine` がオカレンスを 1 件ずつ delete していた。コメントは「Todos の子孫優先パターンに倣って」と書いていたが、**順序が要るのは events → routine の間だけ**（`0011` の composite FK が NO ACTION）で、オカレンス同士は兄弟。`forEachIdChunk` に寄せて 500 往復が 3 往復に。#897 の DoD が未テストと名指ししていた削除順序を新規テストで固定
- **#940（PR #972）**: 追加パネルの日付が読むだけの一行（`dateLabel`）だったのを date input に。**4 つの submit コールバックを `ItemCreateSlot`（date / start / end / isAllDay）1 個に畳んだ**のが本体で、これが無いとホストが日付を自分の state から読み、ユーザーが選んだ日を無言で無視する。終日スイッチは `EventEditorPane` と**同じ部品**（`AllDaySwitch`）に切り出して共有 — 作るときと直すときで「終日」が別物にならないため。**ノートタブだけ Issue の想定と変えた**（日付・時刻は作成対象 `target` に属するので、ノートタブでも表示したまま）。Briefing も今日以外に書けるようになり、他の日の行は今日の紙面から外す
- **#889 ①（PR #974）**: return が 2 本あるせいで、イベント詳細と Todo 詳細が**入れ物を 2 回書いていた**（Desktop の `ItemDetailOverlay` と Mobile の `BottomSheet`）。Todo 側のコメントは既に「2 つ目のリテラルは片方の画面がガードを落とす原因になる」と書きながら**入れ物は 2 リテラルのまま**だったので、その文を 1 段外へ適用して `ResponsiveDetailFrame` に。`open` / `onClose` は本当に画面ごとに違う（Mobile では選択そのものがシートの開閉）ので呼び出し側に残した
- **#889 ②（PR #976）**: Event ⇄ Todo 変換 150 行を `useItemConversion` へ。**文言をフック内で解決している**のは、どの文が出るかがこの変換に何が起きるかそのもの（ルーチン不可 / 子持ち不可 / 親が切れる予告 / 通常確認 / 失敗）で、先に文字列化して渡すと分岐まるごとをデータとして渡すことになるため。**切り出して初めてテストが書けた**（8 件）
- **#889 ③（PR #982）**: 時計が `setNowMinutes(nowMinutesLocal())` と `setNow(new Date())` の **2 回読み**だった。分境界をまたぐと線の位置と行の判定時刻が 1 分ずれる。`useMinuteClock` は 1 回読んで分を導出。オーバーレイ 4 flag は `useScheduleOverlays` へ（**閉じる操作は束ねない** — 3 箇所が別の動作なので、1 つのヘルパは残り 2 箇所で静かに間違う）。state をフックへ移すと `exhaustive-deps` が setter の安定性を見失うので dep 配列に明記し、**既存の 4 warning ごと解消して web lint を 0 に**
- **#889 ④（PR #987）**: カレンダーレンズ（#468）を `CalendarLensRow` へ。移す価値があったのは**「出ない」ほうの 2 ルール**（チップ 0 個なら行ごと出さない = 読み込み中と取得失敗も同じ / 非表示件数はレンズ自身の分だけ）で、コメントよりテストのほうが保つ。Desktop の本体 4 分岐も return の外へ
- **決定**: D-20260816-sched-1 を `decisions/D-20260816-sched-1.md` へ昇格（`ANSWERS.md` への転記も当チャットが受任 — D-20260810-sched-1〜5 と同じ扱い）。**#933 の R2 全滅を撃ち直しに変えるかは挙動変更なので判断キュー D-20260816-sched-3 へ**（Issue 本文の指示どおり）

### 2026-08-16 (3) - #889 CalendarTab 分割 1/n: 右サイドバーを切り出す（PR #941）

#### 概要

`CalendarTab` の右サイドバー（3 タブ = 今日の流れ / 本日の Todo / 繰り返し）と、その切り替え・レイアウト畳み込みを `web/src/schedule/ScheduleSidebar.tsx` へ切り出した。**2,578 → 2,446 行**。挙動変更ゼロ。8 ゲートすべて exit 0。**#889 は 1 PR で閉じない**（Issue 本文の指示）ので、これは 1 本目。

#### 変更点

- **抽出単位の選び方**: Issue のステップ 1 が最初に挙げている `flowBody` / `repeatsBody` / `todoBody` / `sidebarPortal` をそのまま 1 単位にした。この 4 つは「右サイドバーに何を出すか」という 1 つの問いの答えで、間に挟まっていた `handleConvertToTodo` / `handleConvertToEvent`（Event↔Todo 変換 ≈150 行）は別単位として残した
- **抽出先は `shared/` ではなく `web/src/schedule/`**（Issue 本文からの逸脱・PR に明記）: 切り出す対象は **shared に既にいる部品（`AgendaList` / `TodayTodoTray` / `RepeatListPanel` / `RoutineSummaryCard`）を組み合わせるだけの層**で、自分の文言は `useTranslation()` で解決している。shared へ押し込むと**組み合わせ以外に何もしない層に約 25 個のラベル文字列を通す**ことになり、#893 でその下の部品から取り除いたばかりの形になる。#675 が `CalendarTab` から剥がした 15 ファイルも全部 `web/src/schedule/` にいる
- **`<RightSidebarPortal>` は呼び出し側に残した**: ポータルは Provider 無しだと `null` を返す（`RightSidebarPortal.tsx:30`）ので、部品に畳み込むと**シェル一式を立てないテストから中の分岐が 1 つも見えない**。配置はホストの都合という責務の切り方としても正しい
- **テスト 11 件はマークアップではなく「黙って壊れる規則」を固定**（`web/tests/scheduleSidebar.test.tsx`）: ① `todo` は Desktop 専用なので narrow では flow に畳む（#467 — 壊すとスイッチャーの下にトレイが出てどのタブもアクティブに見えない）② 繰り返し一覧は narrow で `onDelete` を渡さない（#467 — 指先サイズの標的から系列ごと消せる）③ ルーチン集計は Desktop のみで、その CTA が flow → repeats の唯一の導線 ④ #466 のフィルタ通知は ON のときだけ出て、そのボタンが OFF に戻す
- **変異テストで実効性を実測**: ①②③ を潰す変異を同時に入れたら**落ちたのはちょうど対応する 3 テストだけ**（8 件は緑）。#897 では「落ちた件数が多い＝良いテスト」ではないと学んだが、今回は件数ではなく**どれが落ちるかが 1 対 1 で対応**しているのを確認できた
- **`web typecheck:tests` が今回も効いた**: vitest は 11/11 緑なのに型は 2 件落ちていた（`skipped` の `isAllDay` が `ScheduleItem` 側で `boolean | undefined` / テストの `statusLabels` のキーが `ScheduleStatus` と不一致）。ローカルの既定コマンド一覧に無いゲートなので #889 の残りでも毎回回す
- **変異前にコミットした**（#897 の教訓の適用）: #897 では `git checkout --` で変異を戻したときに同じファイルの未コミットの修正まで消した。今回は先に commit してから変異 → `git checkout --` で安全に復帰
- **残り**: `CalendarTab` はまだ 2,446 行で DoD の 1,000 行に届かない。残る塊 = オーバーレイ群（popover / detail / todoDetail / create / scope ≈350 行）、Desktop・Mobile 2 本の return（≈350 行 = ステップ 2）、Event↔Todo 変換（≈150 行）、state の 3 グループ化（ステップ 3）

### 2026-08-16 (2) - #893 Schedule 共有部品の props ドリルを畳む（PR #936）

#### 概要

`WeekTimeGrid` 28 / `EventEditorPane` 19 / `ItemCreatePanel` 12 の props を、それぞれ 6 / 7 / 6 に畳んだ。挙動変更ゼロ — 各部品は束ねた prop を**本体がこれまで使っていたフラットな名前に戻して**受け取るので、シグネチャより下の行は 1 行も動いていない（デフォルト値も分解の右辺に据え置き）。8 ゲートすべて exit 0。merge は未（P-001）。

#### 変更点

- **バンドルの切り方**: `WeekTimeGrid` = `data`（描くもの）/ `labels`（固定コピー）/ `handlers`（操作面）/ `display`（ジオメトリ）/ `format`（計算コピー）。`EventEditorPane` = `item` / `labels` / `handlers` / `options` / `repeat` / `tagSlot`。`ItemCreatePanel` = `dateLabel` / `initial` / `pools` / `handlers` / `formatDuration` / `labels`
- **束ねると型が守ってくれた 2 箇所**（整理以上の見返りはここ）: ① `EventEditorPane` の繰り返しセクションは `repeatLabels` + `repeatWeekdayLabels` + `onChangeRepeat` の**3 つの optional prop が全部揃ったときだけ**描画される作りで、2 つだけ渡すと**無言で何も出ない**（`showRepeat = !!onChangeRepeat && !!repeatLabels && !!repeatWeekdayLabels`）。必須メンバーを持つ 1 オブジェクトにして半端な配線をコンパイルエラーにした ② `ItemCreatePanel` の 4 つの書き込みは 4 つの独立した通知ではなく 1 つの能力で、3 つだけ配線したホストは「4 つ目のタブで押しても何も起きない送信ボタン」を出荷できた
- **Issue ステップ 2（セクション層 Context から直接取る）は不採用**: `ItemCreatePanel` のホスト 3 つのうち **Briefing（`BriefingScreen.tsx:477`）は Schedule のセクション層 Provider の外**にいる。そのまま当てると Briefing が壊れるので、オブジェクト prop への束ね側だけで DoD（各 10 個以下）を満たした。Context 消費はゼロ
- **Issue ステップ 3（描画重複の実測）**: 1:1 の重複は **1 件だけ** = `dotColorClasses` が `MonthGrid.tsx` と `AgendaList.tsx` に**バイト単位で同一**の 9 行として存在 → 新設 `shared/src/components/schedule/scheduleVariantVisuals.ts` に集約し、3 つの item 型が別々に書いていた `variant` のユニオンも `ScheduleItemVariant` として同居させた。**face マッピングは寄せない** — `variantBlockClasses`（WeekTimeGrid）と `chipFaceClasses`（MonthGrid）は同じ switch に見えて解決先のトークン族が違う（`schedule-*-bg` vs `chip-*-bg`。ブロックとチップは読まれるサイズが違うため意図的に別）。統合には族を選ぶ引数が要り、それは関数 2 つと同義。`TodayTodoTray` は共有する描画が無い
- **DoD「既存テストが無改変で緑」は文字通りには成立しない**ので、次に強い形に置き換えた: **`it(...)` の中身・アサーション・操作手順は 1 行も変えず**、各テストファイル冒頭の render ファクトリだけが束ね直しを引き受ける。`renderPane(manualItem, { canEditDate: true })` のようなフラットな呼び出しはそのまま残るので、「同じケース・同じアサーションが、部品だけ差し替えて緑」が挙動変更ゼロの根拠になる
- **ファクトリの `{...props}` スプレッドは明示マージに変える必要がある**（罠）: スプレッドは**束ごと置き換わる**ので、`{ existingTodos: [] }` がノート側のプールまで巻き添えで消す。オブジェクト prop を持つ部品のテストファクトリでは一律これを踏む
- **検証**: shared lint 0 errors（既存 warning 3）/ shared build / shared test **240 files 2232 pass** / web lint 0 errors（既存 warning 4）/ web build / **web typecheck:tests** / web test **53 files 474 pass** / `LC_ALL=C docs-lint` — すべて exit 0
- **申し送り（PR 本文に記載）**: 実ブラウザ検証は chat-main の手番。見てほしいのは ① 週 / 日ビューのドラッグ移動・リサイズ・空きスロット作成・終日ドロップ ② **エディタの繰り返しセクションが出ること**（分岐を書き換えた最重要点）と日付変更 / 終日トグル ③ 新規作成 3 経路（Desktop オーバーレイ / QuickCaptureSheet / **Briefing の「+」**）④ 月 / アジェンダの先頭ドット 3 色

### 2026-08-16 - #897 SupabaseScheduleItemsService の一括系にテストを足す（PR #929）

#### 概要

テストが 1 本も無かった一括書き込み 4 本（`bulkCreateScheduleItems` / `bulkDeleteScheduleItems` / `bulkSoftDeleteScheduleItems` / `bulkRestoreScheduleItems`）に vitest 19 ケースを追加し、ついでに実装と食い違っていたクラスヘッダーのコメントと、2 箇所に散っていた複合キーの綴りを直した。挙動変更ゼロ。7 ゲート + `web typecheck:tests` + docs-lint すべて exit 0。merge は未（P-001）。

#### 変更点

- **5 本目の `updateFutureScheduleItemsByRoutine` は既存テストが押さえていた**（`updateFutureScheduleItemsByRoutine.test.ts` の 6 ケース）ので、新規は残り 4 本。Issue の「テスト参照は 1 本だけ」は**ファイル数の話でメソッド数ではない**
- **一発で通るテストを信用しない**: 19 ケースが初回で全部 pass したので、実装に変異を入れて落ちることを実測した。重複排除の filter を外すと 3 件 fail / `items_meta` の INSERT を消す + soft-delete の `deleted_at` を落とすと 6 件 fail。**この確認をしないと「モックが実物から乖離していて何も見ていないテスト」が緑のまま残る**
- **クラスヘッダーが実装と食い違っていた**（`SupabaseScheduleItemsService.ts:34`）: 「bulkCreate は ON CONFLICT ignoreDuplicates を使う」と書いてあるが、30 行下の `bulkCreateScheduleItems` 自身の doc は「PostgREST は **PARTIAL** unique index に ON CONFLICT を向けられないので事前 SELECT にした」と書いている。実装は後者。**Issue の DoD が「`ignoreDuplicates` による冪等化をテストで固定」と書いているのはこの古いコメントを読んだため**で、実際に固定したのは事前 SELECT 方式の冪等化
- **複合キーの綴りが 2 箇所に散っていた**: `${routine_item_id}|${source_date}` を lookup 側と drop 側で別々に書いており、片方だけ変えると重複排除が黙って一致しなくなる。`routinePairKey()` に一本化し、事前チェック本体は private の `fetchLiveRoutinePairKeys()` へ切り出した
- **Issue のステップ 2（bulkCreate と updateFuture の共通部分抽出）は見送った**。Issue が挙げた 3 つを実測した結果、共通の中核が実在しない —「ルーチン由来の行の絞り込み」は bulkCreate が**これから INSERT する行へのメモリ上の述語**・updateFuture が**1 routine への DB クエリ**で同名の別物 /「2 行分割の組み立て」は bulkCreate が既に共有 `scheduleItemToRows` を使い updateFuture はそもそも行を組み立てない /「冪等化オプション」は bulkCreate 専用。またぐ抽象は呼び出し元 1 つずつの間接層になり行数がむしろ増えるので、判断キュー D-20260816-sched-1 に A/B を積んで A（見送り）で進めた
- **FK の実測**（migration 0008 / 0011）: `events_payload.item_id` → `items_meta(id)` は **ON DELETE CASCADE** なので `bulkDelete` は items_meta だけ消せばよい。一方 `(routine_item_id, routine_item_role)` の composite FK は **NO ACTION** で、こちらの子孫優先削除は `SupabaseRoutinesService.permanentDeleteRoutine` の責務（当サービスの担当外）
- **`git checkout -- <file>` で変異を戻した後、cwd が web/ に残っていて `git add` が空振りした**。background の Bash で `cd shared` / `cd web` すると次の呼び出しの cwd がそこに残る（`cd` はセッションに効かないという注記は出るが、実際には残っていた）。**リポジトリ操作は毎回フルパスで `cd` し直す**
- **変異テストの revert で未コミットの本命修正まで消した**（同セッションで実際に踏んだ）: 変異を入れたファイルに**まだ commit していない doc 修正が同居**していたので、`git checkout -- <file>` が両方を巻き戻した。**変異を入れる前にその時点の作業を commit するか、変異は別ファイル経由で入れる**

#### 独立監査 2 本の指摘と反映（追いコミット `0eef4dd3`）

- **doc のドリフトは 1 箇所ではなく 4 箇所だった**。初回コミットはクラスヘッダーだけ直していたが、同じ「ON CONFLICT ignoreDuplicates を使う」が `db-conventions.md` §10.8 / `scheduleItemMapper.ts` / `RoutineScheduleSync.tsx` に残っていた。**一番効くのは §10.8 で、ここは「そのレシピを規約として処方している」側**。次に partial UNIQUE な bulk 経路を書く人が従うと PostgREST が発行できない `onConflict` を書いて 400 を踏む。**1 箇所直したら同じ文言を全数 grep する**
- **ヘルパーを前に挿したせいで公開メソッドの doc が 0 行になった**: `bulkCreateScheduleItems` の直前に `fetchLiveRoutinePairKeys` を入れたところ、その上にあった 33 行の「Why NOT upsert」doc がヘルパーに乗り移り、公開メソッド側の doc が消えた。しかも直したばかりのクラスヘッダーが `(see bulkCreateScheduleItems' own doc)` と存在しない doc を指していた。**private ヘルパーは公開メソッドの後ろに置く**
- **テストが「実は見ていない」箇所が 4 件あった**（全部 mutation で確認）: ① 事前チェックの `.range()` を丸ごと消しても 19 件全部緑（本番では `fetchAllPages` が同じページを読み続けて**無限ループ**する経路）② 事前チェックが `is_deleted_cache` **だけ**で絞ることが「dismissed した日を再生成しない」唯一の担保なのに、`.eq("is_dismissed", false)` を足しても何も落ちない ③「手動イベントは重複排除しない」が空振り（手動のみのバッチは事前チェックが early-return するので判定を消しても通る）④ 未認証経路が未検証
- **信号を 1 件に絞るためにモックの既定値を入れた**: dismissed のテストを足しただけでは、`.eq("is_dismissed", false)` 変異で `undefined !== false` により**全 dedup ケースが道連れで落ちる**。フィクスチャの `is_dismissed` を既定 false にして、変異で落ちるのがちょうど 1 件になる形にした。**「落ちた件数が多い = 良いテスト」ではない** — どの契約が壊れたか見分けられることが要る
- **`bulkDelete` の「count of rows actually deleted」も嘘だった**（`count: "exact"` を付けていないので要求件数がそのまま返る）
- **Issue のステップ 3（SupabaseRoutinesService との重複）の実測**: 1:1 の重複は 1 件だけで、`SupabaseRoutinesService.ts:594-603`（`permanentDeleteRoutine`）が event の `items_meta` を 1 件ずつ delete している。コメントは「Todos の descendants-first を真似て」と言うが、**削除対象の events は互いに兄弟で順序制約が無い**（順序が要るのは events → routine の間だけ）。chunk 化すれば 500 オカレンスで 500 往復が 3 往復。**DoD の「削除順序（子孫→親）」の実体はここ**で、当サービスの担当外
- **監査が見つけた既存欠陥 3 件は outbox へ**（挙動変更を伴うので本 PR 外）: ① **Trash から予定を復元すると partial UNIQUE に弾かれて無言で失敗**（trash 中に生成器が同じ (routine, source_date) を作り直すと、復元時のトリガ UPDATE が 23505・`useRoutinesAPI.ts:289` が握り潰す）② バッチ内重複が事前チェックを素通りして 1 件の衝突でバッチ全滅 ③ 上記 `permanentDeleteRoutine` の chunk 化

### 2026-08-15 (2) - #877 todo の設定日付を出す / #878 Mobile Calendar を月ビュー主体に（PR #915 / #916）

#### 概要

#870 に続けて #877 → #878 を 1 Issue = 1 PR で消化した。#877 は todo 詳細に読み取り専用の日時行、#878 は narrow のメインを月グリッド + 選択日リストに置き換え（#692 の月シートは退役）。両方とも 6 ゲート exit 0、#878 は docs-lint も OK。merge は未（P-001）。

#### 変更点

- **#877 の本体は「表示が無い」ことだった**: `scheduledAt` は UI のどこにも描画されていなかった（`grep scheduledAt` の tsx ヒットが 3 件・全部コメントか書き込み側）。narrow では todo 詳細シートが唯一の入口なので、そこに出した
- **読み取り専用にした理由**: todo の配置はカレンダー上のドラッグ（とトレイの「今日に追加」）で行う操作で、パネルに編集口を作ると**結果がどこに落ちたか見えない唯一の画面**に 2 つ目の writer を置くことになる
- **`todoScheduleSlot()` を切り出した理由**: 「終了時刻が無ければ 60 分」「end ≤ start の退化スパンは終日として救済（#562）」は**外から見えない規則**で、パネル側に書き直すと簡単な場合だけ一致して難しい場合だけ食い違う（パネルが「13:00–13:00」と書く下でチップは終日レーンに座る）。`todosToCalendarChips` はこの関数を呼ぶ形に薄くなった（振る舞い不変）
- **#878 は「メインとドロワーが同じ問いに 2 回答えていた」**: メイン = アンカー日のリスト / ドロワー = 今日のリスト、で形も中身もほぼ同じ。逆にドロワーに置けない唯一のもの（月の俯瞰）がシートの奥にあった。**入れ替えた**のがこの PR
- **日別リストの置き場所はユーザー選択**（2026-08-15・選択肢 3 案を提示）: 「月グリッドの下に選択日のリスト」。**月グリッドのみ案は却下**した — 今日以外の日の予定を開く導線がモバイルから消えるため（ドロワーの flow は `todayAgenda` 固定で、アンカーに追従しない）
- **`effView` を narrow で常に `"month"` に**（`useCalendarNav.ts`）。#692 の実装がそうだったように、取得範囲・移動単位・期間ラベルの 3 つがこの 1 行に追従する。結果として**矢印は月送り**になり、日はセルタップで選ぶ
- **`MonthGrid` の `selectedKey` は「セル側」に印を付ける**: 日バッジは today のもので、今日かつ選択の日で奪い合うとどちらかが消える。`aria-selected` は `selectedKey` を渡されたときだけ出す — 全セルが `false` を名乗ると読み上げが「選ぶものがある」になり、選択の無い Desktop 月ビューで嘘になる
- **退役したものは i18n キーごと消した**（`scheduleScreen.openMonthView` / `monthSheetTitle`）。`web/tests/calendarNavMonthSheet.test.ts` は `calendarNavMonthMain.test.ts` に置き換え（開閉状態が存在しなくなったため）。**取得範囲と移動単位の assertion は残した** — #692 が最初に踏んだ罠（1 日ぶんの窓に 42 セルを描いて全部空）はこの形の変更で再発しうる
- **`mobile-scope.md` の #4 行を同 PR で更新**（CLAUDE.md §0）。narrow の実態を書いた行なので、放置すると「相互参照が整合したまま両方 stale」になる
- 検証: shared 233 files / 2135 pass・web 44 files / 392 pass（旧テスト 7 件削除 + 新規 5 件のため純減）・lint 0 errors・`LC_ALL=C bash scripts/docs-lint.sh` OK

### 2026-08-15 - #870 ルーチンのテンプレート時刻が変更前になる（PR #900）

#### 概要

時刻変更と繰り返し ON を 1 回の Save で行うと、その日は新しい時刻・翌日以降は変更前の時刻で並ぶバグを直した。原因は「Save の送信順」と「テンプレートの読み元」の食い違いで、Save がフィールド patch を繰り返しと一緒に渡し、手動→変換分岐がそれを種に重ねる形にした。6 ゲート（shared / web の lint・build・test）exit 0。merge は未（P-001）。

#### 変更点

- **送信順は変えずに、渡す物を増やした**: `EventEditorPane` は繰り返しを先に送る（フィールド patch が this/future/all ダイアログを出すので最後でなければならない = #279 / #712 の設計）。順序を入れ替えると 1 ジェスチャで 2 回聞くか、聞く前に系列を書き換えるかになるので、**先に行く側に patch を持たせる**方を選んだ（`onChangeRepeat(repeatEdits, patch)`）
- **種は 1 つに保つ**（`useRepeatMutations.ts` の `const seed = { ...selected, ...definedSeedFields(fields) }`）: 変換後の派生物は **ルーチンのテンプレート・可視範囲を埋める楽観 routine・変換が確保する日付（sourceDate / frequencyStartDate / windowStart）** の 3 つあり、全部 `seed` から作られる。Issue が「片方だけ直すとズレる」と書いていたのはここで、**種の時点で合成すれば下流は勝手に揃う**
- **実際に動いたキーだけ重ねる**（`definedSeedFields`）: patch は全フィールド optional なので、そのまま spread すると「未編集」が `title: undefined` として種を潰す。「編集していない」と「空にした」が同じ形になる patch では、重ね方を明示するしかない
- **既存シリーズ側（`selected.routineId != null`）は触っていない**: あちらの時刻はスコープダイアログ経由で入り、reconcile の rule-2 テンプレートは**変更前**の値であることが正しい（手編集された行を守るため）。同じ「seed が古い」に見えても意味が逆
- **`date` も重ねた**（Issue の方向性どおり）: 日移動 + 繰り返し ON を 1 Save でやると、旧日付を sourceDate で確保したまま行が新日付へ動いて**新日付に生成行と種行が二重に並ぶ**。新日付で確保すれば種行がそのスロットを持つ
- テスト: web 側に 2 件（同一 Save の時刻がテンプレートと materialiser の両方に届く / フィールド未編集なら item 自身の値が残る）、shared 側に 1 件（同じ press の時刻を繰り返しと一緒に運ぶ）。既存 3 assertion を 2 引数へ更新
- 検証: `cd shared && npm run lint / build / test`（0 errors・233 files 2134 pass）+ `cd web && npm run lint / build / test`（0 errors・44 files 396 pass）すべて exit 0。実ブラウザ検証は §7.4 により merge 後 chat-main

### 2026-08-13 - /goal 一括 4 件（#789 / #774 / #708 / #790）— PR 3 本 + 判断キュー 1 件

#### 概要

/goal 指定で #789 → #774 → #708 → #790 を順に消化した。実装できた 3 件は Issue ごとに `origin/main` から切って 1 Issue = 1 PR（**#798 / #804 / #813**）。#708 は Issue 本文自身が方式 A/B/C の裁定を求めていたため実装せず **D-20260812-sched-2** として判断キューへ積み、次の Issue へ進んだ（P-008）。3 PR とも 6 ゲート（shared / web の lint・build・test）を exit 0 で実測。merge は行っていない（P-001）。

#### 変更点

- **#789（PR #798）rightSidebar の空の殻**: `KanbanView` の削除と「予定に変換」は**どちらも行そのものが盤面から消える出口**なのに、選択を外すだけで殻を閉じていなかった。後始末を `closeDetailShell`（選択解除 + wide のみ `rightSidebar.close()`）に集約。**1 行を 2 箇所に書かずヘルパーにしたのは、2 経路が割れることがこのバグの形だから** — 削除だけ直せば今度は変換と食い違う。narrow は無変更（そこでは detail = BottomSheet で、殻は `isWide` の effect が持っている）。vitest 4 件（wide 削除で閉じる / 拒否では閉じない / narrow は mount 時の close 回数から増えない / 変換でも閉じる）
- **テストの tree モックに `refetch` が無かった**（#789 の副産物）: 変換の `.then()` が `tree.refetch()` を呼ぶのにモックに無く、**成功分岐が例外で `.catch()` の失敗バナーへ流れていた**。既存の変換テストは「convertTaskToEvent が呼ばれたか」しか見ていないので素通りしていた。追加して成功経路が最後まで走るようにした
- **#774（PR #804）別の日でも「今日の予定はありません」**: モバイル日ビューは矢印でも月シートでもどの日にも行けるのに空状態が `emptyToday` 固定だった。判定を `web/src/schedule/agendaEmptyLabel.ts` へ切り出し（**CalendarTab は Provider 一式と実レイアウトが無いと描画できず、中で決めたことはテストから見えない** = `taskChipPanel` / `unsavedCloseGuard` が外に出ているのと同じ理由）。**Dayflow タブ（今日の流れ）は `emptyToday` のまま** — あちらは本当に今日のリストで、分岐しても同じ文言にしかならない
- **`TranslationKey` は手書きの union ではない**（#774 で実測）: `shared/src/i18n/resources.ts:45` が `ParseKeys<"translation">` で **en catalog の型から導出**しているので、en / ja に足せば型は自動で通る。Issue 本文の「`TranslationKey` にも足すこと」は現状と食い違う
- **#708 は実装せず D-20260812-sched-2 へ**: 繰り返し削除の Undo で、ルーチン行だけが戻りオカレンスと種イベントは削除済みのまま・当日分が新 id で再生成される。A（全部を元 id で復元・推奨）/ B（種イベントのみ）/ C（現状 + 削除確認で予告）で UX が割れるため P-005 / P-008 に従いキュー行き。放置時は #708 保留
- **#790（PR #813）ガードとキーの引っ越し**: `todoTrayDeleteGuard.ts` を `web/src/schedule/` → `web/src/shared/`（**web ホスト自身の中立フォルダで、`@life-editor/shared` パッケージとは別物**。ファイル冒頭に明記した）、3 キーを `scheduleScreen.*` → `taskDetail.*`。**確認ボタンの `scheduleScreen.delete`（予定・繰り返しにも使う汎用の「削除」）も `taskDetail.delete` を新設して差し替えた** — Issue が名指ししたのは 3 キーだが、DoD「Tasks 側の削除文言がセクション非依存のキーになる」に確認ボタンも含まれると読んだ。表示文字列は全部そのまま
- **#798 と #813 は必ずコンフリクトする**（実装前に判明・PR 本文に明記済み）: どちらも `web/tests/kanbanView.test.tsx` を触り、**#798 が追加する describe の中に #813 が書き換える旧キーの文字列がある**。#813 のベースにはその行が存在しないので、**どちらを先に merge しても後続に旧キーが残ってテストが落ちる**。#798 → #813 の順で merge して #813 を rebase するのが素直（追従は 3 行程度）
- **CalendarTab を触る前に #673 との衝突を確認**（指示どおり実施）: `git fetch` 後 origin に 673 のブランチは無く、CalendarTab を触る open PR も無し（refactor-core レーンは 671 / 701 / 711 / 726 のブランチのみ）
- 検証: 3 PR とも `cd shared && npm run lint / build / test`（0 errors・217 files 1980 pass）+ `cd web && npm run lint / build / test`（#798 = 32 files 273 pass / #804 = 33 files 273 pass / #813 = 32 files 269 pass）をすべて exit 0 で実測。実ブラウザ検証は merge 後に chat-main

### 2026-08-11 (2) - #691 / #692 の Step 1（narrow の実ブラウザ実測 + 月ビュー入口の A/B 案）

#### 概要

/goal 指定により #691 → #692 の Step 1 だけを実施した（実装コードは書かない指定）。#691 は narrow Schedule を実ブラウザで実測して不足点を Issue にコメント、#692 は月ビューの入口案 2 件を判断キュー D-20260811-sched-2 として積んだ。両 Issue ともユーザー回答待ちで Step 2 に入っていない。`web/` `shared/` の変更はゼロ。

#### 変更点

- **narrow の実測手段**: `resize_window` が OS 側で効かず `innerWidth` が 2560 のままだったため、**同一オリジンの 390px iframe** を置いて中の `matchMedia("(min-width: 768px)")` を false にする方法で Mobile 分岐を描かせた。dev server は chat-main の 5173 を**読むだけ**（§7.4 の制約は起動の話なので抵触しない）。今日は予定 0 件だったのでユーザー承認を得て検証用の予定 3 件 + Todo 1 件を作成 → 計測後に全削除（月ビューで残存 0 を確認・ソフトデリートなのでゴミ箱には残る）
- **#691 の実測結果**（Issue コメント `#issuecomment-5249406615` に全文）: ① 時間軸が無く**行高は所要時間に依らず一律 43px**（`AgendaList.tsx:128` に所要時間の項が無い）② 終了時刻が `AgendaItem.endTime` として渡っているのに描画されない（`:24` vs `:137-139`）③ 60 分の空きでも隙間 0px ④ **進行中の予定が現在線の上（過去側）に出る** — 分割が開始時刻だけを見る（`:100-102`）⑤ 予定 0 件の日は今日でも現在線が出ない（線が timed の map の内側 `:217-227` にしかない）⑥ 今日以外で線が出ないのは仕様どおり（`CalendarTab.tsx:2505`）⑦ **#593 の Todo アクセントは narrow で無傷**（ドット rgb(91,140,255) vs 予定 rgb(167,139,250) + CheckSquare・幅による分岐が構造的に無い）⑧ ただし Todo 行は status を積んでいないため完了不可（`CalendarTab.tsx:1188-1196` → `AgendaList.tsx:176`）かつタップが no-op（`:471` の `if (isWide)`）
- **Issue の前提は実測でも支持できる**: 「現状が既にかなり近い」は正しく、構造（AgendaList + BottomSheet + FAB）を保ったまま所要時間の表現と現在線の分割を直せば足りる。作り直しは不要
- **#692 = D-20260811-sched-2**（A = ヘッダ日付タップで月シート / B = narrow に 日・月 の 2 択トグルを戻す・放置時 = 現状維持）。**#467 が消した switcher をどうするかを各案に明記**した
- **`effView` の 4 消費点をトレース**: 直す必要があるのは **`useCalendarNav.ts:32` の 1 行だけ**。`step()` の month 分岐（`:64`）も `visibleCalendarRange` の month 分岐（`shared/src/utils/calendarView.ts:44`）も `periodLabel`（`CalendarTab.tsx:918`）も `isWide` で囲われていないので自動追従する。残る配線は narrow の描画分岐に MonthGrid を出す 1 点
- **`MonthGrid` は narrow 対応済みだった**: `compact` prop（day badge + dot row）が実装済み・テスト済み（`MonthGrid.tsx:62-63` / `shared/tests/monthGrid.test.tsx:73-110`）なのに `CalendarTab` から渡されていない。セルは `min-h-14` = 56px。**#692 は作り替えではなく配線**

### 2026-08-11 - #628 保存ボタン + #625 Event ↔ Todo 変換（重ティアフルチェーン・PR #681 / #684）

#### 概要

D-20260810-sched-1〜5 の全 A 回答（sched-5 はダイアログ提示をユーザー指定）を受けて、残 2 Issue を重ティアのフルチェーン（role-engineer → 独立監査 → 指摘全修正 → 6 ゲート → PR）で実装した。#628 = PR #681（merge 済み）、#625 = PR #684（提出・CI 走行中）。回答は ANSWERS.md へ転記し、台帳昇格 = PR #665。実装中に D-sched-3 の前提誤り（tasks_payload は時刻列を持つ）が見つかり、緩和案を D-20260811-sched-1 として新規キューへ積んだ。

#### 変更点

- **#628（PR #681）保存ボタンでのみ確定**: EventEditorPane を draft 化し保存フッターを追加。draft は「触ったフィールドだけ」を live item に重ねる方式 — 未タッチのフィールドはリモート更新に追従し続け、他デバイスの変更が「自分の未保存」に化けない（QA S-4）。系列/当日混在の保存は #279 scope ダイアログへ丸ごと預け「選択で全適用 / キャンセルで全破棄・undo 1 件」（QA S-1）、起点は移動後の日付（QA S-2）。`touchesSeries` が「聞くか」と「書くか」の両方を決めるので終日フリップの補完時刻が routine テンプレートを上書きしない（QA S-3・#469 ガード維持）。日付の unmount flush は退役（blur 保存の裏口）。頻度・完了・削除・スキップは意図的に draft 外（in-flight ガード付き非同期系列変換のため）。未保存クローズ判定は `web/src/schedule/unsavedCloseGuard.ts` に pin
- **#625（PR #684）id 維持の role 変換**: `SupabaseItemConversionService` が「新 payload UPSERT → `items_meta.role` UPDATE → 旧 payload DELETE」の順で変換。**QA と sync-auditor が独立に「旧 DELETE 先行は最悪の順序」と同結論** — payload の item_id FK は単独列で role を含まず（0008 実測）、DELETE 先行の中間状態は §10 R2 が禁じる「payload の無い meta」= 到達不能孤児。INSERT 先行なら失敗残骸は「不可視の余剰 payload 行」に格下げされ補償も 1 手になる。updated_at は reRole 内で都度採取（LWW 単調・監査 Critical）。payload 書き込みは upsert（負けレースの残骸で後の変換が PK 衝突する経路を閉塞・監査 High）。完了状態は Event→Todo で引き継ぐ（`done → DONE` — QA Blocking: ダイアログが約束していない破棄だった）。入口は #551 統一アクションパネル（P-006・EventEditorPane は #681 が全面改訂中のため不触）。配置済み Todo → Event はスロット引き継ぎ・未配置のみ当日終日。routine 由来は指定文言ダイアログ、子持ちは拒否（Trash 内の子も対象と文言明記）、子である Todo は親リンク解除をダイアログに明記
- **記録**: 回答転記 + 台帳 5 件昇格 + キュー削除 + 索引再生成 = PR #665。§10.5 に逆向き孤児検出クエリ追記（PR #684 に同梱）。D-20260811-sched-1（日付引き継ぎ緩和案・放置時 A）を新規キューへ
- 検証: 両 Issue とも 6 ゲート exit 0 を複数回実測（#625 最終 = shared 192 files / 1617 pass・web 24 files / 185 pass）。実ブラウザ検証は merge 後 chat-main（重点は各 PR 本文）

### 2026-08-10 (2) - merge 後始末: #657 docs-lint 修正・conflict 解消・全体レビュー → PR #659

#### 概要

/goal バッチの merge 前後の後始末。tracker PR #657 の docs-lint 失敗（索引 stale）と conflict を解消し、実装 6 PR のマルチエージェント全体レビューを実施した。#648 にのみ確定指摘 2 件（バグ 1・重複 1）が出て修正を push したが merge と入れ違いで main に届かず、origin/main から切り直して PR #659 として再提出した。

#### 変更点

- **#657 docs-lint 失敗**: 判断キュー 5 件を積んだのに `.claude/INDEX.md` / `.claude/decisions/INDEX.md` の再生成を同一コミットに含め忘れた（rules/records.md §4）。`records.mjs index` 再実行で解消
- **#657 conflict**: 他レーンの tracker merge で main 側の索引も進んでいた。派生ファイルなので origin/main を merge → `records.mjs index` で機械解消（§4 の規約どおり中身は読まない）。merge commit は tracker-guard の仕様どおり `[tracker-ok]` で他チャット分の同梱を明示
- **全体レビュー（ultracode workflow）**: 6 PR × 独立レビュー担当 + 指摘ごとの反証チェックの二段構え。#637 / #639 / #645 / #652 / #654 はクリーン、#648 に確定 2 件
- **PR #659（#626 follow-up）**: ① バグ = #355 の防護 effect（他サーフェスが開いたら保留中バブルを破棄）が新設 `taskDetailId` を知らず、タスクチップのダブルクリックで 350ms 遅延バブルが詳細モーダル（z-50）の上（z-[60]）に浮く — 変更前は onOpenTasks() のセクション遷移 unmount が偶然キャンセルしていた。effect の条件 + deps に `taskDetailId` を追加。② 重複 = `STATUS_TEXT_KEY` が KanbanView のローカル定義の逐語コピー — `shared/src/components/taskStatusVisuals.ts`（byte-identical な status マップの既存 dedup 置き場）へ 1 定義化し両面が import
- **取り残しコミットの再発**: memory `push-after-merge-strands-commits` の型どおり、#648 への修正 push が merge スナップショットに入らなかった。`git grep origin/main` で不着を実測 → origin/main から `claude/schedule-626-review-fix` を切り cherry-pick（conflict なし）→ 6 ゲート再実測 exit 0 → PR #659（CI green は head SHA 照合まで実測）
- 検証: 全ゲート緑（shared 187 files / 1561 pass・web 20 files / 167 pass — merge 後 main 基準）

### 2026-08-10 - /goal 一括消化: #633 / #592 / #593 / #626 / #573 / #572 の 6 連続実装（PR 提出・merge 待ち）

#### 概要

/goal 指定の担当 8 Issue を消化した。判断が要る #628 / #625 は P-005 どおり D-20260810-sched-1〜5 として判断キューへ積んで実装に入らず、残る 6 件を Issue ごとに origin/main からブランチを切って連続実装し、PR #637 / #639 / #645 / #648 / #652 / #654 として提出した（記録時点で全て CI 緑・OPEN・merge はユーザー = P-001）。

#### 変更点

- **#633（PR #637）mobile 編集シートの高さ上限**: CalendarTab の BottomSheet に Notes / Tasks 詳細シートと同じ「max-h + 内部スクロール」の殻。単位は vh ではなく **svh**（100vh は URL バー非表示基準なので、バー表示中に vh 上限でも溢れる — #631 の罠）。shared/BottomSheet と EventEditorPane は無改修。Notes / Tasks 側の vh 残存は outbox で起票依頼
- **#592（PR #639）表示文字列の Todo 統一**: ja / en 両 catalog の値のみ 16 キー ×2 を置換（キー名・型名・変数名は不変）。`itemRole.task` は TagPicker / TagEditorHost 経由で schedule 外にも出るため影響範囲を Issue にコメント。`en:172` の `{{task}}` は差し込み変数名（内部識別子）で見送り
- **#593（PR #645）Todo チップの CheckSquare グリフ**: 週 timed / 週終日レーン / 月チップ / アジェンダ行の 4 箇所に、ナビの Todos アイコンと同じ CheckSquare を追加。バンド案は routine と「バンド vs バンド」・枠線案は event と「枠線 vs 枠線」でどちらも色相頼みに戻るため却下（Issue にコメント）。完了状態と独立の静的マーク（フリップさせるとアジェンダの完了トグルと役割衝突）。新トークンなし。テストは「task に svg あり / event に svg なし」を両方向 pin
- **#626（PR #648）Schedule から Todo のタグ編集**: 案 (a) 採用 — Kanban の renderTaskDetail と同じ TaskDetailPanel + TagPicker を Schedule の ItemDetailOverlay で。吹き出しの主ボタンは「詳細を編集」になり「Todo で開く」はパネル下部へ移設。(b) ItemActionPopover 拡張は「slot なし / 外側 mousedown 閉じと TagPicker ドロップダウンの相性（#470 系再発）/ #572 と自家衝突」で却下。narrow は #564 の切り分け維持（mobile task シートは follow-up — outbox で起票依頼）
- **#573（PR #652）子持ち Todo の削除ガード**: 子ありの行だけ window.confirm（サブツリー件数入り）。事後トーストではなく**事前確認**を選択 — undo は section unmount で消え Trash は 1 行ずつなので、事後では防げない。leaf は 1 クリックのまま。判定は純関数 `web/src/schedule/todoTrayDeleteGuard.ts`（collectDescendantIds ベース）+ web/tests 4 本。同じ write を撃つ #564 吹き出しの削除も同ハンドラでガード（P-006 で PR に明記）
- **#572（PR #654）stub 分岐の退役 + TagColorControls 空状態**: `ItemAction.stub` / `stubBadge` を P-002（grep 全数実測: `stub: true` 0 件・host からの `stubBadge` 受け渡し 0 件・テスト 0）で types / Row / Popover / DetailOverlay から撤去し、Row に退役注記 1 行。TagColorControls はタグ 0 件時に null ではなく「色はタグに付きます。先にタグを追加してください」（`itemActions.tagColorEmpty`・en/ja）を表示
- **判断キュー**: D-20260810-sched-1（#628 保存ボタンの確定モデル）/ sched-2〜5（#625 の id 維持・Event→Todo の落ちるフィールド・Todo→Event のステータスと親子・routine 由来の可否）を `comm/decisions/chat-schedule-refine.md` へ
- **branch 運用**: 全ブランチを origin/main から独立に切り、`.session-branch` を都度更新。#637 / #648 / #652 は同じ `CalendarTab.tsx` を触るが編集領域を離してあり任意順で auto-merge 想定（outbox に記載・conflict 時は差し戻し依頼）
- 検証: 各 PR とも shared / web の lint・test・build 全 6 ゲート exit 0 を PR 前に実測し、CI（typecheck + test + build / docs-lint）の green も `gh pr checks --watch` で実測。実ブラウザ確認は merge 後 chat-main（重点は各 PR 本文に記載）

### 2026-08-02 (2) - /loop 自律運転で #568 / #563 / #565 / #569 を連続実装（全 merge）

#### 概要

/loop の自律モードで、section:schedule キューの 4 件を role-engineer 実装 → role-qa 独立監査（全件 Blocking 0）→ QA Should 反映 → 7 ゲート緑 → PR の同一チェーンで連続処理した。PR #576 / #577 / #579 / #581 として提出し、いずれも同日中に merge された。QA の変異実測が 2 回「テストが実装の壊れを検知できない」穴を見つけ、どちらも PR 前に塞いだ。

#### 変更点

- **#568（PR #576・sev:important）Undo/Redo が今日以外の予定に効かない**: today 固定 provider に `ScheduleItemsViewMirror` を registerViewMirror で 1 個登録（実体 = `web/src/schedule/useVisibleRangeItems.ts` の identity 安定 mirror・upsert は fetchedRange 窓外を拒否）。update / toggleComplete / dismiss / delete の prev 解決を items → mirror の 2 段にし、undo/redo の書き戻しも mirror 経由で rangeItems へ即時反映（Realtime 待ち解消)。書き込み順「provider 先」を契約としてコメント化（QA S3: 本番 mirror は effect 更新 ref なので順序は偶然不問 — 同期 mirror で必須になる不変式として明記）。テスト = shared +5 / 新規 web/tests/visibleRangeMirror.test.ts 10 本
- **#563（PR #577）週ビュー列線ずれ**: ヘッダー・終日レーン・時間グリッドを同一スクロール箱（ヘッダー + レーン sticky）に入れて同じ列割りを共有。scrollbar-gutter 案は不採用（オーバーレイスクロールバーで余白が死ぬ）。追従 = 終日 drop 境界をレーン自身の bottom に・place の Y→分変換を時間グリッド rect 基準に。**QA の変異実測で追従 2 点が無テストと判明**（jsdom rect 全 0 で境界を区別できず、旧参照に戻しても全 pass）→ rect スタブ `stubGridGeometry` の座標テスト 2 本で pin（変異で新テストだけが落ちることを確認）
- **#565（PR #579）Todo タグ別 3 列化**: タグ別だけ `repeat(3, minmax(220px,1fr))` の grid + 下限割れは横スクロール。220px = タグ列ヘッダー ColorPicker の swatch 必要幅（QA が 1280px + ナビ + 右サイドバーの通常フローで クリップ到達を算術実測 → 下限を追加）。`KanbanColumn` に `fluidWidth` モード・レイアウト決定権はボード側に一本化。ステータス別はクラス集合レベルで不変
- **#569（PR #581）タスクチップ操作の Undo**: `updateNode(id, updates, { undoLabel })` の opt-in 方式（全 updateNode を push にするとタイトル打鍵でスタックが埋まる）。no-op 書き込みは push しない。5 経路（place / move / resize / #562 の終日 drop / トレイ今日に追加）に札付け・パネル経由 place は note 添付時のみ undo 除外。**QA 実測で CalendarTab の配線がどのゲートからも不可視と判明** → 決定ロジックを純関数 `taskChipUndoWiring.ts` に切り出し web/tests 11 本で pin。i18n `undoRedo.labels` 5 キー（en / ja）
- **既存欠陥 2 件を QA が実測で発見（コード未変更・起票依頼を outbox へ）**: ① series 編集の undo がアンカー 1 日だけ戻る（#568 で到達範囲が全日に拡大）② TaskTree undo の全ツリースナップショットが後続の silent 書き込みを巻き戻す（`setTaskStatus` でも再現 = pre-existing。タイトル入力中の Ctrl+Z で踏める）
- 検証: 各 PR とも 7 ゲート緑 + role-qa 独立監査 Blocking 0。実ブラウザ確認は chat-main 側（各 PR 本文にチェックリストを記載 — 特に #577 の「スクロール状態での place drag 時刻一致」と #581 の undo 5 操作）

### 2026-08-02 - #555 / #551 / #553 / #562 の 4 連続実装ラウンド（merge 後のまとめ記録）

#### 概要

同一 worktree からブランチを切り替えつつ 4 Issue を連続実装し、PR #561 / #566 / #567 / #570 として提出、全て merge された。tracker / outbox は D-20260801-main-1 / D-20260802-sched-1（B 既定）に従い実装 PR に載せず、本 commit でまとめて記録している（各 PR の詳細な要約は PR 本文と outbox 2026-08-02 エントリ群が正）。

#### 変更点

- **#555（PR #561）Todo トレイの削除 + タグ操作**: TodayTodoTray に optional の削除ボタン（TaskTree `softDelete` → Trash 復元可）と renderRowExtra スロットを追加し、CalendarTab が既存 TagPicker を注入。Briefing ホストは props 未指定のため描画不変。follow-up 候補（子持ちタスクの無確認 cascade 削除ガード）は outbox で起票依頼済み
- **#551（PR #566）アイテム操作パネル統一**: 左/右クリックとも ItemActionPopover に統一（rename インライン入力を旧メニューから移植・右クリックは遅延なし）。`ScheduleItemContextMenu` と汎用 `ItemContextMenu` を本体・export・テストごと撤去（net −244 行）。詳細編集の tagSlot に `TagColorControls`（付与タグごとの ColorPicker → `setTagColor`）を追加。follow-up 候補（`ItemActionRow` の stub 分岐デッドコード / TagColorControls 空状態）は outbox で起票依頼済み
- **#553（PR #567）TimeRangeField**: 新規 `shared/src/components/TimeRangeField.tsx`（手入力 + 15 分刻みリスト + 終了側の所要時間注記 + ↑↓ ステップ・start<end 不変式を部品が所有・全経路 jsdom テスト可能）で EventEditorPane / ItemCreatePanel の time 入力を置換。EventEditorPane は `onChangeTimes` へ props 変更（1 操作 = 1 書き込み — routine のスコープダイアログが 2 回出ない）。role-qa の Blocking 1 件（開始 23:59 手入力で start=end）は拒否ガード + 回帰テストで修正
- **#562（PR #570）終日チップの drop 復元 + クランプ**: 時間グリッド上へのドラッグで終日レーンの y 座標が時刻へ丸められ 01:30 / 00:00 が捏造書き込みされていたのを、新設 `onDropAllDay` prop で「終日レーンへの drop = 終日のまま commit」に修正。move ドラッグは可視時間窓でクランプ（負値 / >24:00 が `minutesToTime` で 00:00/00:00 の反転 span に潰れる経路を遮断）。既存の壊れた行は `tasksToCalendarChips` が退化 span（end<=start）を終日候補チップとして救済表示（正当な overnight span は timed のまま）
- **merge 順の依頼が実際に効いた**: #551 と #553 はどちらも `CalendarTab.tsx` を触るため、outbox で #561 → #566 → #567 の順を依頼し、その順で merge された
- **#520（PR #533）/ #524（PR #536）の merge・Issue close も確認**（`gh pr view` / `gh issue view` の state 実測）。D-20260801-sched-1（A 回答）の消化はこれで完了
- 検証: 各 PR とも 7 ゲート全緑（CI SUCCESS を merge 時に確認）。実ブラウザ確認は §7.4 どおり chat-main 側（重点は各 PR 本文の Tests 節）

### 2026-08-01 (2) - #520 移動時にグリッドのフィルタを外す / #524 グラフのコールバックを発火時に読む

#### 概要

独立した 2 件を別ブランチで実装し PR #533（#520）/ PR #536（#524）を提出した。tracker は D-20260801-main-1 に従い実装 PR に載せず、この docs PR に分けている。

#### 変更点

- **#520（PR #533・`web/src/schedule/CalendarTab.tsx`）**: パレットから予定を開くとき、日付と選択は書けているのにフィルタが行を落として「日付だけ飛んで何も無い」状態になっていた。Issue の 🛑 ゲートで確定した **A（移動時にレンズを外す）** を実装
- **レンズだけでなく #466 の繰り返しフィルタも外した**（Issue 本文からの拡張）。パレットの候補は `fetchEvents()` = live な schedule_items 全部で**繰り返し由来のオカレンスを含む**（`SupabaseScheduleItemsService.ts:166`）ため、レンズだけ直すと繰り返し予定で #520 がそのまま再現する。到着時点では**どちらが隠すか判定できない**（渡ってくるのは id + date だけで、行の取得はアンカー移動が引き金）ので両方を無条件で外す
- **合流点は 2 本に保つ**: `revealOnGrid()` =「移動して見せる」、`finishCreatePanel()` =「作って見せる」（#506 で作った既存の合流点・レンズのみ）。作成直後の行は繰り返し由来ではないので `repeatsHidden` は容疑者にならない。繰り返し一覧の「次回発生日へジャンプ」も `revealOnGrid()` へ合流（飛び先は定義上オカレンスなので #466 が ON なら**必ず**空の日に着地していた）
- **`react-hooks/set-state-in-effect` は effect 内の最初の 1 件しか報告しない**（実測）。`revealOnGrid()` を呼び足したら報告位置がそこへ移り、`setSelectedId` 側の既存 disable が「未使用ディレクティブ」warning に化けた。ディレクティブは**最初に来る行**に置く
- **#524（PR #536・`shared/src/components/Connect/graph/useGraphInteraction.ts`）**: リスナー登録 effect の deps が `size` だけなので、`GraphCanvas` が inline で作る `onSelect`（`selectedId` を閉じ込めてトグル判定する）が attach 時点で凍結し、`id === selectedId` が常に false だった。`onHover` / `onSelect` / `onActivate` / `onZoom` を latest-ref に載せ、**dep 無し effect** で更新（render 中の ref 書き込みは `react-hooks/refs` が error）。deps を増やす方向は不採用（ドラッグ中に window の pointer リスナーごと貼り直すため）
- **#523 が壊したのではなく確定させた**: 旧 deps の `simRef.current` がグラフ再構築のたびに貼り直してクロージャを偶然更新していた（「たまに効く」）
- **新規 `shared/tests/graphInteractionCallbacks.test.tsx` 2 件**: Issue は「canvas 経路は jsdom で検証不能」としていたが、不可能なのは**当たり判定の座標計算**の方で、`getBoundingClientRect()` が全部 0 なのは**使える座標系**（ノードを原点に置けば原点クリックが当たる）。このフックは 2D コンテキストを触らないので配線だけを pin できる。修正前のフックで両方 fail することを `git stash` で実測
- **🔎 別バグを検出（未修正・起票依頼を outbox へ）**: **ノードのダブルクリックは `onActivate` を一度も呼んでいない**。`d3-zoom` の `dblclick.zoom` が `noevent()` = `stopImmediatePropagation()` を撃ち、同じ要素に**後から**登録した `onCanvasDblClick` が届かない。jsdom で呼び出し 0 回を実測。#523 / #524 の退行ではなく最初からで、開く導線自体は `SelectedNodeCard` / `NodeDetailSheet` のボタンが生きている。直すなら `sel.on("dblclick.zoom", null)` の 1 行だが d3 既定の拡大を捨てる判断が要るので D-20260801-sched-2 へ
- **検証**: 両ブランチとも 7 ゲート全緑（#524 側は shared test **170 files 1417 pass**）。実ブラウザ確認は §7.4 どおり chat-main に残る

### 2026-08-01 - #467 Step 5-c Mobile を List+FAB に絞る + 繰り返し一覧の Mobile 導線

#### 概要

Epic #290 Step 5-c と Epic #321 Phase 2（mobile-scope.md #5）を 1 本で実装した。どちらも `CalendarTab` の同じ領域（mobile 分岐と sidebar portal）を書き換えるため分離できない。narrow は「アンカー日のリスト + FAB」の単画面になり、#408 以来到達不能だった繰り返し一覧が narrow のドロワーから閲覧できるようになった。

#### 変更点

- **撤去の理由は「画面が小さいから」ではない**: mobile の SegmentedControl（リスト / 時間 / 月）を撤去。時間グリッドと月グリッドはどちらも **Desktop の面をそのまま縮めた面**で、前者は 1 日分をスクロールの奥に押し込んで全ブロックを指で狙えないドラッグ対象にし、後者は「中身」ではなく「件数」を出すセルを並べる。narrow が答えたい「次は何か」にはリストが直接答える。**失うのは遠い日へのジャンプ**（前後 1 日ステップのみ）で、それが要る実ケース＝「次回発生が数週間先の繰り返し」は下の繰り返しタブが埋める
- **`effView` の固定は render 分岐ではなく `useCalendarNav` 側**（`effView = isWide ? desktopView : "list"`）。`view` state はレイアウトを跨いで残るので、"month" のままウィンドウを狭めると **`step` が月送りのまま・フェッチ窓も月グリッド全体**になる。描画・ナビ・フェッチ窓が同じ 1 つの事実を見る形にした。`visibleCalendarRange` が narrow で週に広がらないことをテストで固定
- **`normalizeMobileView` / `MobileCalendarView` は shared ごと退役**。ただし**退役 id（"time" / "list"）は `normalizeDesktopView` が吸収し続ける** — `view` は長命な state で、切替が消えた時点で "time" を持っていたセッションが有りうる。ここもテストにした。i18n は `viewList` / `viewTime` を削除
- **繰り返し一覧の Mobile 導線** = rightSidebar のドロワーを narrow でも 2 タブ（今日の流れ / 繰り返し）にした。「本日の Todo」は入れない（Todo ボードは Schedule セクション側の SegmentedControl が担当済みで、2 本目の入口は重複）。resize で `"todo"` が残っても**描画時に flow へ畳む**（state は保持 = 広げたら元のタブに戻る）
- **閲覧のみは `readOnly` フラグではなく `onDelete` を渡さないことで表現**。フラグを足すと「削除を出すか」の真実が 2 つになり、いずれコールバックと食い違う。disabled にもしない（押せるのに断るコントロールは壊れて見える — #434 S-1 と同じ原則）
- **移動は編集ではない**ので行タップの「次回発生日へジャンプ」は mobile でも残す。ただし narrow ではドロワーがカレンダーに被るので**ジャンプ時に閉じる**。`useRightSidebarOptional`（null 安全）を使用 — セクション本体は Provider 無しで描かれても壊れてはいけない（`RightSidebarPortal` と同じ理由）
- **Desktop は無変更**: 3 タブのまま・`onDelete` は wide で従来どおり・drawer close は `!isWide` ガードの内側（Desktop のパネルはグリッドの横に並ぶので、閉じるとユーザーが自分で開いたものを畳むことになる）
- **docs 追随**: `mobile-scope.md` #4 / #5 / §5 Phase 2、`2026-07-14-schedule-redesign.md` の Step 5-c ✅ + **Step 6 も ✅**（#468 / PR #506 が 7/31 merge 済みなのに ⬜ のままだった）+ Status 行 + Worklog
- **検証**: 7 ゲート全緑（shared lint 0 errors / build / test 166 files 1386 pass、web lint warning 0 / build / test 9 files 79 pass、docs-lint OK）。DDL ゼロ。`CalendarTab` 自体のレンダーテストは無し（shared から 40 以上の部品を取るためモックハーネスの新設が要る）。実ブラウザ / 実機確認は §7.4 どおり chat-main に残る

### 2026-08-01 - #508 BottomSheet にフォーカストラップと初期フォーカス（shared-fix `[all]`）

#### 概要

`aria-modal="true"` を名乗りながらトラップも初期フォーカスも無かった `BottomSheet` に、Modal が既に持っていた機構を共有フック `useDialogA11y` として切り出して配線した。ついでにダイアログのレイヤ順序が listener 登録順（＝スタック順の逆）で決まっていた欠陥を、module レベルのレイヤスタックに置き換えた。

#### 変更点

- **新規 `shared/src/hooks/useDialogA11y.ts`**: Esc（IME ガード付き）/ Tab 循環 / 初期フォーカス / 呼び出し元へのフォーカス復帰 / 任意の body scroll ロック。パネル側 ref を返す
- **レイヤはスタックで決める**: 全ダイアログが document で待つため、**最初に登録した＝一番古い外側**が先に走って stopPropagation していた（シートの上に開いた Modal の Esc がシートに渡る）。`layers` 配列の末尾＝最前面だけが Esc と Tab に反応する
- **`BottomSheet.tsx`**: 自前の Esc effect を撤去してフックへ。パネルに `ref` + `tabIndex={-1}`（中に focusable が無いシートは自分自身がフォーカスを受ける）。**body scroll はロックしない**（背後のリストをスクロールしたまま使う導線のため。Modal だけ `lockScroll: true`）
- **`Modal.tsx`**: 2 つの effect（Esc + trap / scroll lock + focus）をフック呼び出し 1 行に置換。パネルに `tabIndex={-1}` 追加。capture 段の stopPropagation は「最前面だけ」条件付きで維持
- **初期フォーカスは子が取っていたら触らない**: `panel.contains(document.activeElement)` で降りる。`QuickAddSheet` が effect で input を focus しており、上書きが Issue の言う「二重フォーカス」の正体
- **可視判定の layout 分岐**: `offsetParent !== null` は jsdom で全要素 null になり trap が丸ごと空振りする（#475 の「テストから見えない経路」）。`document.body.getClientRects()` で layout の有無を見て、ある時だけ適用。`disabled` / `aria-hidden` は両環境で除外
- **新規 `shared/tests/dialogFocus.test.tsx` 8 件**: 初期フォーカス / focusable ゼロ時のパネル fallback / 子のフォーカス尊重 / Tab・Shift+Tab 循環 / 外に逃げたフォーカスの引き戻し / 復帰 / IME 中の Esc 無視 / **Modal をシートの上に重ねた時に Esc が最前面だけに届く**
- 検証: 7 ゲート全緑（shared lint 0 errors / build / **167 files 1371 pass**、web lint / build / **8 files 75 pass**、`LC_ALL=C docs-lint` OK）

- 2026-08-01: [途中] chat-main レビュー 3 本の対応 — #506 は 4 経路中 1 経路にしか無かったレンズ解除を `finishCreatePanel()` に合流（`4e21f83b`）／ #514 は `propagate` 失敗が無言だった件をこの PR で拾い `propagate-failed` + `series-partial` を追加（`01f31113`）／ #515 は Issue #505 に残り 1 ファイル（`useGraphInteraction`）を記録。7 ゲート全緑・push 済み。**#467 は #506 の merge 待ちで着手不可のまま**

### 2026-07-31 - #505 `react-hooks/refs` のベースライン免除を 10 → 1 に減らす

#### 概要

`shared/eslint.config.js` が 10 ファイルだけ `react-hooks/refs` を off にしていたのを 9 ファイル分解消した。免除は**パス完全一致**なので、対象を分割・改名した瞬間に失効して CI だけが落ちる（PR #488 で実際に踏んだ形）。

#### 変更点

- **違反は 3 つの形しかなかった**。免除リストの長さに対して中身は単純だった
  - **(1) 値 / callback を render 中に ref へ写す**（7 箇所: 4 つの `*UnifiedContext` / `TaskTreeContext` の `undoRedoRef`、`TimerContext` の `onSessionCompleteRef`、`ShortcutEditModal` の `capturingRef`、`UndoRedoContext` の `appliedRef`、`useScheduleItemsAPI` の `dateRef`）→ **dep 無し `useEffect`** へ移した。**読み手はすべて commit 後**（unmount cleanup / tick effect / Esc ハンドラ / 解決済み promise / undo-redo クロージャ）なので、見える値は変わらない。`useScheduleItemsAPI` は**同じファイルの `itemsRef` が既に effect 版**で不統一だったのが揃った
  - **(2) lazy ref 初期化**（`UndoRedoContext` の `managerRef`）→ `useState(() => new UndoRedoManager())`。「1 回だけ生成して以後不変」を React から見える形で書いたもので、ref 版と違い render 中の読み書きが無い
  - **(3) render 中スナップショットが意図的**（`useFrozenNoteSortKey`）→ **state を render 中に調整する React 公式の逃げ道**へ。effect に移すと「保持されていない 1 レンダー」が通り、それが**まさにノートが飛ぶフレーム**（#366）。set はガード付き（選択が変わったか、探していたノートが届いたときだけ）で、**ガードを外すと「まだ見つからない」を毎レンダー書き直して収束しない**。専用テスト 4 件はそのまま通過
- **残り 1 件は形が違うので別 PR にした**: `useGraphInteraction.ts` は `simRef.current` を**依存配列の中で読んでいる**。render 時点の ref は前回 commit の値なので、「シミュレーションが差し替わったらリスナーを貼り直す」という意図をそもそも果たしていない（差し替えの**次の**レンダーでしか効かず、そのレンダーが来る保証も無い）。正しい直し方はリスナーが event 時に `simRef.current` を読む形で、そうすると依存自体が不要になる — ただし Connect グラフのキャンバスにテストが無く、lint 掃除に混ぜる変更ではない。config のコメントに理由を残した
- **ゲート**: 7 本すべて exit 0 — shared lint（**0 errors**）/ build / test（**166 files / 1363 pass**）・web lint / build / test（**8 files / 75 pass**）・`LC_ALL=C bash scripts/docs-lint.sh`

### 2026-07-31 - #504 routine template の更新失敗が無言（scope 編集の await 漏れ / 未ロード時の void）

#### 概要

繰り返しの雛形（template）の更新が落ちても何も言わない 2 箇所を塞いだ。#434 / #469 で潰した「失敗が黙って消える」の残り。**rollback ではなく書き込み順序で解いた**。

#### 変更点

- **食い違いを直すのではなく、作らせない**: 旧実装は occurrence を書いてから template を await せずに撃つ順序だった。この順序で template が落ちると、**画面は完全に正しい**（未来行はすべて新しい値）のに template だけ古い状態になる。ユーザーは数日後に「新しく生成された日が勝手に元へ戻る」形でしか気付けず、**リロードでも検知できない**（行は本当に正しい）。**template を先に書いて落ちたら中断**に変えると、失敗時点で occurrence に一切触れていないので「何も保存されていません」というトーストが嘘にならず、巻き戻す対象も発生しない
- **順序と中断規則を `shared/src/utils/seriesEditSequence.ts`（`runSeriesEdit`）に切り出した**。prepare → template → propagate の 3 段で各ステップは注入。**修正の本体は順序そのもの**なので、call site のコメントに留めず vitest で固定した（5 件 — 順序 / template 失敗で propagate を呼ばない / prepare 失敗で template すら呼ばない / prepare 省略時 / throw は握り潰さない）
- **`fillUpToAnchor` は引き続き最初**。ここで実体化される「アンカーより前の日」は**ユーザーが選ばなかった日**で、pre-edit の値を保つ必要がある。部分失敗で中断するのも従来どおり（実体化済みでない日は書き換えで消える）
- **routine 未ロード時の頻度変更の `void updateRoutine(...)`** を await + `landed` 判定に。文言は既存の `"update"` を流用（この経路もユーザーから見れば「間隔の変更が落ちた」）
- **`onRepeatConvertFailed` の文言分岐をネスト三項からテーブル（`REPEAT_FAILURE_COPY_KEY`）へ**。reason は増える一方で、チェーンだと**新しい reason が黙って最後の `else` に落ちる** — 「何も保存されていない」が「変更できました」に化ける事故がまさにその形。新 reason `"series"` + `scheduleScreen.repeatSeriesUpdateFailed`（en / ja）
- **ゲート**: 7 本すべて exit 0 — shared lint / build / test（**167 files / 1368 pass**）・web lint / build / test（**8 files / 75 pass**）・`LC_ALL=C bash scripts/docs-lint.sh`

### 2026-07-31 - #503 コマンドパレットにアイテム横断検索を追加（shared-fix `[all]`）

#### 概要

ヘッダーが「検索・コマンド実行」と名乗っているのに、パレットは移動コマンドしか引けなかった（既存ノート「テスト２」があるのに「テスト」で 0 件）。ノート / タスク / 予定 / デイリーのタイトル検索を足し、選択でそのアイテムが開くところまで配線した。#468 の PR が merge 待ちで #467 に着手できない空き時間に拾った。

#### 変更点

- **土台は `[[` 補完の候補プールにあった**: `useItemLinkTargets` の遅延 + stale + in-flight のキャッシュ（#430）がそのまま要る契約だったので、`shared/src/hooks/useLazyStalePool.ts` に切り出して両方から使う。切り出した規則は 5 つとも過去のバグの修正そのもの（遅延 / `allowStale` で指の下を動かさない / 同時 1 フェッチ / **settled 形をキャッシュ**（生 promise だと相乗りした呼び手が reject を継承する）/ **飛行中に来たバンプは success で消さない**（消すと次のバンプまで書き込みが見えない））
- **マッチングは `shared/src/utils/itemSearch.ts` の純関数**（`searchItemPool`）。前方一致 → 部分一致の 2 段だけで、あいまい検索は**入れない**: 1 ロール 5 行の枠を「なぜ出たか分からない行」に使うと、出るべき行が黙って消える。**空クエリは 0 件**（パレットは空欄で開くので、そこにプール全部を出すと移動コマンドが一番使う瞬間に埋まる）。**上限はロール単位**（全体上限だとノート 200 件がタスク 1 件を押し出す）
- **パレットは受け取った行を再フィルタしない**（`externalResults`）。プールは非同期で取ってホストが照合済みなので、パレット側の部分一致が**ホストと食い違う**しかない。ただし**クエリが空なら表示しない** — 再オープン直後の 1 レンダーで前セッションのヒットがちらつくのを、effect を増やさず render 側で塞げる
- **予定だけ「日付」を intent に載せる**（`navigateToItem({ id, role, date })`）。カレンダーは可視範囲しか取らず**ナビゲーションが範囲外を生成しない**（この worktree の最重要実測）ので、id だけ渡すと「たまたま開いていた週」を選択して何も起きない。日付は検索行が既に持っているので、カレンダー側に引き直させない
- **`react-hooks/set-state-in-effect` は web で error**。props で届く intent を受ける先は effect しか無く、先例（`useTaskDetailTarget.ts:112`）と同じく理由付き 1 行 disable。**`setAnchorDate` / `setMobileSelectedDay` は検知されない**（フック由来のメンバー的呼び出し）ので、必要なのは local な `setSelectedId` の 1 行だけだった
- **`onQueryChange` はパレットの open-reset でも撃つ**。撃たないと前セッションのヒットが空欄の下に残る
- **overlay に `role="dialog"` / `aria-modal="true"`**。名前は placeholder を流用（「検索、またはコマンドを入力...」= ダイアログそのものの説明なので 2 本目の文字列を作らない）。placeholder 自体も「コマンドを入力...」から検索を含む文言へ en / ja 両方更新した
- **ゲート**: 7 本すべて exit 0 — shared lint / build / test（**167 files / 1378 pass**）・web lint / build / test（**9 files / 81 pass**）・`LC_ALL=C bash scripts/docs-lint.sh`

### 2026-07-31 - #468 Step 6 カレンダー台帳をグリッドのタグフィルタとして配線

#### 概要

`calendars` 台帳を Calendar グリッドの絞り込みレンズとして配線した。実装に入って最初に判明したのが「**予定にタグを付ける導線がアプリ内に存在しない**」ことで、フィルタだけ入れるとレンズを選んだ瞬間に予定が全部消えてタスクチップだけが残る。そのため編集パネルへのタグ導線を同じ PR に同梱した。

#### 変更点

- **カレンダー = life-tag 1 本への保存済みビュー**: 所属判定は「その `wiki_tag` を持っているか」。`buildCalendarMemberIds` が (assignments, tagId) から membership Set を 1 回作り、行の判定は Set 参照 1 回に落ちる
- **繰り返しは系列でタグ付けする**: オカレンス行は materialise のたびに作り直されるので、行に付けたタグは消える。`applyCalendarLens` は「自分の id **または** `routineId`」でマッチさせ、`tagSlot` も `selected.routineId ?? item.id` を対象にする（role も書き込む id 側に合わせて `routine` / `event` を出し分け）
- **予定へのタグ導線を同梱**（判断キュー D-20260731-sched-2 / 採用 A）: `EventEditorPane` に `tagSlot` prop を 1 本足して `CalendarTab` から既存 `TagPicker` を注入。Schedule のコンテキストメニューの「タグを追加」は stub のままだった
- **タスクチップにもレンズを効かせる**（D-20260731-sched-3 / 採用 A）: タスクは Kanban で同じ life-tag を持てるのでチップだけ残す説明は成立しない。`applyCalendarLens` が events と taskChips を一緒に narrowing し、合算した `hiddenCount` を返すので「N 件を非表示」が画面と食い違わない
- **2 つのフィルタは独立 AND・件数は各自の分だけ**: 繰り返し → カレンダーの直列適用。順序が効くのは件数だけで、チェーンして数えると繰り返しが既に畳んだ行を二重計上し、実際の欠落より大きい数字になる。**数字が過大なのは数字が無いより悪い**
- **永続化しない**: 起動時に前回のレンズが残ると骨組みの大半が欠けたカレンダーが「その日の全体」として出て、空いて見えるスロットへ二重予約する（#466 と同じ理由）
- **宙ぶらりんの台帳をレンズに出さない**: `calendars.tag_id` の `ON DELETE CASCADE` は tag が **soft-delete** では発火せず、台帳は永遠に 0 件マッチの状態で残る。ただし「まだ読み込み中」「取得失敗」も lookup ミスとしては同型で、`useCalendarsAPI` は小さい fetch 1 発・`useWikiTagsUnifiedAPI` は tags + 全ページの assignments + connections を待つので**台帳がほぼ必ず先着する**。`tagsLoading` で判定をゲートしないと、到着直前のデータに対して「削除済み」と宣告して物理削除だけを提示する画面になる
- **レンズを解除する導線が消える窓を塞いだ**: チップ行は Desktop 分岐にしか描かれないので、`isWide` を **membership set の生成側**でゲートして全レイヤーが同時に解除されるようにした。新規作成時（新しい行はタグを持たないので生まれた瞬間に消える）と、選択行がレンズ外に出たときはレンズ / 選択を落とす
- **`CalendarView`（台帳モーダル）の i18n 化**: 英語直書き + 途中に日本語が 1 段落混ざった状態だったのを `scheduleScreen.*` で en / ja 両 catalog に寄せた。フィルタの管理画面になった以上、dev スクラッチ画面のままにはできない
- **ゲート**: CI の 7 本すべて exit 0 — shared lint / build / test（**166 files / 1385 pass**）・web lint / build / test（**9 files / 79 pass**）・`LC_ALL=C bash scripts/docs-lint.sh`

### 2026-07-30 - #469 の role-qa 監査対応（merge 後の hardening follow-up）

#### 概要

Stop hook のレビューゲートで role-qa を回した結果、Blocking 2 件・Should-fix 3 件。**Blocking はどちらも #484（PR merge 済み）で自分が入れた退行**だったので、追い PR で直した。監査を回している最中に #484 が merge されたため「merge 前の差し戻し」にはできなかった。

#### 変更点

- **B-1 日付を commit-on-blur に戻した**: `<input type="date">` は「完全な値しか emit しない」が正しくても、**セグメントを 1 段動かすたびに emit する**。↑ を 5 回押せば DB 書き込み 5 回 + undo エントリ 5 個、年をキーボードで打てば 2 年 → 20 年 → 202 年を経由して書き込む。commit-on-change を選んだ理由（Esc で閉じると blur が飛ばず draft が失われる）は残るので、**unmount flush**（ref に最新の commit を持たせ、空 dep の cleanup で 1 回だけ実行）で埋めた
- **B-2 日付変更時の anchor 追従を撤回した**: 追従は「行が今の週から消えるのを避ける」ためだったが、**anchor が変わると `[rangeStart, rangeEnd]` が変わり、再フェッチが `rangeItems` を配列ごと置換して着地前の楽観 patch を捨てる**。書き込みは fire-and-forget で数往復・読みは SELECT 1 発なので読みが先着し、行がどの範囲にも無い瞬間に `selected` が null → `editorItem` null → **詳細パネルが自分で閉じる**（Desktop の日表示 / Mobile では ±1 日の変更でも毎回）。追従をやめると patch 済みの行が `rangeItems` に残るのでパネルは開いたまま、行の移動は次の settled fetch が反映する。**「消えないように追従する」が消える原因そのものだった**
- **S-1 終日 OFF 後に時刻入力が空のまま残る**: draft は props からの初期値のみで再同期が無く、key も `item.id` だけだったので、時刻を持たない終日行を OFF にすると DB / グリッドは 09:00-10:00・パネルは空欄という食い違いが出ていた → `EventEditorFields` の key に `isAllDay` を含めて再マウントさせる
- **S-2 フォールバック span を shared の純関数へ**: 新設 `shared/src/utils/scheduleAllDay.ts` の `timedSpanForAllDayOff`。web にテストランナーが無いため無検証だった 3 ケースを vitest で pin — **`minutesToTime` の clamp で `"24:00"` を作る**（start 23:30 + end 空 → 23:59 に丸める）/ start だけある行で end が逆転しない / text 列に入り得る不正文字列は「時刻なし」として扱う（`minutesFromMidnight` は不正入力を 0 と読むため、放置すると start=壊れた値・end=01:00 のペアを書く）
- **N-3 / N-4**: `rangeItems.find(...) ?? selected` の二重探索を `selected` 直参照に（`editorItem` は `selected` 由来なので探索が食い違うと別行の時刻を読む方向に間抜ける）。系列ヒントの文言に memo を追加（memo も occurrence 単位）
- **docs 追随（QA の S-3）**: 計画書 Status 行 + Step 5 / Step 7 の記号、Worklog に 2026-07-30 の 3 行、Epic #290 の Step 7 行。**Step 2 / 3 の `⬜` は担当外なので outbox で chat-main へ申し送り**
- **判断キュー**: 「日付変更でカレンダーを移動先へ飛ばすか」を D-20260730-sched-1 として記録（A = 飛ばさない（採用）/ B = 書き込みの着地を待って飛ばす。B は `useScheduleItemsAPI` の書き込みを await 可能にする改修が前提）
- **ゲート**: shared vitest **158 files / 1305 pass**・shared build・web build・web lint すべて exit 0

### 2026-07-30 - #469 Step 7 編集パネルの日付ピッカー・終日トグル + 小粒回収

#### 概要

`EventEditorPane` に日付ピッカーと終日トグルを足し、計画書 §4-E の小粒 2 件を実測してから処理した（1 件は既に解消済みで回収不要、1 件は実装）。加えて前レーンで未起票のまま残していた「系列の頻度変更が失敗しても無言」を拾った。

#### 変更点

- **日付ピッカーは commit-on-change**（他フィールドの commit-on-blur とあえて違える）: overlay は Esc で閉じられ blur が飛ばないので、draft 方式だと選んだ日付が黙って捨てられる。半端な値が撃ち抜く先も無い（date は系列へ伝播しないので #279 の「半分打った時刻が系列に乗る」害が構造的に起きない）。空文字は commit しない
- **終日トグルは `role="switch"`**（先例 = `AudioMixer` / `Connect/primitives/Toggle`）。ON では時刻を**消さずに保持**（戻したときに元の時刻が復活する）。**OFF に戻すときは host が時刻を補う** — 終日で作られた行は start/end を持たない可能性があり、null のままでは時間グリッドに描けない。既定は create 経路と同じ 09:00 で、end は start から 60 分後を計算（start だけある行で逆転しない）
- **時刻入力は終日 ON で「隠す」**（disabled にしない）: #434 で踏んだ「ロックすると focusable が消える」問題を、隠す側のトグルがフォーカスを保持することで回避。ロックした入力を残すと「無視される値が正しそうに見える」欠点もある
- **`isAllDay` を伝播対象から外した**（`useScheduleMutations.ts` の `propagatable`）: routine template に `isAllDay` は無いので伝播先が存在しない。OFF 時に時刻を同梱するため、この 1 行が無いと時刻編集と誤認されて #279 の scope ダイアログが開く（適用範囲の無い変更に範囲を訊く）
- **小粒 (1) 計画書の「Known Issue 009 = Mobile 月セルに dismissed が残存」は解消済み・回収不要**（実測）: `useVisibleRangeItems.ts:52` が fetch 時に `!isDeleted && !isDismissed` で落とし、`handleDismiss` が楽観的に行を除く。月セルは `monthItems ← rangeItems` なので入り込む経路が無い。**なお `docs/known-issues/INDEX.md` の 009 は別内容**（Mobile Provider バイパス）で、計画書側の番号が古い
- **小粒 (2) 系列編集ヒントを実装**: routine occurrence に「タイトルと時刻は範囲を選ぶ / 日付と終日はこの日だけ」の 1 行。編集して scope ダイアログが出るまで挙動が分からない状態を解消
- **追加回収: 系列の頻度変更が失敗しても無言だった**（前レーンで PR #450 本文に観察として書き、未起票だったもの）。`updateRoutine` の `!landed` で reconcile を飛ばした後、finally の reload が**古い頻度に戻す**ので「コントロールが壊れている」ように見えていた。#434 の `onRepeatConvertFailed` に reason `"update"` を足して toast（文言 = 「前の設定のままです」）
- **見送り 2 件**（理由付きで Issue #469 に記録・起票依頼を outbox へ）: scope 編集後の template 更新（`useScheduleMutations.ts:807` — await していない）と routine 未ロード時の `void updateRoutine`（同 492）。どちらも失敗の意味が「未来の生成が古い値になる」で、toast 1 行では復旧手順を伝えられない
- **ゲート**: shared vitest **154 files / 1279 pass**（main 比 +22 tests・`eventEditorPane.test.tsx` に日付 / 終日 / ヒントの 6 ケース追加）・shared build・web build・web lint すべて exit 0。実ブラウザ検証は chat-main に残す

### 2026-07-30 - #466 Step 5-b Calendar グリッドの繰り返しフィルタ（PR #480 merge 済み・main `9ff4a813`）

#### 概要

グリッドから繰り返し由来（routine 生成）のアイテムを畳むトグルを入れた。粒度は **案 A「繰り返し由来を隠す」を採用し、案 B「この繰り返しだけ表示」を却下**。絞り込みは**永続化しない**（起動時に骨組みの無いカレンダーが出ると、空いて見えるスロットに二重予約する事故になる）。

#### 変更点

- **フィルタは view 層だけに掛ける**: 新設 `shared/src/utils/scheduleGridFilter.ts` の `applyRepeatFilter` を `gridRangeItems` として 1 箇所で適用し、`rangeItems`（`useVisibleRangeItems` の楽観ストア）は素のまま残した。`selected` / mutation 層 / コンテキストメニューはすべて `rangeItems` を引くので、**隠しても編集が書く内容は変わらず、隠れたアイテムは flow タブから編集できる**。差し替え先は `gridItems` / `monthItems` / `anchorDayItems` / `monthDayItems` の 4 つ
- **件数は同じ呼び出しから返す**: `applyRepeatFilter` が `{ visible, hiddenCount }` を返し、ツールバーのラベルはその `hiddenCount` を使う。**バッジとグリッドが別々に数えないので数字が食い違えない**。フィルタ OFF は同一参照を返す identity ケース（下流 memo が無駄に無効化しない）
- **「隠している」を隠さない**: ON 中はツールバーのボタン自体が「繰り返し N 件を非表示」＋ accent 表示になり（`aria-pressed`）、Repeats タブにも同じ state を読む注記と解除ボタンを出す。**フラグが 1 つなので「片方だけ更新されない」が構造的に起きない**。ON にした瞬間、選択中が routine 由来なら選択と popover を落とす（描画されない行を editor / popover が指し続けるのを防ぐ）
- **適用範囲を絞った**: rightSidebar の「今日の流れ」・Todo トレイ・完了集計はフィルタしない（集計の意味が変わるため）。Mobile はトグルを出さない（#467 で List + FAB に絞る側で扱う。derived は既にフィルタ後を読むので配線だけで足りる）
- **テスト**: `scheduleGridFilter.test.ts`（identity / 件数の一致 / null・未定義 routineId の生存 / 非破壊）+ `scheduleToolbar.test.tsx`（prop 省略で非表示 / `aria-pressed` / ラベル切替）。web にテストランナーが無いので判定は shared の純関数に寄せた
- **ゲート**: shared vitest **156 files / 1281 pass**（main 比 +2 files / +24 tests）・shared build・web build・web lint すべて exit 0。実ブラウザ検証は chat-main に残す

### 2026-07-28 - #411 Todo ボードを Materials から Schedule へ移設（PR #454 merge 済み・main `218d8dab`）

#### 概要

Materials を Notes / Daily の 2 タブに、Schedule を Calendar / Todo の 2 タブにした。「今日を組む場所」に組む材料（Todo）と組む先（カレンダー）を同居させる Epic #290 の構成再編で、rightSidebar の「本日の Todo」トレイは元から同じ task を読んでいたためデータ側は 1 本のまま。#408 が同じタブ構造を撤去した直後に足し直す順序（Issue の推奨）で進めた。

#### 変更点

- **導線の全数追随（実質の本体）**: 移設そのものは小さいが、Todo へ行く経路を 1 本でも取りこぼすと「タスクへ飛ぶ」が黙って死ぬ。4 本すべて追随 — nav ショートカット（`nav:tasks` / `nav:schedule` の**両方**がタブを明示 set。片方だけだと `nav:tasks` の直後に `nav:schedule` を押しても Todo に貼り付く）/ `[[link]]` の着地（`MATERIALS_TAB_FOR_ROLE` → `ITEM_NAV_TARGET` に変更し section+tab の組を返す。3 role が 1 セクションを共有しなくなったためタブ名だけでは行き先が決まらない）/ `global:new-task`（Schedule → Todo へ移動してから pending フラグ）/ コマンドパレット（Calendar / Todo の 2 エントリ追加。素の「Schedule」エントリは Materials 同様 sticky のまま）
- **Provider は再利用**: Kanban が要る TaskTree + WikiTags は**どちらも Schedule 側に既に居る**（カレンダーの task チップ用）ので、2 組目を入れ子にせず再利用した。task の持ち主がチップ・トレイ・ボードで 1 つになる。`persistSelection`（#282）はボードと一緒にその mount へ移した
- **narrow はハンバーガーを足していない**: Calendar / Todo の SegmentedControl だけを PageContainer header に出す。Calendar 本体は自前でハンバーガーを描いており、Todo 本体は 768px 未満で drawer を閉じる（モバイル Kanban は詳細パネルを持たない `MobileTaskList`）ため、置くと片方は重複・片方は空 drawer を開くボタンになる
- **型の置き場所を #408 前から変更**: `ScheduleTab` は `ScheduleScreen.tsx` が export し `MainScreen` が import する（switch する側と型を同居させる）
- **docs**: `mobile-scope.md` #4（narrow が Calendar 固定ではなくなった）と #6（materials / tasks → schedule / todo）。design brief は本文を履歴として残し materials.md 冒頭 + schedule.md の #408 注記に差分を追記。`taskSelector.emptyHint` の「Materials で Todo を作成」も両 catalog で修正。Epic #290 に 5-d として追記
- **検証**: shared test 153 files / **1257 tests**・shared build・web build・web lint すべて exit 0。**新規テストは無し**（変更は web/ のホスト配線で web に test runner が無く、shared へ出す判定ロジックでもない）。実ブラウザ検証は merge 後 chat-main（特に narrow の 3 段スタックと Todo タブでの Kanban の高さ）
- **PR を立てる前に自己レビューを済ませた**（#452 の再発防止）。push 直後に `gh pr list --json state,headRefOid` で local HEAD `cd36c25a` との一致を実測 — **が、その後の tracker 更新を push する前に #454 が merge され、`e395e5e0` が置き去りになった**（この worktree で 3 度目・通算 6 度目）。`origin/main` から `claude/schedule-411-tracker` を切って cherry-pick で回収（コンフリクトなし・docs のみなのでゲートは回していない）。**教訓の更新** = 予防策は「レビューを PR より前に」だけでは足りず、**tracker 更新まで含めて全部 commit してから PR を立てる**のが正しい形

### 2026-07-28 - #408 Routines タブ退役 + rightSidebar 繰り返し一覧（PR #452 merge 済み / QA 回収 = PR #453 も merge 済み）

#### 概要

Schedule のヘッダーから Routines タブを外し、繰り返しの編集を Calendar のアイテム編集パネルへ一本化した（Epic #290 Step 5-a）。編集パネル自体はユーザー指示どおり不変で、追加は rightSidebar の「繰り返し」タブ 1 つだけ。役割 QA が Blocking を 1 件返したが、その修正 push の前に PR #452 が merge されてしまい、置き去りコミットを PR #453 で回収している。

#### 変更点

- **設計判断（失われる操作 5 件の切り分け）**: 事前調査で挙げた 5 件のうち **(1) 空 routine の新規作成 / (3) テンプレの直接編集は意図的に退役**（(1) は CLAUDE.md §4「UI 上は Event + 繰り返し設定として提示し、Routine は実装詳細」、(3) は #279 の scope ダイアログが代替）。**埋めたのは (2) 到達性 / (4) テンプレ削除 / (5) order 俯瞰**。**(2)+(4) を落とすと実行日が 1 日も無い routine が永久に到達不能になる**（オカレンスが無いので Calendar から選べず、Routines タブも無い）— #407 のゾンビ 2 件が実在するので机上の穴ではない
- **新規**: `shared/src/components/schedule/RepeatListPanel.tsx`（純粋表示・全 routine を `order` 順）/ `nextRoutineOccurrence`。**null が「この行は飛び先が無い」の判定そのもの**で、その行はボタンにせず span にする（#434 S-1 と同じ「押しても何も起きないコントロールは壊れて見える」原則）が削除ボタンは残す
- **退役**: `RoutinesTab.tsx` / `RoutineEditorForm.tsx` + 型 3 種 + その test / i18n 4 キー（`scheduleScreen.routines`・`newRoutine`・`selectHint`・`tabDetail`）。`ScheduleTab` 型・`scheduleTab` state・タブ帯・`handleBriefingNavigate` も撤去し、Schedule のヘッダーは他セクションと同じ `SectionHeader title` 経路へ。**`useRoutinesAPI.createRoutine` は残した**（UI 呼び出しゼロでも DataService 層の API であって死んだ UI コードではない）
- **role-qa アドバーサリアルラウンド = B 1 / S 4 / N 4。引用 4 件を自分で spot check して全て実在を確認**（`rules/docs-consistency.md` §5）。**B-1 は #408 の主目的そのものが未達だった**: カレンダーのナビゲーションは範囲を**取得するだけ**で occurrence を生成しないため、開始日が未来の繰り返しは一覧に「次回 9月1日」と出てクリックできるのに飛び先が空で、編集する対象が存在しない。`handleOpenRepeat` がジャンプ後に `ensureRoutineItemsForDateRange(next, next, [routine])` を打ってから `reload()` するよう修正
- **S-1** = 行のゴミ箱 1 クリックで系列全体（完了済みの過去分含む）が消え、undo は routine 1 行しか戻さない → 行内に 2 段確認。**S-2** = `deleteRoutine` が失敗しても無言（一覧から行だけ消え occurrence は全部残る）→ 戻り値に `landed` を足して toast。**S-3** = `nextRoutineOccurrence` が頻度しか見ておらず archived な routine に飛び先が出ていた → `routineScheduleSync.ts` へ移して `shouldCreateRoutineItem` を呼ぶ（判定の二重定義を解消。逆向き import は循環になるのでこの向きしかない）。**S-4** = docs 退役 sweep（tier-1-core / 再設計プラン / design brief）
- **置き去り再発（この worktree で 2 度目・通算 5 回目）**: PR #452 を出してから role-qa を起動したため、監査修正 `d6cff838` を push した時点で既に merge 済みだった。`origin/main`（`e503f328`）から `claude/schedule-408-qa-recover` を切って cherry-pick（コンフリクトなし）→ PR #453。**予防策は「PR を立てる前にレビューまで済ませる」の一点**
- 検証 = shared vitest **153 files / 1257 pass**・shared build・web build・web lint すべて exit 0（PR #453 のブランチ = 動いた main の上で再実行）。Epic #290 の Step 5 は 5-a / 5-b / 5-c に内訳を分け、5-a のみ #408 に紐付け（チェックは付けず）

### 2026-07-28 - #434 繰り返し変換の pending 表示・失敗 toast とガードの shared 切り出し（PR #450）

#### 概要

#423（#407）の role-qa 監査で残した follow-up 2 件を実装した。「見送り可」扱いだった 2 も実装している — 1 の実装でガードに描画用の state ミラーが増え、ref と state がずれると「ずっと変換中のまま」か「一度もロックされない」のどちらかに化けるため、テストで固定する価値が新たに出たため。

#### 変更点

- **黙って捨てられていた 2 つの経路**: #407 の in-flight ガードは変換中の 2 回目の頻度クリックを無言で捨て、条件付き attach が reject したときもエディタが reload で「なし」に戻るだけだった。どちらも操作した側からは「押しても無反応」と区別が付かない
- **`FrequencyEditor` に `pending`**（`shared/src/components/schedule/FrequencyEditor.tsx`）: セグメント / 曜日チップ / interval 数値 / 開始日入力を一括 disabled、節に `aria-busy`、頻度ラベルの右に `role="status"` で理由を表示。`labels.converting` は optional なので Routines タブ（`RoutineEditorForm` 経由）は無変更で通る。`SegmentedControl` には対になる `disabled` を追加し、ポインタとキーボード（`stepSegmentFocus`）の両方を no-op に
- **失敗 toast**: `useScheduleMutations` に `onRepeatConvertFailed` を注入し `convertEventToRoutine` の catch で発火 → `CalendarTab` が `showToast("danger", ...)` に配線（#376 `noteAttachFailed` と同契約）。i18n は `scheduleScreen.repeatConverting` / `repeatConvertFailed` を en・ja 両 catalog へ
- **ガードを shared へ**（新設 `shared/src/hooks/useInFlightGuard.ts`）: 肝は **`begin(id)` が check と claim を 1 呼び出しに畳む**こと。「has で見てから add する」2 文に戻せないので、#407 を生んだ check-then-act の隙間を呼び手が再導入できない。**同期の ref が権威で state は描画専用のミラー** — 2 クリックは同じ tick に届きうるので、バッチされる state 書き込みでは 2 個目を素通しする。`inFlightIds` は 1 レンダー遅れうるため書き込み経路の分岐に使わない旨をコメントで明示した。`begin` が true を返したら `finally` で必ず `end` する責務は呼び手側（漏らすとそのセッション中ロックされたまま）
- **テスト**: `frequencyEditor.test.tsx` に pending 4 本、新設 `inFlightGuard.test.ts` に 5 本（**同一 `act` 内の二重 claim を拒否** = 二重クリック相当 / id 独立 / 描画ミラー / 未 claim の `end` は no-op / claim が同期で見える）
- **role-qa アドバーサリアルラウンド（Stop hook ゲート・別コンテキスト・2 コミット目 `69ca32e6`）**: B=0 / S=2 / N=4 で **S 2 件とも修正**（N-4 も取り込み）。**S-1 は自分が入れた退行** = 本物の `disabled` で節をロックすると focusable が 1 つも無くなり、キーボードでセグメントを押した瞬間フォーカスが `<body>` へ退避して戻らない。セグメント / 曜日チップを `aria-disabled` + ハンドラ無効化に、入力を `readOnly` に変更した。**ここで先例をそのまま真似なかった** — QA が挙げた `Menu.tsx:185` / `ItemActionRow.tsx:34` は `disabled` と `aria-disabled` の**併用**だが、あれはメニュー項目で個別に無効化される前提。tablist は roving tabindex を持ち全 segment が同時にロックされるため、併用だと節から focusable が消える。S-2 = `ensureRoutineItemsForDateRange` の reject が `void` された promise の外へ抜け、unhandled rejection になったうえ `reload()` をスキップしていた → catch し、`reload()` を `finally` へ移して**どの出口でもちょうど 1 回**再読込に。この経路は**繰り返し自体は成立している**ので「設定できませんでした」は嘘になる → `onRepeatConvertFailed(reason: "attach" | "materialise")` に変え `repeatMaterialiseFailed` を追加
- **検証**: shared vitest **151 files / 1234 pass**（main 比 +25）、shared build / web build / web lint すべて exit 0
- **スコープ外にした観察**（PR 本文に記載・未起票）: 同じ「黙って失敗する」型が系列パス（既に routine が付いたアイテムの頻度変更）にはまだ残る（`useScheduleMutations.ts:516` の `if (!landed) return;`）。本 Issue の DoD は変換時の attach reject に限定されているので触っていない

### 2026-07-28 - #433 置き去りコミットの回収（PR #435）+ #408 の事前調査

#### 概要

PR #423（#407）の merge **直後**に push した role-qa 修正 2 コミットが main に届いていなかった（#433）ので、`origin/main` から新ブランチを切って cherry-pick で回収し PR #435 を出した。あわせて、merge 待ちで次タスクに着手できない時間を使って #408（Routines タブ廃止）の事前調査を読み取りのみで実施した。

#### 変更点

- **回収の実測**: `git branch -r --contains a873e583` の結果が `origin/claude/schedule-407-repeat-desync` **のみ**で、置き去りが事実であることを確認してから着手。`origin/main`（`415cb185`）から `claude/schedule-433-recover` を切り、`a873e583`（コード）→ `52b6d081`（tracker）の順に cherry-pick。**両方ともコンフリクトなし**。差分は Issue #433 の実測（対象 7 ファイル・174 insertions / 75 deletions）とコード部分が一致し、per-chat tracker 3 ファイルが上乗せされた形
- **着地前 main の実害**: #423 で頻度判定を fail closed（不正な設定は発火しない）にした一方、`FrequencyEditor` の date input が**クリア時に空文字を emit する**経路が main に残っていた。空文字は fail-closed 下で「発火しない」と読まれるため、**開始日をクリアすると reconcile が未来行を掃除する**退行が起きうる状態だった。DoD の `seedFrequencyPatch` が `if (!start)` になっていることを `routineFrequency.ts:115` で実測確認
- **検証**: shared vitest **149 files / 1209 tests 全 pass**、shared build / web build / **web lint** すべて exit 0。web lint はこの worktree で長らく `NotesView.tsx:291` の main 由来 error で赤だったが、今回 origin/main `415cb185` では**再現しない**（引き継ぎメモを訂正済み。どの PR で消えたかは未追跡）
- **#408 事前調査（実装ゼロ・読み取りのみ）**: Routines タブを廃止して Calendar の編集パネルへ一本化したときに**失われる操作 5 件**を特定（空 routine の新規作成 / 全 routine への到達性 / scope ダイアログを挟まないテンプレ直接編集 / テンプレ単位の直接削除 / `order` 順の俯瞰）。加えて reconcile 窓の挙動差（RoutinesTab は今日から 41 日固定 `RoutinesTab.tsx:49`、CalendarTab は可視範囲 `useScheduleMutations.ts:497`）と、道連れ退役候補（`RoutineEditorForm` + 型 3 種・`createRoutine` の UI 呼び出し・i18n 7 キー）を grep 実測で洗い出した。詳細は memory の「予定」節。**サブエージェント報告の file:line は `RoutinesTab.tsx:49` / `ScheduleScreen.tsx:21` / `CalendarTab.tsx:1117` 等を spot check して実在を確認済み**（`rules/docs-consistency.md` §5）
- **#411 の下ごしらえ**: `setMaterialsTab` の呼び出し箇所を `web/src/MainScreen.tsx` で全数 grep（`:246` / `:269` / `:289` / `:318` + タブ定義 9 箇所）。取りこぼすとタスク導線が全部死ぬ箇所なので memory に位置を残した
- **残**: PR #435 の merge（🛑 ユーザーゲート）。着地後に `claude/schedule-407-repeat-desync` を削除し、#434 → #408 → #411 へ進む

### 2026-07-27 - #407 繰り返し表示の不整合 — malformed interval の毎日発火とゾンビ routine を根絶

#### 概要

「繰り返しを『なし』にしたのにアイコンが出続ける / Calendar の重複・欠落が不安定」（#407・Fable 5 指定）の Root Cause を DB 実測（Supabase MCP・SELECT のみ・DML/DDL ゼロ）とコード読解で特定し、fail-closed 化 + 二重変換ガードで修正。PR #423（merge は 🛑 ユーザーゲート）。再現手順と Root Cause 全文は Issue #407 のコメント（`#issuecomment-5089420957`）。

#### 変更点

- **Root Cause（実測）**: live routine「新規予定」が **2 本**（2026-07-16 に 6 秒差で作成）。うち `routine-3c4a1f09` は `interval` 型なのに `frequency_interval` / `frequency_start_date` が NULL で、`shouldRoutineRunOnDate` が malformed interval を `true`（= **毎日発火**）に degrade するため、アプリを開いた日（7/16・7/19・7/26・7/27）ごとに繰り返しアイコン付きの「新規予定」を生成していた。「なし」の detach が切れるのは表示中アイテムが指す 1 本だけなので、もう 1 本が翌日また産む — 症状 1・2 の両方がこれで説明される（DB の行自体は破損なし: 削除済み routine を指す live 行 0 件・partial UNIQUE 違反なし。描画判定 `CalendarTab.tsx` の `isRoutine` も無罪）
- **二重変換レース**: `handleChangeRepeat` の手動→変換分岐は `selected.routineId == null` で判定するが、変換 + 楽観 patch の反映が非同期（range refetch による clobber もあり得る）ため、2 回目の頻度クリックが同じ種イベントを再変換できる。attach は無条件 UPDATE の後勝ちなので、負けた routine が誰からも参照されないまま live に残る（ゾンビ生成経路）
- **修正 1 `shared/src/utils/routineFrequency.ts`**: interval の malformed 設定（NULL/0/負値 interval・開始日なし）は **fail closed（発火しない）**。`default` 分岐（Issue 017 の暴走生成ガード）と同じ思想。既存ゾンビも DML なしで発火が止まる
- **修正 2 `shared/src/services/SupabaseDataService.ts`**: `convertEventToRoutine` の attach を「種がまだ未 attach のときだけ」（`.is("routine_item_id", null)` + 影響行読み戻し）の条件付き UPDATE に変更。負けた変換は routine をロールバックして reject（`DataService.ts` の契約コメントも追随）
- **修正 3 `web/src/schedule/useScheduleMutations.ts`**: `convertingSeedsRef`（in-flight ガード）で変換中の種への追加頻度クリックを無視
- **回帰テスト**: `routineScheduleSync.test.ts` に fail-closed 5 分岐（NULL/0/-2 interval・NULL/空文字開始日 — 旧「degrade to true」テストを反転）、`convertEventToRoutine.test.ts` に条件付き attach の `.is()` フィルタ検証 + already-attached 時のロールバック/reject
- **role-qa アドバーサリアルラウンド（Stop hook ゲート・別コンテキスト・2 コミット目 `a873e583`）**: B-2 採用 = `FrequencyEditor` の date input が空文字を emit し、fail-closed 化で「開始日クリア → reconcile が未来行を掃除」に化ける退行 → 空 emit 抑止 + `seedFrequencyPatch` の "" 補修 + テスト 2 本。S-1 = routine 不在 fallback（Calendar / Routines 両導線）に seeding を配線。S-2 = 変換 rollback の supabase-js 非 throw 失敗を `logServiceError` で可視化。S-3 = ガード解放を try/finally 一本化。S-5 = attach 0 行時の文言に missing-seed を含める。N-1 = plan doc Worklog 追随。**B-1「fail-closed は既存ゾンビを止められない」は DB 実測で反証**（`3c4a1f09` は #352 seeding 導入前の malformed。現行コードの敗者双子は条件付き attach がロールバックで殺す）。S-4 / S-6 は follow-up として outbox で起票依頼
- **検証**: shared vitest 145 files / 1175 pass（+2）、shared build / web build / web lint 全て exit 0
- **残**: merge 後にユーザーが Routines タブから「新規予定」routine 2 本（`3c4a1f09` / `b15eb258`）を削除（生成済み si- 行は cascade で掃除）。実ブラウザ検証は chat-main（§7.4）

### 2026-07-27 - #367 Schedule サイドバーのソート・フィルタ = 見送りで決着（実装ゼロ）

#### 概要

#283（Notes / Daily の rightSidebar ソート・フィルタ）の follow-up として起票された #367 を、**導入しない**判断で close した。共有部品 `SidebarListControls` は既にあるが、「部品があるから付ける」ではなく実際に使う場面があるかで判断せよ、というユーザー指示に沿ってコード実測 + 本番 DB 実測を根拠にした。コード変更ゼロのため PR なし。根拠は Issue コメントに全文を残し、再オープン条件も併記した（判断を残さず閉じない）。

#### 判断の根拠（4 点）

- **Issue の前提が実装とズレていた**: Routines タブの rightSidebar は `RoutineEditorForm`（選択中 1 件の編集フォーム）だけで、**リストが存在しない**（`web/src/schedule/RoutinesTab.tsx:200-221`）。ルーチン一覧は main area 側（同 `:168-194`・`order` 昇順）。`SidebarListControls` は自身のヘッダコメントで「sized for a ~240px sidebar」と宣言している部品なので、幅の広い main area の一覧に載せる対象ではない
- **Calendar サイドバーの 2 リストは当日スコープ**: `AgendaList`（今日の流れ）と `TodayTodoTray`（本日の Todo）はどちらも毎日リセットされる。#283 が対象にした Notes / Daily は逆に**積み上がるアーカイブ**（Daily は毎日 1 件増える）で、「過去から探す」局面が実在する — 性質が違う。本番 DB 実測（`events_payload` × `items_meta`）で **events は 1 日あたり最大 3 件・平均 1.5 件**、routines live 3 / tasks live 5（比較: notes 9 / dailies 6）。最大 3 行のリストの上にソート選択 + フィルタ欄を積むと、操作 UI のほうがリスト本体より背が高くなる
- **並び順の反転は「好み」ではなく機能破壊**: `AgendaList` の now-line は `findIndex(startTime >= nowMinutes)` で挿入位置を決めており**昇順ソート済みが前提**（`shared/src/components/schedule/AgendaList.tsx:98-104`）。direction toggle で desc に倒すと線が過去側に描かれる。「今日の流れ」は時系列であること自体が機能なので方向を選ばせる意味がない
- **フィルタが効きそうな唯一のリストは既に別導線でカバー済み**: 日スコープでない pool は `pickAddableTasks`（未スケジュール・未完了の leaf task / `shared/src/utils/todayTodo.ts:25-38`）だけだが、**同じ pool を使う `ItemCreatePanel` のタスクタブには既に検索欄がある**（`shared/src/components/schedule/ItemCreatePanel.tsx:311, 436-442`）。live task 5 件の現状で 2 つ目の検索 UI を足す理由がない

#### 変更点

- **Issue #367**: 上記を根拠コメントとして投稿（`#issuecomment-5088740620`）→ `NOT_PLANNED` で close。再オープン条件も明記 =「タスクから追加」の候補が常時 20 件超で tray が縦スクロールするようになったら `TodayTodoTray` に **filter だけ**（sort 不要）を載せる / Routines の一覧が rightSidebar へ移設されたか 20 件を超えたら再検討
- **コード変更なし**: `SidebarListControls` は #283 のまま存置（Notes / Daily が使用中）。ブランチ `claude/schedule-367-sidebar-controls` は `origin/main` から作成したが、実装差分はゼロで本 tracker 更新のみを載せた
- **副産物の実測**: PR #400 が merge 済み・Issue #376 が close 済みであることを `gh pr list` / `gh issue view` で確認し、前セッションから持ち越していた「#400 OPEN」の進行中ブロックを完了へ確定した

### 2026-07-26 - #376 統合アイテム生成パネル（Step A merge / Step B レビュー待ち）

#### 概要

Schedule の生成パネルを予定専用フォームから 予定 / タスク / ノート の 3 タブに拡張した。ノートは時刻を持たないため 3 つ目の作成対象にはせず、作られる予定・タスクへ紐づく「添付」として実装（ユーザー決定 2026-07-26）。Step A = PR #393 merge 済み、Step B = PR #395 レビュー待ち。

#### 変更点

- **新部品 `ItemCreatePanel`**: `EventCreateFields`（#299）を置換し、Desktop 生成オーバーレイと Mobile QuickCaptureSheet の両方が同一パネルを描く。タイトルと時刻の下書きは種類タブを跨いで共有（途中で「予定じゃなくタスクだ」と気づいても打ち直しにならない）
- **タスクタブ**: 「新規作成」= `addNode("task", null, title, { scheduledAt, scheduledEndAt, isAllDay:false })`、「既存から選ぶ」= `pickAddableTasks` プールを部分一致検索 → `updateNode` で同じ配置。Schedule にタスク詳細エディタが無い（#297）ため「追加して詳細へ」の相方は置かない
- **ノートタブ（添付方式）**: 新規作成 or 既存選択を staged し、submit の 4 番目の引数 `ItemCreateNoteDraft | null` として渡す。ホストが新規なら `createNoteUnified` → `createItemLink(itemId, noteId)`（向き = アイテム → ノート・DailyView と同型）。パネルは直前の 予定 / タスクタブを `target` として保持するので、ノートタブを開いてもフッターの submit が死なない
- **実測に基づく設計判断**: `ScheduleItem.noteId` は型にあるが `SupabaseDataService` が `void noteId` で捨てる（events↔notes は列ではなくリンク）。よって item link モデル一択
- **ノート一覧の取得**: `web/src/schedule/useCreatePanelNotes.ts` がパネルを開いている間だけ `listNotesUnified()` で引く。`NotesUnifiedProvider` は本文 hydration とゴミ箱まで抱えて Realtime のたび走り直すため、タイトルだけの picker には常時コストが重い
- **共通化**: task / note の picker を `PickerList` に集約。選択は現在の検索結果を通して解決するので、絞り込みで消えた行は選択も外れる（見えないものを操作しない）
- **docs**: `plans/2026-07-14-schedule-redesign.md` §4.6 に #298 トレイとの棲み分け（宣言 vs 配置）とノートタブの設計判断を明文化。§2-4 の `schedulePanel.*` 記述に「#341 で削除済み」の歴史注記
- **i18n**: `scheduleScreen.*` にタスク系 + ノート系キーを en/ja 追加、`taskSource*` → `source*` に改名、孤立した `quickAddTitle` を削除。`generateId` を shared のルート export に追加
- **検証**: shared vitest 143 files / 1141 pass、shared・web の `tsc -b` と vite build 全て exit 0。web lint は既存 1 件（`NotesView.tsx:268`）のみ。DDL ゼロ
- **運用上の事故と回収**: PR #393 が Step B の push 前に merge されたため、Step B を `origin/main` から切り直した `claude/schedule-376-note` に cherry-pick して PR #395 に分離。衝突は `shared/src/index.ts` の隣接追加 1 箇所（#371 の `pendingItemLinks` export）のみで、両方残して解消

### 2026-07-26 - #299 follow-up 3 本（#353 / #354 / #355）+ main ビルド復旧

#### 概要

#352 に続けて #299 の follow-up 3 本を 1 Issue = 1 ブランチ = 1 PR で提出。途中で **main の `shared` が型検査を通らない**ことを発見し、ユーザー判断で復旧のみの別 PR を先出しした。各 Issue とも role-qa 独立監査を通し、Blocker 0 / Should は同 PR 内で解消。

#### #353 生成パネルに対象日を表示（PR #382）

- `EventCreateFields` に読み取り専用の日付行（`dateLabel` prop）。Desktop オーバーレイと Mobile QuickCaptureSheet が同部品を使うので 1 箇所で両方に出る。整形はホスト（対象日 + ロケールの保有者）が `Intl.DateTimeFormat` で行い、年も含める（月をまたいで移動した先で開くため）
- 生成の入口 3 経路（ツールバー / 空きスロット / 月セル）が全て `openCreatePanel` を通ることを実測で確認
- i18n `scheduleScreen.date`（en/ja）。role-qa: 日付が `YYYY-MM-DD` をローカル解釈しているか（UTC 解釈だと TZ で 1 日ずれる）を実測確認 → PASS。Should 1 件（`dateLabel` の JSDoc が型的に存在し得ない「legacy host」に言及）を修正

#### #354 生成後に新規アイテムを開く導線（PR #384）

- **プロダクト判断はユーザーがチャットで直接選択**（3 案提示 → 押し分け方式）。生成パネルを「予定を追加」/「追加して詳細へ」の 2 ボタンに
- **Mobile のプレーン作成はあえて何も選択しない**: Mobile は選択＝詳細シート表示（`editorPane` が `selected` から算出）なので、選択すると 2 ボタンが同じ動きになる。Desktop は選択リングのみ（ただし MonthGrid は `selectedId` を受け取らない部品なので月ビューはマーカー無し — role-qa 指摘で コメントを実態に合わせた）
- Enter はプレーン作成のまま（速い経路を速いまま保つ）。i18n `scheduleScreen.addEventAndOpen`（en/ja）

#### #355 ダブルクリック時の吹き出しフラッシュ抑制（PR #386）

- 原因はブラウザのイベント順（click → click → dblclick）で、1 クリック目では判別不能。**吹き出しだけ 350ms 待たせ**、ダブルクリック側が取り消す。選択は即時のまま
- 当初 200ms → role-qa 指摘（Windows のダブルクリック閾値 500ms に対し 200-500ms 帯でフラッシュが残る）で 350ms に。400ms 超は反応が鈍く感じ始めるため手前に置く
- 取り消しは **effect 1 本に集約**（当初は詳細 / 右クリック / 生成パネルに個別実装 → role-qa がカレンダー管理モーダルと繰り返し範囲ダイアログの 2 経路漏れを指摘。開く場所が本ファイルと mutation 層に散っており個別方式では次に増えたとき必ず漏れる）
- 仕組みは `shared/src/hooks/useDeferredAction.ts`。**web にテストランナーが無い**ためホスト内 ref ではなく shared のフックにしてテスト可能化（7 ケース）

#### main のビルド復旧（PR #385・キュー外）→ **重複で空マージ。診断も誤っていた**

- **事象**: `shared` がクリーンビルドで 6 エラー。`analyticsAggregation.ts` が `../types/wikiTag` から `WikiTag` / `WikiTagAssignment` を二重宣言し、実使用中の別名 `WikiTagUnified` / `WikiTagAssignmentUnified` が消えていた（未使用の `WikiTagConnection` も混入）。原因は `d80e9fc6`（PR #378 / #356）の squash merge で、主題（`todayCalendarKey` への置換）と無関係な import 群が書き換わった事故
- **修正内容自体は正しかった**（別名 import を戻す 3 行入れ替え。#378 の他の変更には触れず）。role-qa も型・呼び出し側・実データ形状の一貫性を実測して PASS
- **しかし PR #385 は不要だった**: **#383（`eb893f94`, 11:29）が既にバイト単位で同一の修正**を入れており、11:49 作成の私の PR は差分ゼロで squash merge された（`fe8f0362`）。着手前に `git fetch origin` していれば気付けた（CLAUDE.md §7.4 はブランチ作成のたびに効く）
- **根本原因の診断も誤っていた**（role-qa の監査で判明・memory と outbox を訂正済み）: 「`tsc -b` が増分だから見逃された」と書いたが、**`web/package.json` の build は最初から `tsc -b --force`** で references 経由の shared をフルチェックしている。同セッションの #353 / #354 が緑だったのは増分のせいではなく、**分岐元 main がまだ壊れていなかった**だけ（`git merge-base` で実測可）。壊れた版はどのブランチにも存在せず**マージ後の main にだけ現れた**ので、手元の検証をいくら厳しくしても捕まらない。実効的な対策は「マージ後の main でビルドを回すゲート」であり、当初 chat-main に依頼しかけた「検証時は `--force` を明文化」は的外れだった

#### 検証

- shared クリーンビルド（`*.tsbuildinfo` 削除 → `tsc -b --force`）exit 0 / vitest **1110 pass**（140 files）/ web build exit 0 / `web` eslint は変更ファイル単体で 0 指摘
- 既知の赤: `cd web && npm run lint` は `web/src/notes/NotesView.tsx:291` で 1 error（main 由来・変更範囲外・chat-main へ起票依頼済み）

#### 申し送り（outbox → chat-main、起票依頼 3 件）

- `NotesView.tsx` の lint error（main 由来）
- Mobile 月表示で FAB が `mobileSelectedDay` ではなく `anchorDate` に作る（#353 以前からの挙動だが日付表示でズレが可視化される）
- 生成直後の楽観行が同期リフェッチで消えると、開いたばかりの詳細エディタが閉じる（#354 が「作ってすぐ書き足す」を推奨導線にしたため露出面が拡大）

### 2026-07-26 - #352 Epic #290 Step 4: Routine 頻度編集の未来伝播（reconcile 配線）+ dead code / RoutineGroup 削除

#### 概要

Routine の**頻度**を変えても materialise 済みの未来 occurrence が古いリズムのまま据え置かれる穴を埋めた（テンプレ更新は「これからの生成」にしか効かないため、発火しなくなった日に予定が残り、新たに発火する日は空のままだった）。`reconcileRoutineScheduleItems` を Calendar のイベント詳細 + Routines タブの両導線に配線し、競合ルール（tier-1 §Schedule 1-3）を vitest で pin。あわせて未配線 dead code と RoutineGroup を撤去（**DDL ゼロ**）。role-qa 独立監査で Blocker 1 + Should 3 を受け同 PR 内で修正。**PR #381**（`Closes #352`・merge は 🛑 ユーザーゲート）。

#### 変更点

- **reconcile 本体** (`shared/src/hooks/useScheduleItemsRoutineSync.ts`): 掃除フィルタを競合ルール準拠に改修 — done / dismissed / 過去 / 手動移動（`source_date` ドリフト）に加え、**編集前テンプレート（title / startTime / endTime）と不一致 = 手動編集**の行を除外（時刻 null は生成デフォルト 09:00-09:30 を実効値として比較 = #279 と同じ規則）。生成側は `collectRoutineItemsForDates` に委譲して deleted/archived/hidden ガードを継承 + 過去日への materialise 禁止。書き込みゼロなら `onChanged` 不発火。`group` 引数を廃し `(routine, dateRange?, template?)` に
- **配線** (`web/src/schedule/useScheduleMutations.ts` / `RoutinesTab.tsx` / `ScheduleScreen.tsx` / `CalendarTab.tsx`): 繰り返し設定の編集で テンプレ更新 → reconcile → reload。窓は Calendar = 表示中の範囲 / Routines タブ = 今日から 6 週間（月グリッド最大幅・同タブは可視範囲を持たないため）
- **削除**: 未配線 3 関数（`ensureRoutineItemsForWeek` / `backfillMissedRoutineItems` / `syncScheduleItemsWithRoutines`）+ 唯一の消費者を失った `fetchLastRoutineDate` + `diffRoutineScheduleItems` の `toUpdate`（#279 で適用停止済み）+ RoutineGroup 一式（型 / mapper 2 / DataService 6 メソッド / Supabase サービス 2 クラス / `buildGroupForRoutineMap` / FrequencyEditor の group UI / i18n 2 キー / 関連テスト）。**-2337 / +454 行**
- **DDL ゼロの帰結**: テーブルと 0008 CHECK の `'group'` が残るため、`normaliseFrequency`（routineMapper）が legacy 行を「発火しない routine」に正規化する（throw させると 1 行で Routine 一覧全体が壊れる）。`REALTIME_TABLES` も publication 完全一致の不変式（`syncRealtimeTables.test.ts`）があるため 2 テーブルを維持 — **一度外して落としたので戻した**
- **role-qa 対応** (`fe79fc6d`): **B-1** セグメント切替は `{ frequencyType }` 単体で届くため「曜日」直後は発火ゼロ / 「N日ごと」直後は毎日発火の中間状態になり、reconcile 配線によりこれが即破壊的操作化していた（曜日を選ぶ前にシリーズの未来が一掃される）→ 純粋関数 `seedFrequencyPatch` で補完。あわせて `fetchScheduleItemsByRoutineId` が日付フィルタを持たない事実に対し**掃除範囲を再生成範囲と対称化**（無制限掃除 → `dateRange` 内に限定）。**S-1** Routines タブ未配線を配線。**S-2** `updateRoutine` を `Promise<boolean>` 化し、テンプレ更新失敗時は reconcile 中止（ねじれ防止・既存の fire-and-forget 呼び出し側は無変更）。**S-3** reconcile の JSDoc が「bulkCreate の upsert が吸収」と書いていたが実装は plain INSERT + 事前 pre-check（衝突は 23505 でバッチ全体ロールバック）で真逆 → 実体に訂正。**S-4** rule 2 が memo を見ない点を tier-1 に明記
- **docs**: tier-1-core.md（Routine 変更の反映 / backfill / 競合ルール 2 / AC2 — **AC2 は `[x]` を撤回して未達に戻した**: Routines タブに時刻の系列伝播経路が無いため）/ plans Step 4 を ✅ + Worklog 2 本 / briefs schedule.md の RoutineGroup 行
- **検証**: shared `tsc -b` + vitest **1066 pass**（135 files）/ web `tsc -b --force` + vite build green。新規 `shared/tests/reconcileRoutine.test.tsx` + `seedFrequencyPatch` 6 ケース + `normaliseFrequency` 3 ケース。`supabase/` 差分 0 件
- **既存問題の申し送り**: `cd web && npm run lint` が `web/src/notes/NotesView.tsx:291` で 1 error。**当該ファイルは origin/main と同一**で本件スコープ外 → outbox で chat-main へ起票依頼

### 2026-07-25 - #299 アイテム操作 UI 刷新（生成パネル化 + 吹き出し + 詳細オーバーレイ）

#### 概要

Schedule のアイテム操作を「1クリック=吹き出し / ダブルクリック=詳細オーバーレイ / 右クリック=既存メニュー維持」に再編し、イベント生成をパネル化、rightSidebar の detail 編集タブを撤去した（flow/todo タブは温存）。前提部品 #307 itemActions（ItemActionPopover / ItemDetailOverlay / floating.ts）を merge 済み土台として消費。今回はイベント生成に絞り、task/note 統合パネルは将来 Issue（前回 outbox 起票依頼済み）。role-pm → role-engineer → role-qa（別コンテキスト独立監査 PASS・Blocking 0）のフルチェーン。

#### 変更点

- **塊0 グリッド配管**: WeekTimeGrid / MonthGrid / AgendaList に `onItemActivate(id,{x,y})` + `onItemDoubleClick` を追加。WeekTimeGrid は pointer-up の非ドラッグ分岐（`d.moved` false）でのみ activate 発火し #297 drag/resize と非衝突・座標は pointerup event から取得
- **塊1 吹き出し**: CalendarTab に popover state 追加、handleSelectItem を detail タブ遷移から ItemActionPopover 表示へ。概要 + 「詳細を編集」+ duplicate/delete クイック操作。Escape / 外側クリックで閉じる（floating.ts の IME ガード済み dismiss）
- **塊2 詳細オーバーレイ**: ItemDetailOverlay（Modal ラップ・不透明・focus trap）に既存 EventEditorPane を children としてホスト。ダブルクリック / 「詳細を編集」の両経路から開く
- **塊3 生成パネル化 + detail タブ撤去**: 新規 `EventCreateFields`（title/start/end 共有生成フォーム・IME ガード・prefill）を QuickCaptureSheet に内包。ツールバー「イベント追加」+ グリッド空きスロット + 月セルの 3 経路を生成オーバーレイ（Desktop）/ QuickCaptureSheet（Mobile）に統一・空きスロットはクリック時刻をプリフィル。#278 pendingDraft の eager-create を撤去し `handleCreate(date,title,start,end)` の送信時生成へ一本化。sidebarTab 型を `"flow"|"detail"|"todo"` → `"flow"|"todo"` に縮小し detailBody 削除（`tabDetail`/`selectHint` は RoutinesTab が消費中のため catalog 保持・CalendarTab 参照のみ除去）
- **i18n**: `scheduleScreen.editDetail` / `itemActionsLabel` を en/ja 追加
- **検証**: shared `tsc -b` + vitest **1115 pass**（140 files・新規 eventCreateFields 4 本）/ web `tsc -b --force` + vite build green。メイン独立実測でも一致（docs-consistency §5 spot check 済み）
- **follow-up（outbox 経由 chat-main へ起票依頼）**: N1 ダブルクリック時の吹き出し一瞬フラッシュ（cosmetic）/ N2 生成オーバーレイに対象日非表示（UX 改善）/ N4 生成後に新規アイテム未オープン（プロダクト判断）
- **PR**: `claude/schedule-refine` から提出（`Closes #299`・merge は 🛑 ユーザーゲート・実ブラウザ確認は merge 後 chat-main）

### 2026-07-20 - #296 消失バグ + #297 A-2 双方向書き込み（PR #309 同梱）

#### 概要

#296（Schedule アイテムが繰り返し操作周辺で消える）と #297（Step 2 / A-2: 予定済み task チップを drag/resize して `scheduledAt`/`scheduledEndAt` を書き戻す双方向連携）を実装。#296 の PR #309 が open のまま同ブランチに #297 を積んだため、ユーザー決定で **#309 を #296+#297 の 1 本に統合**した（`Fixes #296, #297`）。role-qa は両 Issue とも別コンテキストで PASS。

#### 変更点

- **#296** (`39b51c99`): `detachRoutine` に `keepItemIds`（編集中 occurrence をピン留め）/ 新設 `convertEventToRoutine`（seed を in-place attach・routine 作成→meta bump→attach 順で失敗時ロールバック・楽観 routine のリスト追加を await 後に遅延）/ 生成器の掃除を物理削除→ソフトデリート化・hand-moved 行（`date≠sourceDate`）除外 / `loadDateRange` throw 化 + visible-range 前回リスト保持 + retry バナー + `syncVersion` 再取得 / この予定のみ削除に「スキップ済み」+戻す UI。`events_payload.source_date`→`ScheduleItem.sourceDate`（read-only）を通した。vitest 3 本追加
- **#297** (`d80e0b96`): `taskCalendarChips` に純関数 `unwrapTaskChipId` + `localDateTimeToISO`（UTC→local 読み取りの逆変換・`24:00`→翌日`00:00`）追加 / `WeekTimeGrid` に `taskInteractive` prop（default false で A-1 読み取り専用維持）/ `useScheduleMutations` が task チップの move/resize を host コールバックへ委譲 / `CalendarTab` が `updateNode` で scheduled フィールドを書き両グリッドに `taskInteractive` 注入。純関数テスト 5 本追加
- **検証**: shared `tsc -b` + vitest **1069 pass** / web `tsc -b` + vite build green / web eslint 0 error（1 warning は非対象 `DebouncedTextInput.tsx` の既存分）
- **後追い**: 多日/overnight task を drag すると span が潰れる deferrable エッジ（A-1 の切り詰め描画 + `minutesToTime` 24:00 クランプ）を outbox で chat-main に Issue 起票依頼（Epic #290 配下）
- **PR 運用メモ**: `claude/schedule-refine` は long-lived ブランチで、open PR に次 Issue を積むと同梱される。厳密な 1 Issue=1 PR は「前 PR が merge されるまで次を積まない」運用が前提

### 2026-07-19 - section:schedule スプリント完了（#281 #278 #279 #280）

#### 概要

section:schedule の open Issue 4 件を実装 → 検証 → close した。#279 は範囲選択ダイアログ（この予定のみ/今後/すべて）+ Repeats 変換の可視化、#280 は CalendarTab の責務分離リファクタ（1740 → 994 行・behavior-preserving）。全段で QA アドバーサリアル監査を通し、shared 992 tests + shared/web build green。

#### 変更点

- **#281** (`0c4837c3`): 週ビュー hover 背景の除去 + Day ビュー背景の標準トークン化
- **#278** (`dcb57550`): 未保存 draft がある間のクリック新規生成防止（fetchedRange による自己修復ガード）
- **#279** (`3205cc5e`): RepeatScopeDialog 新設（i18n en/ja・Cancel 先頭フォーカス）/ `updateFutureScheduleItemsByRoutine`（競合ルール 1・2 準拠フィルタ・null テンプレはデフォルト時刻照合）/ 変換時の窓クランプ付き materialise / 生成器 creation-only 化 / 時刻入力 commit-on-blur / Modal Esc stopPropagation。docs 追随 = tier-1-core 競合ルール 5 + unification plan 補遺
- **#280 Stage A** (`3205cc5e` 後続): 純ドメインを shared/utils へ — scheduleLabels 移設・todayCalendarKey 統合（3 重実装解消）・calendarView 正規化/可視範囲・taskChipId/isTaskChip・makeOptimisticScheduleItem。全モジュールに vitest
- **#280 Stage B** (`0270728e`): CalendarTab を useCalendarNav / useVisibleRangeItems / useScheduleMutations に分割・QuickCaptureSheet を shared 部品化（IME ガードテスト含む）
- **運用**: outbox に routineFrequency の frequencyStartDate 無視問題（Step 4 候補）の起票依頼を append

### 2026-07-18 - #217 完了確定（PR #265 merge 取り込み）

#### 概要

PR #265（weekStartsOn prefs のカレンダー配線・Closes #217）の merge を origin/main から取り込み、tracker を完了へ確定した。実ブラウザでの表示確認は chat-main 側で実測する（§7.4 localhost 集約ポリシー）。

#### 変更点

- **git 同期**: `git pull --ff-only`（自ブランチ up to date）+ `origin/main` merge（briefing/notes/i18n 系の差分・衝突なし）
- **tracker**: 進行中を空にし、#217 を直近の完了へ移動。予定に schedule-redesign Step 2（Task↔Schedule 統合）の下調べを登録

### 2026-07-16 - #217 weekStartsOn prefs のカレンダー配線 (PR #265)

#### 概要

週の始まり（日曜/月曜）prefs をカレンダー描画に配線した。settings 側の保存 API が未実装だったため、#218（day-start-hour）と同じ分担で pref フック自体を shared に新設し、読み手（CalendarTab）まで配線して PR #265 を提出した（Closes #217・merge = 🛑 ユーザーゲート）。

#### 変更点

- **shared**: `hooks/useWeekStart.ts` 新規 — キー `life-editor-week-start`（"0"=日曜既定 / "1"=月曜）、`useWeekStartPref()` + 純関数 `parseWeekStart` / `getWeekStartsOn`（React 外読み手用・#218 の `getDayStartHour` と対）。index.ts から export
- **web**: `CalendarTab.tsx` — `startOfWeekKey` / `monthGridKeys` / `MonthGrid`（desktop + mobile）へ pref を配線（従来はハードコード 0）。`WeekTimeGrid` は day key からラベル導出のため props 不要（`weekStart` の補正だけで追随）
- **テスト**: `shared/tests/useWeekStart.test.ts` 新規（parse/read の純関数テスト）。shared vitest 113 files / 908 tests green・shared/web build green
- **運用**: Settings 書き込み UI は settings 領分のため未実装 — chat-main へ起票依頼を outbox に追記（#218 の day-start-hour UI 未配線も同 Issue に含める提案）。worktree 環境整備として node_modules install + `.claude/comm/.session-name`（schedule-refine）を作成

### 2026-07-12 - life-tags S3 完了確認 + #185 Step 3-4 外部完了の記録整理

#### 概要

materials-refine の S3（NodeType folder 除去・PR #244）の merge をこのレーンから実測確認し、schedule 側の無事故（build/test green）を検証した。また #185 Step 3-4 が別セッション（chat-schedule-event-routine・PR #245）で完了・#185 closed になっていたため tracker を整理した。

#### 変更点

- **S3 確認**: PR #244 merge・epic #225 closed・`NodeType = "task"` 単一値（残る "folder" は経緯コメントのみ — taskTree.ts / Kanban を grep 実測）。main 取り込み（衝突なし）後、shared build + vitest 884/884・web build green — schedule レーンに S3 起因の破壊なし
- **db push 事後**: 0015〜0021 適用済み・0021（calendars.tag_id + FK）・0020（変換 = 新規タグ 5 / assignment 1 / active folder 0 = 計画 §B-7 一致）を read-only SQL で検証済み（前セッション）
- **#185**: Step 3-4（Event 編集の繰り返しセクション + detachRoutine）は PR #245 で実装済み・#185 closed。残 Step 5（runtime 確認）/ Step 6（MCP 切り出し起票）は chat-main 領分 — 本レーンの予定から除去
- **次タスク**: open Issue #217（weekStartsOn prefs のカレンダー配線）が本レーンの唯一のキュー

- 2026-07-11: [途中] life-tags 統一 S2（CalendarView folder→life-tag rebind）— main merge・folder 依存の全数実測・Issue #231 起票・materials-refine へ案(a) life-tag バインド合意返信（outbox）。実装は合意確定後

### 2026-07-11 - life-tags 統一 S2: calendars の folder→life-tag rebind (#231, PR #239)

#### 概要

folder ノード廃止（life-tags 統一・epic #225）に伴う Schedule 側追随として、calendars の folder バインドを life-tag（WikiTag）直接参照に置換し PR #239 を提出した。materials-refine と outbox 合意済みの案 (a)。S1（PR #237）と独立に実装し、merge で S3（NodeType folder 除去）が解禁される。

#### 変更点

- **DB**: `0021_calendars_tag_rebind.sql` 新規（ローカル先行・🛑 ユーザー push ゲート）— `calendars_folder_id_fkey`（0008 §15 の items_meta 参照）+ `idx_calendars_folder` を drop、`folder_id` → `tag_id` rename（DO ガードで冪等）、`calendars_tag_id_fkey` → `wiki_tags(id)` ON DELETE CASCADE + `idx_calendars_tag`。本番 0 行のためデータ移行なし
- **shared**: `CalendarNode.folderId` → `tagId`（types/calendar・calendarMapper・useCalendarsAPI・DataService・SupabaseDataService）。tag_id は update 経路 immutable（rebind = 再作成）を維持し、whitelist 免疫テスト（scheduleMapper.test.ts）も新列名へ追随。sync.ts はドメイン型参照のみで自動追随
- **web**: CalendarView を folder select → tag select（`useWikiTagsUnifiedContext().allTags`・active のみ・未知/soft-deleted は id fallback + 作成ガード）。MainScreen の schedule 分岐から TaskTreeProvider 撤去（消費者ゼロを grep で確認・tasks 分岐は温存）。stale コメント刷新
- **監査**: role-qa PASS with findings（Blocking 0）/ migration-validator PASS（FK 系譜・冪等性・RLS/Realtime 無影響を確認）/ sync-auditor PASS（sync class 契約維持・列名直書きゼロ）。指摘反映 = 0021 コメント精緻化（INSERT 経路・dangling tag 注記）+ 免疫テスト差し替え
- **検証**: shared vitest 852/852・shared/web build pass。runtime 実測は merge 後 chat-main。**運用注意: 0021 の db push はコード merge より先（同時）・push 直前に calendars 0 行確認**

### 2026-07-11 - Schedule UX 3 件: status タグ / 右クリックメニュー / セルクリック→パネル (#222 #223 #224, PR #230)

#### 概要

ユーザー直接指示 3 件を Issue 起票(#222/#223/#224)→ role-engineer 2 体逐次実装 → role-qa 独立監査 → Important 指摘修正の流れで消化し、PR #230 を提出した。先行して #185 Step 2(FrequencyEditor)分を PR #221 として提出し、ユーザー merge 済み。

#### 変更点

- **#222 status タグ**: `deriveScheduleStatus`(shared/src/utils/scheduleStatus.ts)で時刻から 3 値導出(DB 変更なし = ユーザー決定)。`ScheduleStatusTag` 新設(未着手=グレー/着手中=青/完了=緑・`schedule-tag-*` 9 トークンを tokens.css に light/dark で追加)。AgendaList(丸チェック置換・タグクリックでトグル・aria-pressed 維持)/ EventEditorPane / WeekTimeGrid に配線。MonthGrid chip は幅都合で非適用
- **#223 右クリックメニュー**: `ScheduleItemContextMenu` 新設(portal・端クランプ・Escape/外側 close・lumen)。rename(インライン・IME ガード)/ duplicate / delete(ソフト)。WeekTimeGrid・MonthGrid に `onItemContextMenu` prop 追加。Desktop 限定
- **#224 セルクリック**: 月セル・アイテムクリックの `setView("day")` 撤去 → 作成(デフォルト時刻)+ rightSidebar 詳細パネル表示に変更。Toolbar の明示 view 切替と mobile 分岐は温存
- **QA Important 修正**: 複製時 memo の後追い UPDATE が create INSERT と競合し得る問題 → memo を `createScheduleItem`(DataService 層まで optional param)に畳み込み単一 INSERT 化。複製の undo も 1 回に
- **検証**: shared vitest 845/845(+26 新規)・shared/web build pass・eslint CalendarTab 0 warn。runtime 実測は merge 後 chat-main(localhost 集約ポリシー)
