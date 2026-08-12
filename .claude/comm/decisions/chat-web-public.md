# Decision Queue — chat-web-public

### D-20260812-web-1: Briefing が抱える recharts も初期チャンクから外すか

- 背景: #676 (a) で Analytics / Connect を lazy 化しても、recharts は初期チャンクに残る。`shared/src/components/briefing/BriefingView.tsx:13-24` が `Analytics/StreakDisplay` `Analytics/TaskCompletionTrend` `Analytics/WorkBreakBalance` を静的 import しているため。Briefing は既定の着地セクション（`useStartupSection`）なので、初期表示に本当に要る分でもある
- A: 現状維持（推奨 — 既定の着地セクションが使う以上、lazy にしても初回リクエストが 1 本増えるだけで実利が薄い。(a) の DoD「有意に減っている」は 1585 → 1423 KB で達成済み）
- B: Briefing の 3 チャートも lazy 化する別 Issue を立てる（初期チャンクからさらに ~400 KB 抜ける見込みだが、着地画面に Suspense 境界が増え、体感は要実測）
- 放置時: A（現状維持）。このまま #676 (a) の PR を出し、以降の (b)-(d) に進む
- 期限感: いつでも（#676 (a) の merge をブロックしない）
