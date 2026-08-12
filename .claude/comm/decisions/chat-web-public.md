# Decision Queue — chat-web-public

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20260812-web-2: TimerContext を本当に 2 つの Context に割るか（WorkScreen 側の改修とセット）

- 背景: #676 (d)。`shared/src/context/TimerContext.tsx:396` の value は 26 フィールドで、1 秒ごとに作り直される。今回は**同一 value のまま 2 つの memo（`live` / `controls`）に割る**ところまでやった（deps が 26 → 8 + 18 に分かれ、どちらに足すかが読めば分かる）。ただし **Context を 2 本に分けても現状は誰も得しない** — 消費者は `NavTimerStatus` と `WorkScreen` の 2 つだけで、どちらもカウントダウンを表示するので毎秒の再描画が必要
- A: 現状維持（推奨 — memo 分割で保守上の危険（長大な deps 配列）は消えた。Context を割る実利は WorkScreen 側を `memo()` 込みで組み替えて初めて出る）
- B: `useTimerTick()` / `useTimerControls()` に分け、`WorkScreen` の設定パネル・プリセット一覧を `memo()` 化する別 Issue を立てる（Work 画面の毎秒の再描画量は減るが、画面の構造改修になるので #676 のスコープ外。Work 画面を触っている別レーンとの衝突も要確認）
- 放置時: A。#676 (d) は memo 分割 + Sync の外部ストア化で閉じる
- 期限感: いつでも（#676 の PR を止めない）

（2026-08-12 昇格分 = D-20260812-web-1 — `.claude/decisions/` 台帳へ）
