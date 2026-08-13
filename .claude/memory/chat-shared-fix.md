# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- #782 MCP 棚卸しの残り 3 塊（① #822 merged / ② #828 open / ③ #832 open — 各 PR に Closes 付き・mcp 260 / web 343 / shared 2038 tests 緑）✅（2026-08-13）
- #672 use\*API load effect 共通化の完走（schedule 導出化 + baseline 全削除 = PR #801 merged・playwright は chat-main 宛て）✅（2026-08-13）
- #669 core-refactor C2（mcp-server の書き込みを `utils/items` へ・`tools.ts` を宣言的レジストリ + 引数 validator・db-conventions §13）✅（2026-08-11・PR #694 open）

## 予定

- #700（MCP 検証用ツール）— verification 3 ツールと Step 2 記録は chat-main 側で進行済みの形跡（main の tools.ts + tracker 記録）。着手前に重複がないか状況確認
- PR #828 / #832 merge 後、#782 は Closes で自動 close（#822 の merge で既に close 済みの可能性 — 3 本出揃いの旨は各 PR 本文に記載済み）
- outbox に積んだ 4 件の起票依頼（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）の消化は chat-main の手番
