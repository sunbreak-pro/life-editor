# MEMORY (chat-shared-fix)

## 進行中

### ⏸️ #1138 MCP の週開始を日曜へ（着手日: 2026-08-29）

**対象**: `mcp-server/src/utils/localDate.ts` / `src/handlers/scheduleHandlers.ts` / `src/tools/briefing.ts` + 対応テスト 2 本

- 前回: `localWeekStart` を月曜起点（`(weekday + 6) % 7`）から日曜起点（`-weekday`）へ。D-20260824-shared-fix-1 = A の実装。週目標の period key が週の開始日そのもの（#872 / #957）なので、MCP が書く朝刊とアプリが見る週がずれていた
- 現在: **`git stash@{0}` に退避中**（PR #1190 の CI 修正を割り込ませたため）。ブランチ `claude/shared-fix-1138-mcp-week-start` はまだコミット 0 件で、変更は stash にしか無い
- 次: `git checkout claude/shared-fix-1138-mcp-week-start && git stash pop` で復元 → mcp-server のゲート → PR

## 直近の完了

- **PR #1190 の CI 修正（#1158 アイドル先読み）**: main 取り込みマージ b7517bd6 が `lazySections.ts` のコンフリクトを main 側で解決し `prefetchLazySections` 135 行を消していた（`MainScreen` の import だけ残って TS2305）。最新 main まで取り込み直して復元し、#1152 の Connect 退役に合わせてローダーを 3→2 本へ。監査で 2 件の実害 —（a）「iOS ≤ 16.3」の注記が誤りで Safari は macOS/iOS とも `requestIdleCallback` 未出荷（実機は常に 2 秒の setTimeout 経路）、（b）`Promise.all` 化がテストをすり抜けるので順次ロードを守るケースを追加。commit 7370ecc3 / CI 緑 / mergeable CLEAN ✅（2026-08-29）
- **/goal 3 件一括（2026-08-27）**: #1114 / #1134 / #1122 のすべてに「origin/main から切ったブランチ + CI verify 15 ステップ緑 + PR」。**#1142（#1114）と #1146（#1134）は当日 merged**、#1154（#1122）が open ✅（2026-08-27）
- #1122 チュートリアルのツアー基盤（**Issue の「DataService 経由で永続化」は踏めない** — DataService は 12 個のドメイン別 interface の合成で汎用 KV が無く、文面どおりだとテーブル + ドメイン + routing + migration + こうだいさんの `supabase db push` まで行く。同種の軽量設定が全部 localStorage なのでそれに揃え、D-20260827-shared-fix-1 として A/B をキューへ。多観点レビュー 18 件を独立反証にかけて 9 件反映 — うち high 1 件は**再開位置が never-shown ステップを飛び越して最終ステップまで歩く**バグで、anchor が 1 つも無い今の状態だと「後から anchor が付いた瞬間に 2/2 から始まる」になっていた — PR #1154 open）✅（2026-08-27）

## 予定

- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測 ② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（手順は PR #967 本文）
- **判断キューに 1 件積んだ（未回答）**: D-20260827-shared-fix-1 = ツアーの進捗を localStorage のままにするか、`tour_progress` テーブル + DataService ドメインを増やすか。放置時は A（PR #1154 は A で出してある）。差し替え先は `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じてある
- **#1122 は「まだ画面に何も出ない」状態で merge される**: `autoStart` 既定 false、shipping した 2 ステップの `data-tour-id` はどの要素にも付いていない（Scope が「付与は各セクション Issue 側」と明記）。Epic #1121 の子 Issue が anchor を足して初めて動く
- **chat-main の手番（実機確認）**: #992 = PR #1127 merged 後の Kanban ドラッグの当たり判定。#947 / #874 / #880 の実機確認も未消化のまま
- **こうだいさんの merge 待ちが 3 本**（P-001）: #1190（#1158 アイドル先読み・CI 緑 / CLEAN）・#1196（#1115）・#1154（#1122）
- **#1190 の残件は chat-main の手番**: DoD の runtime 半分（DevTools / playwright で「アイドル後にチャンクが載っている」「初回切替でフォールバックが出ない」の確認）。worktree チャットは dev server も playwright も起動しない（§7.4）
- **#1190 で見つけた別枠の穴（未起票）**: `web/src` にエラーバウンダリが 1 つも無く `vite:preloadError` のリスナも無いため、`React.lazy` のペイロードが落ちるとルートごと unmount して真っ白になる。main 時点で既にそうなっており #1190 は窓を広げていないが塞いでもいない。起票は chat-main の手番なので outbox へ依頼が要る
- #1079 の残り 2 レバーは着手していない（PR #1129 本文に実測付きで記載）: バレル import の deep path 化は **web 側が config を触らないと 1 行も置換できない**（`exports` にサブパス無し / alias がファイル指し / `paths` にワイルドカード無し）。薄いテストファイルの統合は効果が小さい
- outbox に積んだ起票依頼の消化は chat-main の手番
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 が却下案を復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #700（MCP 検証用ツール）— chat-main 側で進行済みの形跡。着手前に重複確認
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き
