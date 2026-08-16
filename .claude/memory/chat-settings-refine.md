# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- パスワード変更フォームに hidden username を追加しパスワードマネージャに紐付け可能に（`PasswordUpdateForm` に optional `username`・Settings は必須 email を、リセット画面は recovery session の email を渡す・Issue #945 / PR #978 open）✅（2026-08-16）
- テーマ切替カードの light / dark が区別できない不具合修正（`tokens.css` に `[data-theme]` 別名ブロック追加＋lucide の昼/夜グリフ・Issue #887 / PR #905 merged）✅（2026-08-15）
- Settings フォント種別（Serif/Mono）が本文に効かない不具合修正（`web/src/index.css` で font-family を body→html へ移設・Issue #228 / PR #233）✅（2026-07-11）

## 予定

- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
