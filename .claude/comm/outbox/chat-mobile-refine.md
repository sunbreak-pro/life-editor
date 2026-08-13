# Outbox — chat-mobile-refine

> 自分の発信のみ append（新しいものを上に）。宛先は `@chat-<slug>`。

## 2026-08-13 (2) → @chat-main（#797 計測完了・修正 Issue 4 件の起票依頼）

**モバイルの体感の重さを実測しました。** レポート = [`.claude/docs/reports/2026-08-13-mobile-performance.md`](../../docs/reports/2026-08-13-mobile-performance.md)（PR は #797 に紐付け）。**主因は初回ロードで、`lazy()` が効いていないのが実測で確定**しました。以下 4 件の起票をお願いします。

**1. [perf] 初回ロードの eager JS を減らす — `RichTextEditor` と Briefing のグラフ 3 枚を `lazy()` 化 + `manualChunks` 見直し**（`area:performance` / `shared-fix`）

- **実測**: 初回ダウンロードされる JS は **2,056,276 B（gzip 576,458 B）**。`lazy()` が外せているのは `NotesView` + `AnalyticsScreen` + `ConnectScreen` の **198,190 B = 全 JS の 8.8%** だけ
- **原因 (a)**: TipTap の `editor` chunk（356,778 B / gzip 111,087 B）が `modulepreload` されている。`web/src/briefing/BriefingScreen.tsx:22` / `web/src/daily/DailyView.tsx:43` / `web/src/tasks/KanbanView.tsx:69` が `RichTextEditor` を静的 import しているため、`NotesView` を lazy にしても TipTap は初回に落ちてくる
- **原因 (b)**: recharts（245,262 B / gzip 62,975 B）が eager な `index` chunk の中にいる。`shared/src/components/briefing/BriefingView.tsx:17-24` が `Analytics/TaskCompletionTrend` と `Analytics/WorkBreakBalance` を値として import → `shared/src/components/Analytics/WorkBreakBalance.tsx:2-11` が recharts。本番 chunk の marker grep で確認済み（`recharts-wrapper` が `index` に有り、`AnalyticsScreen` chunk に無し）
- **修正の効き（一時パッチで実測・破棄済み）**: **案 A = 4 ファイルだけ**（`RichTextEditor` を `lazy()` 越しにして 3 画面の静的 import を外す + `BriefingView` のグラフ 3 枚を `lazy()`。**画面は 1 つも lazy にしない**）+ `manualChunks` 撤去で **1,299,667 B / gzip 349,361 B = −39.4%**。さらに 6 画面 lazy まで踏み込む案 B で **999,713 B / gzip 275,373 B = −52.2%**
- **⚠️ 順序の注意**: `manualChunks` 撤去は**単体では +0.1% で無意味**。逆に案 A だけ入れて `manualChunks` を残すと −19.2% で止まります（recharts と ProseMirror は `index` chunk から消えるのに、`editor` chunk が `modulepreload` に居座るため）。**2 つはセットで**
- **おすすめ**: まず案 A。差の 12.8 ポイントを取りに行くかは別判断でよく、案 B は着地セクションが Suspense の待ち表示から始まる体感トレードオフも付いてきます

**2. [perf] 長いリストの仮想化と、行あたり dnd 登録の削減**（`area:performance` / `shared-fix`）

- 仮想化ライブラリは `shared/package.json` / `web/package.json` の**どちらにも無く**、行数の上限も無い。アイテム数 N に対して DOM 行 N 個をそのまま描く
- 行ごとに @dnd-kit の hook が付く: `web/src/notes/NoteListRows.tsx:48`（`useDraggable`）/ `:158`（`useDroppable`）/ `web/src/tasks/KanbanCardDraggable.tsx:28`（`useSortable`）
- **ノート行はタグ数だけ重複描画される**（`NoteListRows.tsx:46-47` のコメントが明言）。描画行数は「ノート数 × 平均タグ数」
- **実データでの行数・FPS は未計測**なので、着手前に 4 の実ブラウザ計測を待つのが安全です

**3. [perf] 消費者のいない `timer_sessions` 購読を外す**（`area:performance` / `shared-fix`）

- `shared/src/context/SyncContext.tsx:69-95` が `timer_sessions` を購読しているが、変更を読む consumer が無い（`:61-65` のコメント自身が "currently have no consumer" と認めている）
- 一方で書き込みは多い（`shared/src/context/TimerContext.tsx:133-155` が start / pause / reset / phase 終了ごとに 1 行）。Realtime のエコーで `timer` ドメインが bump し、`TimerContext.tsx:88-123` の `fetchTimerSettings` + `fetchPomodoroPresets` が再実行される。**設定は変わっていないのに REST 2 本**
- **1 ポモドーロあたりの実 REST 回数は未計測**（Network パネルが要る）

**4. [measure] chat-main による実ブラウザ計測**（`area:performance`）

このレーンは playwright / dev server を使えないため（CLAUDE.md §7.4）、**次の 6 項目が 未計測のまま**です。的は絞れているので、chat-main 側でお願いします: (1) 再レンダリング回数・コミット時間（React DevTools Profiler）、(2) 1 ポモドーロあたりの実 REST 回数、(3) 実データでの行数 / DOM ノード数 / スクロール FPS、(4) `Analytics/WorkTimeHeatmap.tsx:148` の追従ツールチップの合成コスト、(5) throttling 下の LCP / TTI とパース時間、(6) lucide-react（gzip 126 KB = 単独最大）の eager / lazy 内訳。

**なお §2 で挙げた「Provider 鎖の上位が更新されて全体が再描画される」仮説は、静的には裏付けが取れませんでした**（17 Provider すべて `useMemo` 済み・Sync は外部ストア化済み・Timer の 1 秒 tick は `children` を再描画しない）。実測で覆る可能性は残しますが、優先度は下げてよさそうです。

## 2026-08-13 → @chat-main（Epic #716「裁定済み・実装の着地が未確認」3 件の実測結果）

**3 件とも現状のコードで満たされています。未達ゼロなので、起票依頼はありません。** 台帳の `implemented-by` を埋める PR = **#803（open）**。コードは 1 行も触っていません。

- `D-20260730-mobile-1` = A（3 択タッチ行を維持）→ **#494**。`shared/src/components/TaskStatusChoices.tsx:41-72` が `web/src/tasks/KanbanView.tsx:736-746` 経由で Mobile の詳細シートにだけ入っている
- `D-20260730-mobile-2` = B（`BottomSheet` に閉じるボタン）→ **#539**。`shared/src/components/BottomSheet.tsx:115-128` に無条件で常設・`closeLabel` は必須 prop（`:19`）
- `D-20260730-mobile-3` = B（本文だけロック）→ **#541**。`LockedBodyGate` を `web/src/notes/NoteDetailSurface.tsx:78-86` が `contentEditor` だけに適用し、両幅が同じ `password.isGated(...)` を読む

**お願い**: #803 を merge したら、Epic #716 の「裁定済み・実装の着地が未確認」3 つのチェックボックスを消化してください（DoD の「裁定 3 件が実装で満たされている（または満たされていることを確認した記録が残っている）」も同時に満たされます）。

**参考（本件のスコープ外）**: 同じ mobile 系で `D-20260810-mobile-1` / `-2`（どちらも A）は `implemented-by` が空のままです。中身は `mobile-scope.md` の #1 / #4 / #9 の目標列を実態に合わせる docs 追随なので、こちらのレーンで拾えます。指示をもらえれば動きます。

**起票依頼 1 件（hook のバグ）**: `pre-commit-tracker-guard.sh:31` の `TRACKER_RE` が `\.claude/(memory|history)/chat-[^/]*\.md$` で、間にディレクトリを挟む形を拾えません。task-tracker の END は履歴が 5 件を超えると `.claude/history/archive/YYYY-MM/chat-<self>.md` へローリングアーカイブしますが、このパスが「tracker 以外」と判定されるため、**アーカイブを伴う tracker commit が毎回ブロックされます**（今回 `[tracker-ok]` で通しました）。`archive/` 配下も tracker として扱うよう正規表現を広げれば直ります。逃がし道が常用されると、本来止めたい「実装との同梱」を見逃す方向に効くので、直しておく価値があります。

## 2026-08-12 → @chat-main（#691 / #692 完了報告・実ブラウザ確認の依頼 + 起票依頼 1 件）

> 追記（2026-08-13）: **PR #750 / #758 はどちらも merged 済み**です。下の実ブラウザ確認の依頼はそのまま生きています。

**#691（Mobile の Dayflow）= PR #750 / #692（Mobile の月ビュー）= PR #758**。どちらも `origin/main` から独立に切ってあります（stacked ではありません）。

- **起票依頼（`D-20260812-mobile-1` が A に決まったら）**: 「Mobile の Dayflow で Todo 行を完了・詳細まで触れるようにする」。#691 Step 1 実測の 5 点のうち **5 だけ未実装**で残しました。実装が `TaskDetailPanel` の Mobile 配線（= schedule-refine の担当ファイル）に出るため、P-008 でキューへ回しています。Kanban 側の `MobileTaskList` に前例があるので、レーンの割り当てだけ決めてもらえれば動けます
- **実ブラウザ確認のお願い**（両 PR の merge 後・このレーンは playwright を使えません = CLAUDE.md §7.4）:
  - #691: 3 時間の予定と 1 時間の予定を並べた日で、長いほうの行が目に見えて高いこと / 各行が `開始 / 終了` の 2 行になっていること / 間の空きに「空き ◯分」が出ること。進行中の予定があるとき、現在線がその行の**上**にあること。予定 0 件の日でも現在線が出ること
  - #692: ヘッダの日付をタップして月シートが開くこと / シート内の前後ボタンが**月単位**で動き、セルが空にならないこと / セルタップでその日のリストに戻ること
- **merge 順の注意**: 2 本とも `mobile-scope.md` の #4 行（1 行）と `CalendarTab.tsx` の narrow 分岐を触ります。コードのハンクは 35 行ほど離れていますが、**docs の 1 行は後から merge するほうで手動マージが要ります**。どちらも squash merge 前提です

## 2026-08-10 (2) → @chat-main（#632 の残件・実ブラウザ確認の依頼 + 起票依頼 1 件）

**#632（FAB の位置統一）は PR #660 で出しましたが、Notes 側だけ「貼り付き」が未達**です。判断待ち = `D-20260810-mobile-3`。

- **原因**: Materials は full-bleed でないため `PageContainer` の `width="wide"` で描画され（`MainScreen.tsx:220-222`）、この分岐はページ側がスクローラでその中身は高さ auto（`PageContainer.tsx:70-76`）。FAB の基準になる `NotesView.tsx:387` の `relative` ルートが auto に落ちるので、FAB はセクションの箱ではなく**リストの末尾**に付く。Schedule は `width="fluid"`（高さ確定・余白なし）なので本当に貼り付いている
- **直すには** `ownsFullBleed` に narrow の materials を足す必要があり、これは `MainScreen.tsx` = #632 のスコープ外で、**Daily のスクロール所有権も動きます**。実ブラウザ無しに安全と言えないので実装せずキューへ回しました（P-008）
- **起票依頼**: `D-20260810-mobile-3` が A（fluid へ移す）に決まったら、「narrow の Materials を fluid 変種にする」Issue をお願いします。Notes / Daily 両方のモバイル実機確認が DoD に要ります
- **実ブラウザ確認のお願い**（PR #660 merge 後）: (1) Schedule で 1 画面を超えるリストをスクロールしても「+」が動かないこと、(2) Notes は現状どおり末尾に付いてくること（残件の裏取り）。このレーンは playwright を使えないので（CLAUDE.md §7.4）、どちらも chat-main 側でお願いします
- **補足（この push の経緯）**: 上の 2 件はいったん `claude/mobile-589-scope-audit` に push しましたが、**PR #651 が squash merge された後**だったため main に届いていませんでした。#660 のブランチで入れ直しています

## 2026-08-10 → @chat-main（#589 完了報告・Epic #321 の close 依頼 + ハンドオフ 2 件）

**#589（mobile-scope 現状維持 9 行のコード実測）が終わりました。** 9 行のうち **6 行（#8 / #10 / #12 / #13 / #14 / #15）は表どおり**、**3 行（#1 / #4 / #9）がズレ**ていて、うち #9 は構造ごと入れ替わっていました。詳細は #589 のコメントと `mobile-scope.md` の差分を見てください。

- **Epic #321 の close 判断をお願いします**: 最後の未チェック行「現状維持 9 行の確認」は今回のコード実測で埋まりましたが、**狭幅の実機目視は未実施**（このレーンは Read / grep まで — CLAUDE.md §7.4）。実機パスまで含めて close するか、コード実測をもって close するかは chat-main / こうだいさんの判断です。チェックボックスには「コード実測 = #589 で完了 / 実機は未」と注記だけ入れました
- **@chat-schedule-refine へのハンドオフ 2 件**（どちらも `web/src/schedule/**` = そちらの担当。**判断キューの回答待ちなので、今は着手不要**です）:
  1. **タグの色がモバイルから書き換えられる**（`CalendarTab.tsx:1540` の `TagColorControls` が narrow では `:2262` の BottomSheet に載る）。スコープ表 #9 の目標「閲覧 + 名前のみ追加」超過。判断 = `D-20260810-mobile-1`（A: 目標語を色まで広げる / B: narrow で隠す）
  2. **narrow の予定が「閲覧のみ」になっていない**（行タップで `EventEditorPane` の編集シートが開く）。#467 の退行ではなく #168 以来の状態。判断 = `D-20260810-mobile-2`（A: 目標語を実態へ / B: 実装を絞る）
- **起票依頼（判断が付いてからで可）**: briefing の完了トグル（`BriefingView.tsx:330,384,461`）と夕刊の気分★（`EveningView.tsx:195`）に**対応する行がスコープ表に無い**。`D-20260810-mobile-2` が A に決まったら「行を足す」、B なら「実装を絞る」に分岐するので、回答後に起票内容が決まります
- **参考（今回直したもの）**: §3 前提の行番号 3 箇所（`AppShell.tsx:115` → `:147/:153` 等）、「tasks は materials 配下」→ #411 で Schedule の 2 つ目のタブへ、#11 の `WorkScreen.tsx:41,362` → `:42/:368`、§6 に「native 省略ガードは Capacitor 殻でしか発火しない（主導線の公開 Web URL では幅分岐が効いている）」の補足

## 2026-07-30 (3) → @chat-main（merge 後の実機確認 + 起票依頼の候補 2 件）

#470（PR #494 merged）のアドバーサリアル QA で挙がった、**この機械では検証不能な 2 件**です。実機（iOS / Android）を持つ chat-main 側で確認をお願いします。どちらも「壊れている」と確定はしていません。

1. **背の高いシート + ソフトキーボード（要実機）**: 詳細シートの高さは `max-h-[92vh] / min-h-[70vh]`（`web/src/tasks/MobileTaskList.tsx`）で、`vh` は**レイアウトビューポート基準**のためキーボード表示で縮みません。タイトル欄や本文を編集するとカーソルがキーボードの裏に回る可能性があります。同じ形はノートの読み取りシート（`NotesView.tsx`）にも既にありますが、**編集できる背の高いシートは #470 が初**なので露出はここからです。直すなら `dvh` か `visualViewport` 連動ですが、iOS はキーボードで `dvh` も縮まないので**実測してから**決めたい（憶測で入れ替えたくない）。#471（mobile notes フル編集）でも同じ問題に当たるので、実機所見があればそちらで一緒に対処します
2. **`BottomSheet` にフォーカストラップ・初期フォーカスが無い（起票候補）**: `aria-modal="true"` を宣言しているのにフォーカスは背後のカードに残ります。従来のシートは中に autofocus 要素があったため露出せず、**#470 の詳細シートが「中に autofocus が無い最初の BottomSheet」**です。共有部品を全利用箇所ぶん変える話なので #470 のスコープ外にしました。キーボード操作・スクリーンリーダー利用時の話なので優先度は低めです

## 2026-07-30 (2) → @chat-main（起票依頼）

**タスク本文の `[[リンク]]` が両幅で死んでいます。**#470（mobile tasks 詳細編集）でタスク本文のエディタをモバイルにも出したときに気付いた、**Desktop から続く既存の欠落**です（#470 では Desktop と同じ配線に揃えるだけに留め、直していません）。

- **実測**: Notes / Daily は `loadLinkTargets` と `onNavigateToItem` の両方を `RichTextEditor` へ渡す（`web/src/notes/NotesView.tsx:724-729` / `web/src/daily/DailyView.tsx:560-561, 643-644`）。タスク詳細のエディタは**どちらも渡していない**（`web/src/tasks/KanbanView.tsx` の `renderTaskDetail` 内 `contentEditor`）
- **症状**: タスク本文では (1) `[[` を打っても候補が出ない（リンクを作れない）、(2) 他所から貼られた・過去に入っていた解決済みリンクをクリックしても遷移しない（#475 で直したのは Notes / Daily 側の経路で、渡し忘れは別問題）
- **範囲**: wide / narrow 共通。#470 は「Desktop と同じ panel を Mobile にも出す」スコープなので、配線追加は別 Issue が筋だと判断しました
- **想定コスト**: 小。`useItemLinkTargets(dataService)` と `onNavigateToItem` を KanbanView まで通すだけ（`MainScreen` から Tasks へ navigate コールバックを渡す配線が要るかは未確認 — `pendingSelectTaskId` の逆方向が既にあるので近くに置けるはず）
