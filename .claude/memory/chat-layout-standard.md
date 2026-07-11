# MEMORY (chat-layout-standard)

## 進行中

（なし）

## 直近の完了

- 幅切替タブ撤去・全画面 wide 統一（Issue #203 / draft PR #210）✅（2026-07-11）
- Layout Standard v2 共通部品（標準定義 §1〜§5）+ PR #196 merge 済 ✅（2026-07-11）
- layout-standard オーダー（Issue #180）— Layout Standard v1 共通部品 ✅（2026-07-11）

## 予定

- #210 draft PR のレビュー対応 → ready/merge（v2 Step 4 merge は 🛑 人手ゲート）
- 検証用テストアカウント削除の確認（要ユーザー操作・MCP read-only）: `delete from auth.users where email in ('le-layout-smoke-20260710@example.com', 'pw-smoke-1752198632@example.com');`
