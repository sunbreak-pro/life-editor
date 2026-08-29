# MEMORY (chat-settings-refine)

## 進行中

（なし）

## 直近の完了

- チュートリアルの初回自動開始と Settings 再実行導線（#1122 の TourProvider に `autoStart` を渡す＋`SettingsTutorial` カードから `restart`・アンカー不在の空振り走行は開始地点へ戻す guard 付き・Issue #1123 / PR #1164 open）✅（2026-08-28）
- パスワード変更フォームに hidden username を追加しパスワードマネージャに紐付け可能に（`PasswordUpdateForm` に optional `username`・Settings は必須 email を、リセット画面は recovery session の email を渡す・Issue #945 / PR #978 open）✅（2026-08-16）
- テーマ切替カードの light / dark が区別できない不具合修正（`tokens.css` に `[data-theme]` 別名ブロック追加＋lucide の昼/夜グリフ・Issue #887 / PR #905 merged）✅（2026-08-15）

## 予定

- life-tags: settings に tag 管理 UI を置くかの判断（兄弟計画 `2026-07-11-life-tags-unification.md` の詳細設計後・合図待ち）
