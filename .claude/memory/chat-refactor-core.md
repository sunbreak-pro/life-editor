# MEMORY (chat-refactor-core)

## 進行中

### 🔧 記録の平均と最新（#2231 の Step 1 と Step 4）（着手日: 2026-10-17）

**対象**: `shared/src/utils/appRecordAggregation.ts` / `mcp-server/src/utils/appRecordAggregation.ts` / `supabase/migrations/0041_record_views.sql` / `shared/src/services/**` / 同期まわり
**計画書**: `.claude/docs/vision/plans/2026-10-12-records-aggregation-views.md`

- 前回: #2162 の記録と台帳のデータ層（PR #2203 は 2026-10-17 実測で MERGED）
- 現在: **PR #2267（#2259）と PR #2268（#2260）がどちらも open**（2026-10-17 実測）。ローカルで CI の verify の全ステップと docs-lint が緑。merge はこうだいさんの手番（P-001）
- 次: #2268 は merge の前にこうだいさんの `cd supabase && npm run db:push` が要る。push のあと、Claude が `list_tables` で `record_views` と RLS を確かめて #2260 にコメントする（Issue の DoD）。#2267 の merge を #2261（mcp-tools）と #2262（analytics-refine）が待っている

## 直近の完了

- **#2260 設定表 record_views とデータ層 — PR #2268 open** ✅（2026-10-17）: 0041 と、データ層・同期ドメイン `recordViews`・`REALTIME_TABLES`・書き出し・`delete_my_account()`（0040 の本体に 1 行足して作り直し）。**主キーを Issue と変えた**: Issue は `primary key (user_id, kind, unit)` だが、乱数の `id` を主キーにして `(user_id, kind, unit)` を UNIQUE にした。Realtime は削除の通知を RLS で絞らず主キーの値を付けて全購読者に送るので、Issue の形だと退会した人の uuid と記録の種類が他人に届く（0037 の ai_rules と同じ理由）。もう 1 つの理由は、書き出しが 1 列の並び順でページ送りすること。push 前なら戻せると PR 本文に書いた
- **#2259 集計に occurredAt と latest — PR #2267 open** ✅（2026-10-17）: 同じ時刻は id の大きいほう（locale を使わない文字列比較）。`list_records` の答えに `latest` はまだ出さず、旧い形に絞って返す（Issue の指示。#2261 で足す）。見本データを作るとき、私の生成スクリプトが「最新 = 入力の最後」と決め打ちして 10 月の期待値を間違えた。実装のほうが正しかった。日付が違う点を混ぜた例は、並び順と時刻の順がずれる良い検査になる
- **#2162 記録と台帳のデータ層 — PR #2203 merged** ✅（2026-10-11）

## 予定

- **chat-main への申し送り済み（outbox 2026-10-17）**: 0039 の `extension_apps` は主キーが `(user_id, slug)` のまま Realtime の配信に入っていて、#2268 で避けた削除通知の漏れがすでに起きうる（migration 監査エージェントの指摘）。Issue 起票の依頼だけ出し、直していない
- **merge 後に chat-main へ**: #948 のブラウザ側での裏取り（Briefing を開く / Analytics のタブ一巡で当該警告 0 件・1440px と 390px でチャートが従来どおり）。worktree では dev server / playwright を持てない（§7.4）ため、jsdom + 実 recharts で console を読むところまでが自分の担当
- **#1038 の案 B（無駄取りの削減）は未着手**。schedule 11→8 / connect 7→5 / Materials タブ切替 4→1 で、#1101（案 A-1）とは独立に効く。着手するなら Issue の起票依頼を outbox へ（起票は chat-main 一元化）。案 C（hover プリフェッチ）は初回訪問の chunk 待ちだけに効くので優先度は下
- **#958 / #960 / #963 / #985 / #1058 は 2026-08-18 時点で全部 merged**。merge 後にやり残しているのは #960 の**パッケージ版デスクトップの起動とログイン維持**の目視（IPC 登録経路が表になったため）— chat-main 手番
- **#898 は着手判断そのものがユーザー手番**。実装せず A/B を判断キューへ積む（#677 は status:frozen で対象外）
- 実装セッション 1 の残り: #671（#672 は chat-shared-fix が PR #801 で着手中・#673 は完了・#675 は 4 項目とも PR 化済み）
- **C1 の後始末（別 PR・小さい）**: `shared/tsconfig.test.json` の除外 12 本 + `web` の 1 本を潰す。中身は fixture の型ズレと不要な `@ts-expect-error` 5 件で、1 本直すごとに `exclude` から 1 行消える（#690 の PR 本文に全件の内訳あり）
- 実装セッション 2: 未調査領域の追加調査（計画書 §次セッションの調査計画 A-1〜A-6）→ #674 → #676(a) → #675
- **回答待ちの判断 2 件**（どちらも放置時 = 現状維持なので作業はブロックしない）: D-20260811-refactor-1（Analytics の「今週」2 定義を揃えるか）/ D-20260811-refactor-2（`window.confirm` を自前ダイアログにするか）
- merge 後に chat-main へ依頼: ルーチン undo の実ブラウザ検証（D-20260810-refactor-1 の条件）／ **#705 の IME ガード 3 経路の実ブラウザ検証**（`[[` 候補・スラッシュメニュー・Connect で変換中 Escape）
