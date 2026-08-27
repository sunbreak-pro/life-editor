# MEMORY (chat-shared-fix)

## 進行中

（なし）— /goal の 3 件は全件 PR まで到達済み。merge はこうだいさんの手番（P-001）

## 直近の完了

- **/goal 3 件一括（2026-08-27）**: #1114 / #1134 / #1122 のすべてに「origin/main から切ったブランチ + CI verify 15 ステップ緑 + PR」。**#1142（#1114）と #1146（#1134）は当日 merged**、#1154（#1122）が open ✅（2026-08-27）
- #1122 チュートリアルのツアー基盤（**Issue の「DataService 経由で永続化」は踏めない** — DataService は 12 個のドメイン別 interface の合成で汎用 KV が無く、文面どおりだとテーブル + ドメイン + routing + migration + こうだいさんの `supabase db push` まで行く。同種の軽量設定が全部 localStorage なのでそれに揃え、D-20260827-shared-fix-1 として A/B をキューへ。多観点レビュー 18 件を独立反証にかけて 9 件反映 — うち high 1 件は**再開位置が never-shown ステップを飛び越して最終ステップまで歩く**バグで、anchor が 1 つも無い今の状態だと「後から anchor が付いた瞬間に 2/2 から始まる」になっていた — PR #1154 open）✅（2026-08-27）
- #1134 モバイルの入力欄オートズーム（方針 A = tokens.css にモバイル限定の `max(16px, ...)` フロア 1 本。**呼び出し側 30 箇所の掃除では足りない** — `DailyEntriesPanel` の日付 input は自分のサイズ指定を持たず preflight の `font: inherit` で親の 12.5px を拾うため、要素セレクタでしか捕まらない。`@layer` の外に置くのが要件で、生成 CSS 上で utilities 層の外に出ていることを実測。エディタ本文は specificity で負けるので `web/src/index.css` にもう 1 本 — PR #1146 **merged**）✅（2026-08-27）
- #1114 tagIcon の lucide レジストリ参照を明示 import 26 個へ（**着手前の DB 確認で保存済みは `Clock` / `File` の 2 つだけ**と分かり curated 26 の内側だったので判断キュー不要。実測は Issue の見積もり −28% を上回り eager chunk gzip **368.83 → 251.84 kB = −31.7%**。旧実装にもあった prototype キー汚染（`resolveTagIcon("toString")` が関数を返す）を `Object.hasOwn` で塞いだ — PR #1142 **merged**）✅（2026-08-27）

## 予定

- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測 ② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（手順は PR #967 本文）
- **判断キューに 1 件積んだ（未回答）**: D-20260827-shared-fix-1 = ツアーの進捗を localStorage のままにするか、`tour_progress` テーブル + DataService ドメインを増やすか。放置時は A（PR #1154 は A で出してある）。差し替え先は `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じてある
- **#1122 は「まだ画面に何も出ない」状態で merge される**: `autoStart` 既定 false、shipping した 2 ステップの `data-tour-id` はどの要素にも付いていない（Scope が「付与は各セクション Issue 側」と明記）。Epic #1121 の子 Issue が anchor を足して初めて動く
- **chat-main の手番（実機確認）**: #992 = PR #1127 merged 後の Kanban ドラッグの当たり判定。#947 / #874 / #880 の実機確認も未消化のまま
- 自分宛で残っている open Issue: **#1115**（Briefing がエディタを即時マウントして RichTextEditor chunk が初回ロードに入る — #994 の実測由来。#1114 と同じレポートの別項）
- #1079 の残り 2 レバーは着手していない（PR #1129 本文に実測付きで記載）: バレル import の deep path 化は **web 側が config を触らないと 1 行も置換できない**（`exports` にサブパス無し / alias がファイル指し / `paths` にワイルドカード無し）。薄いテストファイルの統合は効果が小さい
- outbox に積んだ起票依頼の消化は chat-main の手番
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 が却下案を復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #700（MCP 検証用ツール）— chat-main 側で進行済みの形跡。着手前に重複確認
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き
