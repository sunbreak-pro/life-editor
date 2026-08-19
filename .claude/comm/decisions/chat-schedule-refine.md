# Decision Queue — chat-schedule-refine

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260818-sched-1: #997 Undo は「変換で破棄したフィールド」まで戻すか

- 背景: #625 の変換は role を移すだけで、逆変換だけでは戻らない列がある。どちらの方向も新しい payload を古い行から組み立てて**自分を完全に指定した行を UPSERT する**ので、組み立て側が触れていない列は NULL / false で返る（Todo→Event で落ちるのは parentId / priority / color / icon / timeMemo / workDurationMinutes / reminderEnabled / reminderOffset / isExpanded / NULL status、Event→Todo で落ちるのは isDismissed）
- A: **スナップショットから全部戻す**（推奨 — Undo は「変換前の状態に戻す」。このスタックの他のコマンドは全部スナップショット丸ごとを再生する）
- B: 逆変換だけ（role・タイトル・メモ・完了・日時のみ）。破棄は破棄のまま = D-20260810-sched-3 の裁定を Undo にも適用
- 放置時: **PR #1092 は A で実装済み**（安全側 = 情報を失わない）。B なら差分を**削る**方向の追加 PR になるので、逆より安い
- 期限感: #1092 の merge 前まで

### D-20260818-sched-2: #1033 narrow の Schedule→Todo タブで、ハンバーガーが空のドロワーを開く件

- 背景: #1033（PR #1081・merge 済み）で descriptor を `tabs+hamburger` にした結果、ハンバーガーが **narrow の schedule 2 タブ両方**に出る。Calendar タブはドロワーを埋めるが、**Todo タブは埋めない**（`KanbanView` が `RightSidebarPortal` を `isWide` で囲っている。#470 が narrow の Todo 詳細をボトムシートへ回したため）。押すと `detailPanel.empty`「表示する詳細はありません」が出る。他の narrow セクション（Notes / Daily / Connect / Work / Settings）は全部どちらの幅でもドロワーを埋めるので、ここだけが空になる
- A: **このまま受け入れる**（推奨 — 差分ゼロ。ハンバーガーはセクションのクロームという設計 SSOT の扱い（IA.md）と一致し、タブを切り替えれば中身が入る）
- B: `narrowHeader` をタブごとに解決できるようにする（`NarrowHeader | ((nav) => NarrowHeader)`・約 6 行）。Issue が求めていない新しい仕組みで、見た目の端の話に機構を 1 枚足すことになる
- 放置時: A（現状維持）。#1081 は既に merge 済みなので、B を採るなら追加 PR
- 期限感: いつでも

### D-20260818-sched-3: #1000「カレンダー上の Todo チップ」が指しているのは日リストの行か、月グリッドのドットか

- 背景: #1000 が求める narrow の Todo 詳細シートは**既に存在する**（#761 が #626 の上に着地済み）。ただし **narrow のカレンダーに Todo「チップ」は無い** — #878 以降、狭幅の月グリッドは `size-1.5`（6px）の非対話な `<span>` のドットを描くだけで、タップできる Todo 行はその下の日リストにある
- A: **日リストの行のこと**（推奨 — PR #1095 がその経路をテストで固定済み。#1000 は #761 で解決済みとして close）
- B: 月グリッドのドットのこと → 別の仕事。6px は `TAP_TARGET` の 44px 下限に対して桁違いに小さく、ドット行の下には全セルの日付選択ボタンがあるので stopPropagation も要る。さらに **Desktop も描くコンポーネント**なので「Desktop 不変」が無料でなくなる
- 放置時: A（#1095 を merge して #1000 を close）。実機で 1 点だけ見てほしい = **月グリッドの下の日リストにある Todo 行**をタップしてシートが開くか（グリッド内の色付きドットではなく）
- 期限感: #1095 の merge 前まで

（回答済みは `.claude/decisions/` 台帳へ昇格済み — D-20260801-sched-1（2026-08-09・chat-main 代行）/ D-20260810-sched-1〜5（2026-08-10・チャット回答を受けて当チャットが昇格）/ 2026-08-12 昇格分 = D-20260730-sched-1 / D-20260731-sched-2 / D-20260731-sched-3 / D-20260801-sched-2 / D-20260802-sched-1 / D-20260811-sched-1 / D-20260811-sched-2 / D-20260812-sched-1 / 2026-08-13 昇格分 = D-20260812-sched-2 / 2026-08-16 昇格分 = D-20260816-sched-1 / D-20260816-sched-2 / D-20260816-sched-3）
