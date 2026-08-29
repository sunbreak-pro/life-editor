---
id: D-20260827-shared-fix-1
type: decision
status: answered
asked: 2026-08-27
answered: 2026-08-28
chat: shared-fix
answer: A
topics: [tutorial, tour, persistence, localstorage, dataservice]
refs:
  [
    "#1121",
    "#1122",
    "#1123",
    "PR #1154",
    "shared/src/hooks/useTourProgress.ts",
    "shared/src/services/DataService.ts:651-664",
  ]
supersedes: []
superseded-by: []
implemented-by: ["#1122"]
promoted-to: null
---

# D-20260827-shared-fix-1: ツアーの進捗を localStorage のままにするか、DataService のドメインを 1 つ増やすか

## 背景

（キュー `.claude/comm/decisions/chat-shared-fix.md` のエントリ本文をそのまま貼る）

- 背景: #1122（PR は #1154）。Issue 本文は「進捗を DataService 経由で永続化」と書いているが、`shared/src/services/DataService.ts:651-664` の `DataService` は 12 個のドメイン別インターフェースの合成で、汎用の key-value / 設定テーブルが無い。テーマ・フォント・reduce motion・言語・ショートカット・起動セクション等、同種の軽量設定はすべて `useLocalStorage`（`life-editor-` 名前空間・§216）に載っている。実装は `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じてあり、差し替え先はここだけ。
- A: **localStorage のまま**（推奨 — 他の軽量設定と同じ置き場で、追加コストゼロ。ツアーの到達位置は端末ローカルで十分という判断）
- B: `tour_progress` テーブル + DataService ドメインを新設（Issue の文面どおり。migration 1 本 + `SupabaseTourService` + routing tuple + `SYNC_DOMAINS` 行が要り、最後に**こうだいさんの `supabase db push`**（🛑 人手ゲート・CLAUDE.md §7.3）まで行かないと動かない）
- 放置時: A のまま（PR #1154 は A で出してある）。B を採るなら別 Issue を立てて段取りする
- 期限感: いつでも（#1122 の merge をブロックしない）

## 選択肢と裁定

- **A: localStorage のまま**（**採用** — こうだいさんの回答 2026-08-28。回答は「localstorage のままで OK」の一言）。テーマ・フォント・言語・ショートカット・起動セクションと同じ「端末ローカルの軽量設定」として扱う。PR #1154 は既にこの形で merge 済みなので、追加の実装は発生しない
- B: `tour_progress` テーブル + DataService ドメイン新設（却下 — Issue 本文の「DataService 経由で永続化」は、汎用 key-value を持たない現行の `DataService` 構成を踏まえていなかった。ツアーの到達位置のためだけに migration + Supabase サービス + routing + `SYNC_DOMAINS` の 4 点セットと 🛑 `supabase db push` を積む価値が無い）

## 波及

- #1122 の Issue 本文にある「DataService 経由で永続化」の一文は本裁定で無効。追随する #1123 / #1124 / #1125 も `useTourProgress` をそのまま使う
- 端末間でツアーの到達位置は共有されない（新しい端末では初回ツアーが再度出る）。N=1 のユーザー体験としては許容と判断した
