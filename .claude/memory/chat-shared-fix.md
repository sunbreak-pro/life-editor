# MEMORY (chat-shared-fix)

## 進行中

（なし）

## 直近の完了

- #831 コード上の Task → Todo 統一 + 機能名 Tasks → Todos（DB 据え置き — stacked 3 本のうち main に着地したのは #861 のみ。#862 / #863 は base 張り替え前に merge され前段ブランチへ吸収 → **復旧 PR #865 で main へ再投入・open**）✅（2026-08-14）
- #838 セッション永続の storage 差し替え（Electron safeStorage / Capacitor Preferences / web localStorage — PR #847 open・Closes 付き・実測系 DoD は merge 後 chat-main）✅（2026-08-13）
- #827 ダークテーマのスクロールバー配色（`color-scheme` + `scrollbar-color` トークン経由 — PR #850 open・Closes 付き・目視は merge 後 chat-main）✅（2026-08-13）

## 予定

- #700（MCP 検証用ツール）— verification 3 ツールと Step 2 記録は chat-main 側で進行済みの形跡（main の tools.ts + tracker 記録）。着手前に重複がないか状況確認
- PR #828 / #832 merge 後、#782 は Closes で自動 close（#822 の merge で既に close 済みの可能性 — 3 本出揃いの旨は各 PR 本文に記載済み）
- outbox に積んだ 4 件の起票依頼（mcp tests 型検査ゲート / スタブ統合 / search_all LIKE エスケープ + task_type NULL / requirements README の列挙陳腐化）の消化は chat-main の手番
- **PR #865 が merge されるまで main は「shared だけ Todo・画面と MCP は Task」の半端な状態**（#861 単独では緑なので壊れてはいない）。merge で #831 が Closes により close する
- #831 の残り: `nav:tasks` / `global:new-task` はショートカット設定が localStorage に id で保存されるため据え置き（改名するなら移行が要る）。機能名「Tasks」は 2026-08-14 に全 live docs で改名済み
