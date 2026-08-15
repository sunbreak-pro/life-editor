# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- #874 Mobile の詳細・編集パネルを全画面化 + 背後が持ち上がる原因の除去（`BottomSheet` に `fullScreen` / `AppShell` のタブバーを unmount → `invisible` — PR #917 open・Closes 付き・実機目視は merge 後 chat-main）✅（2026-08-15）
- #880 Mobile の Save ボタンに出る白い帯（accent 地のボタンの focus ring を `ring-offset` → `outline` に。共有トークン `FOCUS_RING_ON_ACCENT` 新設・8 箇所適用 — PR #909 open・Closes 付き）✅（2026-08-15）
- #831 コード上の Task → Todo 統一 + 機能名 Tasks → Todos（DB 据え置き。stacked merge の取りこぼしは復旧 PR #865 で解消し **merge 済み**）✅（2026-08-14）

## 予定

- #700（MCP 検証用ツール）— verification 3 ツールと Step 2 記録は chat-main 側で進行済みの形跡（main の tools.ts + tracker 記録）。着手前に重複がないか状況確認
- PR #828 / #832 merge 後、#782 は Closes で自動 close（#822 の merge で既に close 済みの可能性 — 3 本出揃いの旨は各 PR 本文に記載済み）
- outbox に積んだ 4 件の起票依頼（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）の消化は chat-main の手番
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き（改名するなら移行が要る）。機能名「Tasks」は 2026-08-14 に全 live docs で改名済み
- **#916（月シート廃止）の merge 判断待ち** = `D-20260815-shared-fix-1`。見送りになった場合のみ、月シートの全画面化を別途起票する（#917 では #916 との衝突を避けて意図的に外した）
- #874 / #880 とも実機での見え方は未確認（worktree では実ブラウザ検証をしない規約）。特に #874 は「全画面にしなかったシートで、キーボードの上に残る不可視の帯」が新しく生じる見え方なので merge 後の chat-main 実測が要る
