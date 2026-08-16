# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

## D-20260816-shared-fix-6: #993 の `timer_sessions` 購読をどう外すか（lockstep 不変式に触らずには外せない）

- 背景: #993 は「Scope = `SyncContext.tsx`（購読の削除）」と書いてあるが、**購読リストには機械の見張りが 2 本かかっていて、リストから 1 行消すだけでは通らない**。
  - `shared/tests/syncRealtimeTables.test.ts` = `REALTIME_TABLES` と DB 側 publication（migration 0017 + 0018 の `array[...]`）の**完全一致**を要求（さらに「ちょうど 20 テーブル」の数え上げも持つ）
  - `shared/tests/syncDomains.test.ts` = `REALTIME_TABLES` の全テーブルが `TABLE_DOMAIN` に載っていることを要求（ドメイン無しのテーブルは「無言で再取得が止まる」ため）
  - つまり「購読を消す」「ドメイン割当だけ外す」のどちらも見張りに当たる。`SyncContext.tsx` のコメント自身も「将来 publication から落とす手はある」と publication 側の変更を前提に書いている
- A: **DDL で publication から落とす**（`timer_sessions` を `supabase_realtime` から drop する migration をローカル追加 → `REALTIME_TABLES` と `TABLE_DOMAIN` から削除 → lockstep テストの migration パーサと 20 の数え上げを更新）。コメントが想定していた筋のとおり。ただし **🛑 `supabase db push` がユーザー手番**で、共通ゲートの「DDL ゼロ」からも外れる
- B: **DDL ゼロ。publication は残し、`TABLE_DOMAIN` から `timer_sessions` を外して「購読はするがドメインを動かさない」明示的な例外リストを作る**（`syncDomains.test.ts` の不変式を「完全一致」から「宣言済みの例外を許す」に変える）。REST 2 本の無駄打ちという実害はこれで消える。WebSocket のメッセージは届き続ける（安い）
- 放置時: 現状維持（#993 は着手しない）。実害は「ポモドーロの操作ごとに `timer_settings` / `pomodoro_presets` を取り直す REST 2 本」で、動作は壊れていない
- 期限感: いつでも。#993 を着手可能にしたいときに回答が要る

（未決はこの 1 件）

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
