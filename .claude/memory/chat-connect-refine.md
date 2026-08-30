# MEMORY (chat-connect-refine)

## 進行中

（なし）

## 直近の完了

- 呼び出し元ゼロの backlink 部品を削除（#1239・`D-20260829-connect-1` = B）✅（2026-08-30・**PR #1258 open = merge 待ち**）
- Connect 退役で未使用になった d3 依存 8 本を削除（#1220）✅（2026-08-30・**PR #1256 open = merge 待ち**）
- Tag 起点の新 Connect セクション（Tag hub・#1171）✅（2026-08-29 実装 / 2026-08-30 確認・**PR #1230 merged**・Issue #1171 CLOSED・計画書は `archive/2026-08-29-connect-tag-hub.md`）

## 予定

- **新 Connect の実ブラウザ確認は chat-main 待ち**（CLAUDE.md §7.4 — worktree は build / 型検証まで）。特に狭幅レイアウトの「タグ一覧 → アイテム一覧」1 画面ずつ遷移は jsdom にレイアウトが無く機械検証できていない
- `web/tests/briefingEveningLazyMount.test.tsx` のフル実行時 flake 起票（outbox に投函済み・chat-main 待ち）
- **PR #1258 のレビュー論点 1 つ**: #1239 の DoD は「シンボル名の grep = 0」だが、退役理由を残すコメント 3 箇所（バレル 2 + LinkPanel）に名前を残したため実測は 3。実参照はゼロ。字面どおり 0 にしたいならコメントから名前を落とす — PR 本文で判断を仰いでいる
- `section:connect` の open Issue は 0 になった。次は `shared-fix` ラベルの自分宛を拾う
