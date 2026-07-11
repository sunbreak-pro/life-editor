# MEMORY (chat-layout-standard)

## 進行中

（なし）

## 直近の完了

- Layout Standard v2 共通部品（標準定義 §1〜§5）+ draft PR #196 ✅（2026-07-11）
- layout-standard オーダー（Issue #180）— Layout Standard v1 共通部品 + draft PR ✅（2026-07-11）

## 予定

- #196 draft PR のレビュー対応 → ready 化（v2 Step 4 merge は 🛑 人手ゲート）
- materials-refine の幅 scope 回答（outbox 打診済: サブタブ単位暫定）受領後、親計画 §5 未定事項を確定更新
- 検証用テストアカウント削除の確認（要ユーザー操作・MCP read-only）: `delete from auth.users where email in ('le-layout-smoke-20260710@example.com', 'pw-smoke-1752198632@example.com');`
