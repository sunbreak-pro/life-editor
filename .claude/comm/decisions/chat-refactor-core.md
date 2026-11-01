# Decision Queue — chat-refactor-core

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

### D-20261101-refactor-1: PR #2424（#2335）を計画全体の ±500 行を超えたまま 1 本で通すか

- 背景: 計画書 `2026-10-21-offline-cache.md` の Acceptance は「1 Issue あたり ±500 行以内」。実測は +3131 / −63（テストと `.md` を除くと +1292 / −61）。Issue の DoD には入っていない。#2334 の未着地も PR 本文に書いてある
- A: 1 本のまま通す（推奨 — 箱・包む層・送信役は揃って初めて動くため、分けても途中の PR は確かめられない。差分の約 6 割はテスト）
- B: 箱と冪等な作成、包む層と送信役、バナーとサインアウトの 3 本に分ける
- 放置時: PR #2424 を merge しない。#2336 / #2337 も止まったまま
- 期限感: merge 前まで

### D-20261101-refactor-2: 予定の作成パネルで、圏外で足した Todo に選んだタグが消える件をどう直すか

- 背景: `web/src/schedule/useScheduleCreateFlow.ts:328-333`。Todo は箱に積まれるが、`onSaved(null)` の枝はノートにしか通知しない。`web/src/schedule/**` は計画の Scope の外なので PR #2424 では直していない
- A: 別の Issue で通知だけ足す（推奨 — 十数行で済み、Todo 本体は失われない）
- B: 選んだタグを持ち続け、送信のあとに付ける（送信待ちの箱に Todo 以外の書き込みが要る）
- 放置時: 圏外で足すときだけ穴が残る。Todo は保存される
- 期限感: いつでも

（2026-08-12 昇格分 = D-20260812-refactor-1 / D-20260812-refactor-2 / D-20260811-refactor-1 / D-20260811-refactor-2・2026-08-19 昇格分 = D-20260818-refactor-1（回答 = A-1・実装 Issue #1101）— いずれも `.claude/decisions/` 台帳へ。D-20260812-refactor-1 と D-20260811-refactor-1 / -2、および 2026-08-19 分の昇格は chat-main が代行した）
