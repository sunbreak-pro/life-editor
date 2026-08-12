# Decision Queue — chat-web-public

### D-20260812-web-1: Briefing が抱える recharts も初期チャンクから外すか

- 背景: #676 (a) で Analytics / Connect を lazy 化しても、recharts は初期チャンクに残る。`shared/src/components/briefing/BriefingView.tsx:13-24` が `Analytics/StreakDisplay` `Analytics/TaskCompletionTrend` `Analytics/WorkBreakBalance` を静的 import しているため。Briefing は既定の着地セクション（`useStartupSection`）なので、初期表示に本当に要る分でもある
- A: 現状維持（推奨 — 既定の着地セクションが使う以上、lazy にしても初回リクエストが 1 本増えるだけで実利が薄い。(a) の DoD「有意に減っている」は 1585 → 1423 KB で達成済み）
- B: Briefing の 3 チャートも lazy 化する別 Issue を立てる（初期チャンクからさらに ~400 KB 抜ける見込みだが、着地画面に Suspense 境界が増え、体感は要実測）
- 放置時: A（現状維持）。このまま #676 (a) の PR を出し、以降の (b)-(d) に進む
- 期限感: いつでも（#676 (a) の merge をブロックしない）

### D-20260812-web-2: TimerContext を本当に 2 つの Context に割るか（WorkScreen 側の改修とセット）

- 背景: #676 (d)。`shared/src/context/TimerContext.tsx:396` の value は 26 フィールドで、1 秒ごとに作り直される。今回は**同一 value のまま 2 つの memo（`live` / `controls`）に割る**ところまでやった（deps が 26 → 8 + 18 に分かれ、どちらに足すかが読めば分かる）。ただし **Context を 2 本に分けても現状は誰も得しない** — 消費者は `NavTimerStatus` と `WorkScreen` の 2 つだけで、どちらもカウントダウンを表示するので毎秒の再描画が必要
- A: 現状維持（推奨 — memo 分割で保守上の危険（長大な deps 配列）は消えた。Context を割る実利は WorkScreen 側を `memo()` 込みで組み替えて初めて出る）
- B: `useTimerTick()` / `useTimerControls()` に分け、`WorkScreen` の設定パネル・プリセット一覧を `memo()` 化する別 Issue を立てる（Work 画面の毎秒の再描画量は減るが、画面の構造改修になるので #676 のスコープ外。Work 画面を触っている別レーンとの衝突も要確認）
- 放置時: A。#676 (d) は memo 分割 + Sync の外部ストア化で閉じる
- 期限感: いつでも（#676 の PR を止めない）
