# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- Tag 起点の新 Connect セクション（Tag hub・#1171）✅（2026-08-29 実装 / 2026-08-30 確認・**PR #1230 merged**・Issue #1171 CLOSED・計画書は `archive/2026-08-29-connect-tag-hub.md`）
- Connect セクションを力学グラフごと退役（#1152・タグ / リンク / 検索は温存）✅（2026-08-29・**PR #1175 merged**・Issue #1152 CLOSED・計画書は `archive/2026-08-29-connect-section-retirement.md`）
- Layout Standard v2 adoption（#206・in-body ConnectHeader 撤去 → graph アクション（件数/フィルタ解除/reheat/fit）を rightSidebar 集約）✅（2026-07-11・Issue #206 CLOSED / PR #212 merged）

## 予定

- **新 Connect の実ブラウザ確認は chat-main 待ち**（CLAUDE.md §7.4 — worktree は build / 型検証まで）。特に狭幅レイアウトの「タグ一覧 → アイテム一覧」1 画面ずつ遷移は jsdom にレイアウトが無く機械検証できていない
- d3 依存 8 本の削除（#1152 の follow-up・起票依頼を outbox に投函済み。Issue が立ったら着手）
- `D-20260829-connect-1` の回答消化（呼び出し元ゼロになった backlink 部品 3 つを保持 or 削除）。**#1171 の Tag hub は呼び出し元にならない** — hub はタグ軸でリンク軸を扱わないため、この判断の前提は #1175 当時のまま変わっていない
- `web/tests/briefingEveningLazyMount.test.tsx` のフル実行時 flake 起票（outbox に投函済み・chat-main 待ち）
