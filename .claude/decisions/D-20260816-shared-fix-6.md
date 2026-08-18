---
id: D-20260816-shared-fix-6
type: decision
status: answered
asked: 2026-08-16
answered: 2026-08-18
chat: chat-shared-fix
answer: C
topics: [sync, realtime, performance, timer, briefing]
refs:
  [
    "#993",
    "shared/src/context/syncDomains.ts",
    "shared/src/context/SyncContext.tsx",
    "web/src/briefing/hooks/useBriefingFetch.ts",
    "#499",
  ]
supersedes: []
superseded-by: []
implemented-by: ["#1078"]
promoted-to: null
---

# D-20260816-shared-fix-6: #993 の `timer_sessions` 購読をどう外すか

## 背景

（キュー本文 = `comm/decisions/chat-shared-fix.md` に 2026-08-16 提出。以下はその本文に、回答時点で判明した前提の崩れを追記したもの）

#993 は「Scope = `SyncContext.tsx`（購読の削除）」と書いてあるが、**購読リストには機械の見張りが 2 本かかっていて、リストから 1 行消すだけでは通らない**。

- `shared/tests/syncRealtimeTables.test.ts` = `REALTIME_TABLES` と DB 側 publication（migration 0017 + 0018 の `array[...]`）の**完全一致**を要求（さらに「ちょうど 20 テーブル」の数え上げも持つ）
- `shared/tests/syncDomains.test.ts` = `REALTIME_TABLES` の全テーブルが `TABLE_DOMAIN` に載っていることを要求（ドメイン無しのテーブルは「無言で再取得が止まる」ため）

つまり「購読を消す」「ドメイン割当だけ外す」のどちらも見張りに当たる。`SyncContext.tsx` のコメント自身も「将来 publication から落とす手はある」と publication 側の変更を前提に書いている。

### ⚠️ 回答前に前提が崩れた（2026-08-18 実測）

**Issue #993 の「変更を読む consumer が無い」は事実ではない。** `web/src/briefing/hooks/useBriefingFetch.ts:68-75` が `"timer"` ドメインを宣言し `:98` で `ds.fetchTimerSessions()` を呼んでいる（`web/tests/briefingDataFetch.test.tsx:88-107` が pin 済み）。

しかもこれは後から生えたものではなく、**ドメイン分割そのものを入れた #499 / PR #501（2026-07-31）の時点から**存在した。`SyncContext.tsx` の "currently have no consumer" コメントは、その 6 週間前（#70 / W3-B、commit d99cef5c）に書かれたまま更新されなかった残骸で、**#499 が出荷された時点で既に嘘になっていた**。

したがって**キューに出した A と B は両方とも、Briefing の streak / work-break ウィジェットの live 更新を黙って止める**。実質の分岐は A と、この時点で新たに浮上した C の二択になった。

## 選択肢と裁定

### A（却下）— DDL で publication から落とす

`supabase/migrations/0024_drop_timer_sessions_realtime.sql` を追加し、`REALTIME_TABLES` と `TABLE_DOMAIN` から削除、lockstep テストに drop 用パーサを足してハードカウントを 20 → 19 に更新する。`SyncContext.tsx` のコメントが想定していた筋そのもの。

却下理由は 3 つ。(1) 🛑 `supabase db push` がこうだいさん手番になる。(2) lockstep テストはファイルしか見ないので **CI が緑でも DB に当たった証拠にならない**。(3) 上記のとおり Briefing の live 更新が止まる。

### B（却下）— DDL ゼロ・ドメイン無しの例外リスト

publication は残し、`TABLE_DOMAIN` から `timer_sessions` を外して「購読はするがドメインを動かさない」明示的な例外リストを作る（`syncDomains.test.ts` の不変式を「完全一致」から「宣言済みの例外を許す」へ緩める）。

**C の下位互換**と判明したため却下。同じ DDL ゼロなのに、Briefing を壊したうえ lockstep の不変式まで緩める。

### C（採用）— ドメインを分ける

`SYNC_DOMAINS` に `"sessions"` を追加し `timer_sessions` だけそこへ移す。TimerProvider は `useSyncDomains("timer")` のままなので設定 2 本の再取得が止まり、Briefing は `"timer"` → `"sessions"` に付け替えて live 更新を維持する。

**migration 不要 / 購読リスト不変 / `syncRealtimeTables.test.ts` 無改修 / `syncDomains.test.ts` の不変式も緩めない。** ユーザーゲート 0・DDL 0・既知の機能後退 0 で、#993 の実害（ポモドーロ操作ごとの REST 2 本）だけを消せる唯一の案。

効き方: Work 画面での 1 操作あたり REST 2 本 → 0 本（TimerProvider は常時マウント）。Briefing を開いている間の再取得は残るが、それは streak 更新に必要な正しい挙動。

## 波及

- 実装 = PR #1078（merged）。`shared/src/context/syncDomains.ts` / `SyncContext.tsx` / `web/src/briefing/hooks/useBriefingFetch.ts` + テスト 3 本
- **この修正の実挙動を pin するテストがリポジトリに 1 つも無かった**ため、`shared/tests/syncDomainWiring.test.tsx` に TimerProvider の describe を新設した（既存の 13 スタブは `uniformDomainVersions` = 全ドメイン一斉 bump なので、どちらに転んでも緑のままだった）
- `.claude/rules/frontend.md:28` がドメイン名 8 個を逐語で並べていたため、数値の非複製原則（CLAUDE.md §0）に沿って「一覧は `SYNC_DOMAINS` が正」の参照へ置換した。docs-lint はこの種の陳腐化を検出しない
- **DoD の実測は chat-main 手番**: ポモドーロ 1 周で `timer_settings` / `pomodoro_presets` が 0 本、**かつ** Briefing でセッション終了時に streak / work-break が更新されること（後者は Issue の DoD が抜かしている裏返しの検証で、今回唯一の回帰リスク）
