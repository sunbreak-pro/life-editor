# Decision Queue — chat-shared-fix

形式は [`README.md`](./README.md) 参照。回答は `ANSWERS.md` へ。

（2026-08-12 昇格分 = D-20260812-shared-fix-1 / D-20260812-shared-fix-2 — `.claude/decisions/` 台帳へ）
（2026-08-16 昇格分 = D-20260815-shared-fix-1 / D-20260816-shared-fix-1〜5 — 同上）
（2026-08-18 昇格分 = D-20260816-shared-fix-6（回答 = C・実装 = PR #1078 merged）— 同上）
（2026-08-19 昇格分 = D-20260818-shared-fix-1（回答 = A = rAF スロットル・実装 Issue #1103）— 同上。質問 / 転記 / 昇格は chat-main が代行した）
（2026-08-26 昇格分 = D-20260824-shared-fix-1（回答 = A = 日曜に揃える・実装 Issue #1138）— 同上。質問 / 転記 / 昇格は chat-main が代行した）

### D-20260827-shared-fix-1: ツアーの進捗を localStorage のままにするか、DataService のドメインを 1 つ増やすか

- 背景: #1122（PR は #1154）。Issue 本文は「進捗を DataService 経由で永続化」と書いているが、`shared/src/services/DataService.ts:651-664` の `DataService` は 12 個のドメイン別インターフェースの合成で、汎用の key-value / 設定テーブルが無い。テーマ・フォント・reduce motion・言語・ショートカット・起動セクション等、同種の軽量設定はすべて `useLocalStorage`（`life-editor-` 名前空間・§216）に載っている。実装は `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じてあり、差し替え先はここだけ。
- A: **localStorage のまま**（推奨 — 他の軽量設定と同じ置き場で、追加コストゼロ。ツアーの到達位置は端末ローカルで十分という判断）
- B: `tour_progress` テーブル + DataService ドメインを新設（Issue の文面どおり。migration 1 本 + `SupabaseTourService` + routing tuple + `SYNC_DOMAINS` 行が要り、最後に**こうだいさんの `supabase db push`**（🛑 人手ゲート・CLAUDE.md §7.3）まで行かないと動かない）
- 放置時: A のまま（PR #1154 は A で出してある）。B を採るなら別 Issue を立てて段取りする
- 期限感: いつでも（#1122 の merge をブロックしない）
