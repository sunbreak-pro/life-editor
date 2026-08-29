# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- Tag 起点の新 Connect セクション（Tag hub・#1171）✅（2026-08-29・**PR #1230 open = merge 待ち**。計画書 `plans/2026-08-29-connect-tag-hub.md` は Status: IN PROGRESS のまま — COMPLETED 化と archive 移動は merge 後）
- Connect セクションを力学グラフごと退役（#1152・タグ / リンク / 検索は温存）✅（2026-08-29・**PR #1175 merged**・Issue #1152 CLOSED）
- Layout Standard v2 adoption（#206・in-body ConnectHeader 撤去 → graph アクション（件数/フィルタ解除/reheat/fit）を rightSidebar 集約）✅（2026-07-11・Issue #206 CLOSED / PR #212 merged）

## 予定

- **計画書 2 本の後始末（#1175 merged で 1 本目は着手可能）**: `plans/2026-08-29-connect-section-retirement.md` を COMPLETED 化 → `archive/` へ移動。移動するときは `plans/2026-08-29-connect-tag-hub.md` の frontmatter `Previous:` が相対リンクで指しているので、そちらも同 PR で貼り替える（放置すると docs-lint の相対リンク検査が落ちる）。2 本目（tag-hub）は PR #1230 merge 後
- d3 依存 8 本の削除（#1152 の follow-up・起票依頼を outbox に投函済み。Issue が立ったら着手）
- `D-20260829-connect-1` の回答消化（呼び出し元ゼロになった backlink 部品 3 つを保持 or 削除）。**#1171 の Tag hub は呼び出し元にならない** — hub はタグ軸でリンク軸を扱わないため、この判断の前提は #1175 当時のまま変わっていない
