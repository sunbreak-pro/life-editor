# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- **/goal 7 件を PR まで（2026-08-30）**: #1264 / #1276 / #1275 / #1278 / #1279 / #1283 / #1284。**PR #1305 / #1315 / #1321 / #1325 / #1327**（#1283 と #1284 は Issue 指定どおり 1 ブランチ）+ #1279 は判断キュー `D-20260830-shared-fix-1`（PR #1328 + Issue コメント）。全ブランチで verify 15 ステップ + docs-lint をローカル緑。**3 件は Issue の Scope が指すファイルに原因が無かった** — #1283 は `SectionHeader.tsx`（`AppShell` ではない）、#1284 の重複 × は Desktop と Mobile が共有する `RightSidebarContents.tsx`（だから breakpoint 条件が無かった）、#1276 の `t()` 呼び出し元は `CalendarDesktopLayout.tsx:270`。#1278 は Issue の `variant?: 'panel' | 'text'` をそのまま実装すると既存 2 値の改名になり `OfflineBanner` が壊れるので、3 つ目の値として足した ✅（2026-08-30）
- **#1194 を PR まで（2026-08-30）**: Settings からチュートリアルを選んで始める導線（概要モーダル → セクション選択 → 自動遷移して開始）。`TourContext` に `startSection` を足し、**run が歩く list をセクションの薄切りに差し替える**形にした（probe / give-up / カウンタ / 終端は元からその list に対して動いていた）。**部分実行は保存を一切触らない** — `persist` 1 箇所のガードで、4 ステップ歩いただけで `completed` が立つ / Skip で `skipped` が立つ事故を塞いだ。選択メニューは `TOUR_SECTION_IDS`（`TOUR_STEPS` からの導出）で、step の無い 3 セクションは隠さず disabled +「準備中」。`Modal` に `size="full"` を追加（**Issue の Scope 列挙外**なので PR 本文に明記）。**PR #1246**（ci.yml の verify 15 ステップ + docs-lint をローカル全緑） ✅（2026-08-30）
- **/goal 4 件を PR まで（2026-08-29）**: #1138 / #1192 / #1193 / #1201 のすべてに「origin/main から切ったブランチ + ci.yml の verify 全ステップ + docs-lint をローカルで緑 + PR」。**PR #1214 / #1217 / #1225 / #1228**（前 3 本は GitHub CI も緑、#1228 は書いた時点で verify ジョブ実行中）。ツアー系 3 件はファイル重複ゼロで切ってあり、3 本を任意の順で merge できる。#1194 は Wave 2（#1174 待ち）なので着手していない ✅（2026-08-29）

## 予定

- **🛑 こうだいさん手番 — merge 待ちが 7 本**（P-001）: 実装 5 本 = **#1305**（#1264 ツアーフッター）/ **#1315**（#1276 複数形）/ **#1321**（#1275 Trash の NoticePanel 化）/ **#1325**（#1278 text variant）/ **#1327**（#1283 ヘッダー中央化 + #1284 右パネルの閉じる導線）。docs 2 本 = **#1328**（#1279 の判断キュー起票）/ **#1246**（#1194 = Settings からのチュートリアル導線・前セッション分）。**5 本とも同じ origin/main（b31ee913）から切ってあり、ファイル重複は #1325 と #1321 が `NoticePanel` 周辺で隣接するのみ**（#1321 は呼び出し側だけ・#1325 は本体だけなので任意の順で merge できる）
- **判断キューに 1 件積んだ（未回答・今回分）**: **D-20260830-shared-fix-1** = #1279 `RepeatListPanel` のインライン確認行を A（手書きのまま据え置き）/ B（NoticePanel に確認バリアント）/ C（ConfirmDialog に寄せる）のどれにするか。実測ではこの形はリポジトリ内 1 箇所だけなので推奨は A。放置時は #1279 を保留（コードは現状のまま動く）
- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測 ② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（手順は PR #967 本文）
- **chat-main の手番（実ブラウザ検証）**: #1192 の DoD 後半 = ツールチップ表示中に `elementFromPoint` がタグの選択肢自身を返すこと。jsdom は「ポップオーバーが開いているあいだ描画されない」までしか保証できない（座標が全部 0 = §7.1）。#1193 も「step 3 で中断 → リロードでツアーが必ず出る」を実機で見るのが最終確認。**#1194 も同種**（全画面モーダルの見た目と、セクションを選んだあと本当にツアーのふきだしが出るか）。ほかに #992 / #947 / #874 / #880 の実機確認が未消化
- **判断キューに 1 件積んだ（未回答）**: D-20260827-shared-fix-1 = ツアーの進捗を localStorage のままにするか、`tour_progress` テーブル + DataService ドメインを増やすか。放置時は A。差し替え先は `shared/src/hooks/useTourProgress.ts` の 1 ファイルに閉じてある
- **未起票の穴（起票は chat-main の手番 → outbox 依頼が要る）**: `web/src` にエラーバウンダリが 1 つも無く `vite:preloadError` のリスナも無いため、`React.lazy` のペイロードが落ちるとルートごと unmount して真っ白になる
- **`D-20260812-web-1` の supersede 記録は chat-web-public の手番**（#991 = PR #1027 が却下案を復活条件どおりに実装した。単一書込者原則により私は書けない — outbox に依頼済み）
- **#1005 / #1009 は `[web-public]` 接頭辞**なので自分宛としては拾っていない（`shared-fix` ラベルは付いているが宛先 slug が別 = D-20260731-main-2）
- #1079 の残り 2 レバーは着手していない（PR #1129 本文に実測付きで記載）: バレル import の deep path 化は **web 側が config を触らないと 1 行も置換できない**（`exports` にサブパス無し / alias がファイル指し / `paths` にワイルドカード無し）。薄いテストファイルの統合は効果が小さい
- #700（MCP 検証用ツール）— chat-main 側で進行済みの形跡。着手前に重複確認
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き
