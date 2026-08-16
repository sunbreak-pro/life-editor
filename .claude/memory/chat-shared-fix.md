# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- #956 パスワードの最小長 6 → 12（`D-20260816-shared-fix-4` = A の実装。数値は `shared/src/constants/password.ts` の `PASSWORD_MIN_LENGTH` 1 箇所で、en / ja 文言は `{{min}}` 差し込みに変えて数値を持たない — PR #967 open・Closes 付き。回答済み判断 5 件の台帳昇格も同日）✅（2026-08-16）
- #919 パスワードの変更 / 再設定の導線（`detectSessionInUrl` を全面 true = `D-20260816-shared-fix-1` / サインイン画面の「忘れた場合」→ リンク要求 → 再設定 / Settings のアカウントカード。security-reviewer 通過後にリロード抜けと URL フラグメント残りを追加修正 — PR #930 merged・Closes 付き）✅（2026-08-16）
- #874 Mobile の詳細・編集パネルを全画面化 + 背後が持ち上がる原因の除去（`BottomSheet` に `fullScreen` / `AppShell` のタブバーを unmount → `invisible` — PR #917 merged・Closes 付き・実機目視は merge 後 chat-main）✅（2026-08-15）

## 予定

- **🛑 こうだいさん手番が 2 件たまっている**（どちらも Supabase ダッシュボード）: ① #919 = Authentication → URL Configuration に公開 Web URL を登録 / Reset Password テンプレートの確認 / 実際に 1 通届くかの実測（ここが済むまでリカバリーは通し確認できない）② #956 = Sign In / Providers → Email → **Minimum password length を 6 → 12**（揃えるまで「アプリは 12 を求めるのに実際は 6 で通る」状態が残る。手順は PR #967 本文）
- #700（MCP 検証用ツール）— verification 3 ツールと Step 2 記録は chat-main 側で進行済みの形跡（main の tools.ts + tracker 記録）。着手前に重複がないか状況確認
- PR #828 / #832 merge 後、#782 は Closes で自動 close（#822 の merge で既に close 済みの可能性 — 3 本出揃いの旨は各 PR 本文に記載済み）
- outbox に積んだ起票依頼の消化は chat-main の手番: 2026-08-13 の 4 件（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）+ 2026-08-16 の 2 件（公開 Web の CSP / Referrer-Policy・#956 で古くなった他レーン docs 2 本）
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き（改名するなら移行が要る）。機能名「Tasks」は 2026-08-14 に全 live docs で改名済み
- #874 / #880 とも実機での見え方は未確認（worktree では実ブラウザ検証をしない規約）。特に #874 は「全画面にしなかったシートで、キーボードの上に残る不可視の帯」が新しく生じる見え方なので merge 後の chat-main 実測が要る
