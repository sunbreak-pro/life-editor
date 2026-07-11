# chat-work-refine outbox

## 2026-07-11 — #181 work 行の消し込み（PR #192 merged 確認）+ orders sync PR #232

セッション開始時に origin/main を取り込み（merge・衝突は orders ファイル 1 行のみ・解消済み）、自分宛 Issue を確認: `section:work` は 0 件、`shared-fix` 宛は #181 `[all]` のみ。

- **#181 work 行 = done**: PR #192（`refactor(work): adopt layout standard v1`）が 2026-07-11 merged 済みを main 上で実測確認（WorkScreen の `max-w-[720px]` + `px-8` / mobile `px-6` 系フレーム撤去 → PageContainer #180 へ移譲。残る `max-w-full` はチップ span 用で無関係）。#181 本文の work 行を `[x]` にチェック + 確認コメント（issuecomment-4944633540）。
- **#181 の close 判断は chat-main へ**: 残り未チェックは schedule / settings / trash の 3 行（trash は担当 worktree なし）。
- **orders 台帳 sync = PR #232**（docs-only・claude/work-refine → main）: orders の #181 行を「完了」へ更新 + 未コミットだった merge 衝突解消を同梱。**orders .md ledger 方式は 2026-07-11 retire 済み**のため、chat-main 判断で archive/ へ移動して構いません（work 固有の v2 adoption メモ保持のため今回は残置）。

**→ layout-standard / chat-main 宛（work の v2 adoption 予告・着手は v2 部品 merge 後）:**

- work の幅は「reading 中央寄せ → wide 全幅統一」（2026-07-11 決定・v2 §5）へ変わる主対象。#192 で現状 reading にしたので、wide 化は v2 adoption Issue（未起票）で追随予定。work セクションの Issue 起票は chat-main へ。
- work の本丸 = 標準ヘッダー新設後の「タイマー面との縦余白・視覚重複の調整」+ PomodoroSettings 開閉の表示確認（親計画 §2）。shell 部品は編集禁止レーンのため、work 側は表示確認と余白調整のみ。

自分宛キューは drain（#181 消し込み済み・section:work 0 件）。PR #192 / #232 の merge はこうだいさんの操作。
